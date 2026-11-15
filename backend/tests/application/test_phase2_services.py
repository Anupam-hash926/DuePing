"""Tests for Clock, Playbook, Prioritization, Reminders, Factory, and Importer."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.application.clock import SimulatedClock, SystemClock
from app.application.importing import (
    AmountValidator,
    ClientDataValidator,
    CsvInvoiceSource,
    DateValidator,
    DuplicateInvoiceNumberValidator,
    InvoiceImporter,
    InvoiceSourceFactory,
    RawInvoiceRow,
    RequiredFieldsValidator,
    StatusValidator,
    ValidationContext,
)
from app.application.invoice_factory import InvoiceFactory
from app.application.playbook import (
    ResolutionPlaybook,
    ResolutionStrategy,
)
from app.application.prioritization import (
    ActionContext,
    AmountFirstStrategy,
    OldestFirstStrategy,
    PrioritizationRegistry,
    RiskWeightedStrategy,
)
from app.application.reminders import (
    ReminderFactory,
)
from app.domain.blocker import PaymentBlocker
from app.domain.client import Client
from app.domain.enums import (
    ActionSource,
    BlockerType,
    Priority,
    ReminderTone,
)
from app.domain.exceptions import DomainValidationError, DuplicateInvoiceNumber
from app.domain.invoice import Invoice
from app.domain.money import Money
from app.domain.next_action import NextAction
from app.infrastructure.in_memory_repositories import (
    InMemoryClientRepository,
    InMemoryInvoiceRepository,
    InMemoryProjectRepository,
    InMemorySettingsRepository,
)
from tests.domain.conftest import NOW, TODAY, make_invoice

# ── Clock Tests ───────────────────────────────────────────────────────────────

class TestClock:
    def test_system_clock_returns_real_time(self):
        clock = SystemClock()
        assert isinstance(clock.today(), date)
        assert isinstance(clock.now(), datetime)

    def test_simulated_clock_unconfigured_delegates_to_real(self):
        settings = InMemorySettingsRepository()
        clock = SimulatedClock(settings)
        assert clock.today() == date.today()

    def test_simulated_clock_travels_in_time(self):
        settings = InMemorySettingsRepository({"simulated_date": "2026-12-25"})
        clock = SimulatedClock(settings)
        assert clock.today() == date(2026, 12, 25)
        assert clock.now() == datetime(2026, 12, 25, 9, 0, 0)


# ── Playbook Strategy Tests ───────────────────────────────────────────────────

class TestPlaybookStrategy:
    def test_playbook_default_strategies_map_expected_actions(self):
        playbook = ResolutionPlaybook()
        client = Client(name="Acme Corp", email="a@acme.com", company_name="Acme Ltd")
        inv = make_invoice(invoice_number="DP-2026-0001")

        cases = [
            (BlockerType.MISSING_PO, Priority.HIGH, 1, "missing purchase order"),
            (BlockerType.AWAITING_APPROVAL, Priority.MEDIUM, 2, "approves invoice"),
            (BlockerType.DISPUTED_AMOUNT, Priority.CRITICAL, 1, "Schedule a call"),
            (BlockerType.WRONG_DETAILS, Priority.HIGH, 1, "Correct the details"),
            (BlockerType.MISSING_DOCUMENTS, Priority.MEDIUM, 2, "missing supporting documents"),
            (BlockerType.NO_RESPONSE, Priority.HIGH, 1, "Try another channel"),
            (BlockerType.OTHER, Priority.LOW, 3, "Review the blocker"),
        ]

        for b_type, expected_prio, due_days, text_snip in cases:
            blocker = PaymentBlocker(type=b_type, description="test", created_at=NOW)
            act = playbook.plan_for(blocker, inv, client, TODAY)
            assert act.source == ActionSource.BLOCKER
            assert act.source_ref == blocker.id
            assert act.priority == expected_prio
            assert act.due_date == TODAY + timedelta(days=due_days)
            assert text_snip in act.description

    def test_playbook_custom_extensibility(self):
        class CustomStrategy(ResolutionStrategy):
            blocker_type = BlockerType.OTHER

            def plan(self, ctx):
                return NextAction(
                    description="Custom action",
                    priority=Priority.CRITICAL,
                    due_date=ctx.today,
                    source=ActionSource.BLOCKER,
                    created_at=ctx.blocker.created_at,
                )

        pb = ResolutionPlaybook()
        pb.register(CustomStrategy())
        blocker = PaymentBlocker(type=BlockerType.OTHER, description="x", created_at=NOW)
        client = Client(name="A", email="a@b.com")
        act = pb.plan_for(blocker, make_invoice(), client, TODAY)
        assert act.description == "Custom action"
        assert act.priority == Priority.CRITICAL


# ── Prioritization Strategy Tests ─────────────────────────────────────────────

class TestPrioritizationStrategy:
    @pytest.fixture
    def setup_context(self):
        c_good = Client(name="Reliable", email="r@test.com")
        c_poor = Client(name="Unreliable", email="u@test.com", promises_kept=1, promises_missed=3)  # 25%

        inv_small = make_invoice(total_amount=10_000, issue_days_ago=50, due_days_ago=40, invoice_number="DP-SMALL")
        inv_small.send(NOW)

        inv_large = make_invoice(total_amount=100_000, issue_days_ago=15, due_days_ago=5, invoice_number="DP-LARGE")
        inv_large.send(NOW)

        act1 = NextAction("A1", Priority.MEDIUM, TODAY, ActionSource.BLOCKER, NOW)
        act2 = NextAction("A2", Priority.HIGH, TODAY, ActionSource.BLOCKER, NOW)

        ctx_small = ActionContext(act1, inv_small, c_poor, TODAY)
        ctx_large = ActionContext(act2, inv_large, c_good, TODAY)
        return ctx_small, ctx_large

    def test_amount_first_orders_by_outstanding(self, setup_context):
        ctx_small, ctx_large = setup_context
        strat = AmountFirstStrategy()
        assert strat.score(ctx_large) > strat.score(ctx_small)
        assert "100,000" in strat.explain(ctx_large)

    def test_oldest_first_orders_by_days_overdue(self, setup_context):
        ctx_small, ctx_large = setup_context
        strat = OldestFirstStrategy()
        assert strat.score(ctx_small) > strat.score(ctx_large)
        assert "40 days overdue" in strat.explain(ctx_small)

    def test_risk_weighted_strategy_formula(self, setup_context):
        ctx_small, ctx_large = setup_context
        strat = RiskWeightedStrategy()
        # ctx_small: MEDIUM (25) + 0.5*min(40, 90)=20 + 0.3*(100-25)=22.5 + 20*min(1, 1)=20 => 87.5
        # ctx_large: HIGH (50) + 0.5*5=2.5 + 0.3*(100-100)=0 + 20*1=20 => 72.5
        assert strat.score(ctx_small) > strat.score(ctx_large)
        exp = strat.explain(ctx_small)
        assert "MEDIUM priority" in exp
        assert "40 days overdue" in exp

    def test_registry_lookup_and_unknown_raises(self):
        reg = PrioritizationRegistry()
        assert isinstance(reg.get("risk_weighted"), RiskWeightedStrategy)
        assert isinstance(reg.get("amount_first"), AmountFirstStrategy)
        assert len(reg.all()) == 3
        with pytest.raises(DomainValidationError):
            reg.get("invalid_key")


# ── Reminders Tests ───────────────────────────────────────────────────────────

class TestReminders:
    def test_tone_for_decision_matrix(self):
        rf = ReminderFactory()
        inv_current = make_invoice(due_days_ago=0)
        inv_current.send(NOW)
        assert rf.tone_for(inv_current, TODAY) == ReminderTone.POLITE

        inv_ovd_3d = make_invoice(due_days_ago=3)
        inv_ovd_3d.send(NOW)
        assert rf.tone_for(inv_ovd_3d, TODAY) == ReminderTone.POLITE

        inv_ovd_10d = make_invoice(due_days_ago=10)
        inv_ovd_10d.send(NOW)
        assert rf.tone_for(inv_ovd_10d, TODAY) == ReminderTone.FIRM

        inv_ovd_25d = make_invoice(issue_days_ago=35, due_days_ago=25)
        inv_ovd_25d.send(NOW)
        assert rf.tone_for(inv_ovd_25d, TODAY) == ReminderTone.FINAL

        # Higher reminder_level bumps tone severity
        inv_ovd_3d.reminder_level = 2
        assert rf.tone_for(inv_ovd_3d, TODAY) == ReminderTone.FINAL

    def test_reminder_template_method_rendering(self):
        rf = ReminderFactory()
        client = Client(name="Anita Desai", email="anita@greenleaf.com")
        inv = make_invoice(issue_days_ago=20, due_days_ago=12, invoice_number="DP-2026-0005")
        inv.send(NOW)
        inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "Price mismatch", "Anita", NOW)
        inv.record_promise(TODAY - timedelta(days=2), TODAY - timedelta(days=5), NOW)
        inv.check_promises(TODAY, NOW)

        reminder = rf.generate(inv, client, "Anupam", TODAY)
        assert reminder.tone == ReminderTone.FIRM
        assert "Payment overdue: invoice DP-2026-0005" in reminder.subject
        body = reminder.body

        # Verifies template parts
        assert "Dear Anita Desai," in body
        assert "12 days overdue" in body
        assert "I'm aware there is a question about the invoiced amount." in body
        assert "You had mentioned that payment would arrive by" in body
        assert "Please confirm a payment date by" in body
        assert "Regards,\nAnupam" in body


# ── Invoice Factory Tests ─────────────────────────────────────────────────────

class TestInvoiceFactory:
    def test_factory_auto_generates_formatted_number(self):
        repo = InMemoryInvoiceRepository()
        factory = InvoiceFactory(repo)
        inv1 = factory.create("c1", Money.of(1000), date(2026, 1, 1), date(2026, 1, 15), NOW)
        repo.save(inv1)
        assert inv1.invoice_number == "DP-2026-0001"

        inv2 = factory.create("c1", Money.of(2000), date(2026, 2, 1), date(2026, 2, 15), NOW)
        assert inv2.invoice_number == "DP-2026-0002"

    def test_factory_duplicate_invoice_number_raises(self):
        repo = InMemoryInvoiceRepository()
        factory = InvoiceFactory(repo)
        inv1 = factory.create("c1", Money.of(1000), date(2026, 1, 1), date(2026, 1, 15), NOW, invoice_number="DP-CUSTOM-1")
        repo.save(inv1)

        with pytest.raises(DuplicateInvoiceNumber):
            factory.create("c1", Money.of(1000), date(2026, 1, 1), date(2026, 1, 15), NOW, invoice_number="DP-CUSTOM-1")


# ── Importer Adapter and Chain Tests ──────────────────────────────────────────

class TestInvoiceImporter:
    def test_csv_adapter_missing_required_headers(self):
        csv_text = "client_name,client_email\nAlice,alice@example.com"
        source = InvoiceSourceFactory.for_format("csv", csv_text)
        assert len(source.file_errors()) > 0
        assert list(source.read_rows()) == []

    def test_validator_chain_catches_all_row_errors(self):
        inv_repo = InMemoryInvoiceRepository()
        v1 = RequiredFieldsValidator()
        v2 = ClientDataValidator()
        v3 = DateValidator()
        v4 = AmountValidator()
        v5 = StatusValidator()
        v6 = DuplicateInvoiceNumberValidator(inv_repo)
        v1.set_next(v2).set_next(v3).set_next(v4).set_next(v5).set_next(v6)

        # Invalid row: bad email, due before issue, negative amount, bad status
        bad_row = RawInvoiceRow(
            row_number=1,
            data={
                "client_name": "Bad Co",
                "client_email": "no-at-sign",
                "issue_date": "2026-05-10",
                "due_date": "2026-05-01",
                "total_amount": "-500",
                "status": "pending",
            },
        )
        ctx = ValidationContext()
        v1.validate(bad_row, ctx)
        assert any("Invalid client email" in e for e in ctx.errors)
        assert any("due_date" in e and "before issue_date" in e for e in ctx.errors)
        assert any("must be positive" in e for e in ctx.errors)
        assert any("Invalid status" in e for e in ctx.errors)

    def test_importer_mixed_file_partial_success(self):
        inv_repo = InMemoryInvoiceRepository()
        client_repo = InMemoryClientRepository()
        proj_repo = InMemoryProjectRepository()
        factory = InvoiceFactory(inv_repo)
        importer = InvoiceImporter(inv_repo, client_repo, proj_repo, factory)

        csv_content = """client_name,client_email,issue_date,due_date,total_amount,status,project_name
Alice Corp,alice@corp.com,2026-01-01,2026-01-15,50000,sent,Website Redesign
Bad Client,bademail,2026-01-01,2026-01-15,10000,sent,
Bob Ltd,bob@ltd.com,2026-02-01,2026-02-15,30000,draft,
Negative Co,neg@co.com,2026-01-01,2026-01-15,-200,sent,
"""
        source = CsvInvoiceSource(csv_content)
        res = importer.import_invoices(source, NOW)
        assert res.processed == 4
        assert res.imported == 2
        assert res.rejected == 2
        assert len(res.errors) == 2
        assert res.errors[0].row_number == 2
        assert res.errors[1].row_number == 4

        # Verify created aggregates
        assert client_repo.find_by_email("alice@corp.com") is not None
        assert client_repo.find_by_email("bob@ltd.com") is not None
        assert len(proj_repo.list_all()) == 1
        assert len(inv_repo.list_all()) == 2

    def test_auto_number_after_custom_number_import(self):
        inv_repo = InMemoryInvoiceRepository()
        factory = InvoiceFactory(inv_repo)
        # Import an invoice with custom number DP-2026-0002
        inv_custom = Invoice(
            invoice_number="DP-2026-0002",
            client_id="c1",
            total=Money(Decimal("100.00"), "USD"),
            issue_date=date(2026, 1, 1),
            due_date=date(2026, 1, 15),
            now=NOW,
        )
        inv_repo.save(inv_custom)

        # Factory generating a number should NOT collide with DP-2026-0002
        inv1 = factory.create(
            client_id="c1",
            total=Money(Decimal("200.00"), "USD"),
            issue_date=date(2026, 1, 1),
            due_date=date(2026, 1, 15),
            now=NOW,
        )
        inv_repo.save(inv1)
        assert inv1.invoice_number == "DP-2026-0003"

    def test_auto_number_is_monotonic(self):
        inv_repo = InMemoryInvoiceRepository()
        factory = InvoiceFactory(inv_repo)
        inv1 = factory.create("c1", Money(Decimal("100.00"), "USD"), date(2026, 1, 1), date(2026, 1, 15), NOW)
        inv_repo.save(inv1)
        inv2 = factory.create("c1", Money(Decimal("100.00"), "USD"), date(2026, 1, 1), date(2026, 1, 15), NOW)
        inv_repo.save(inv2)
        inv3 = factory.create("c1", Money(Decimal("100.00"), "USD"), date(2026, 1, 1), date(2026, 1, 15), NOW)
        inv_repo.save(inv3)
        assert [inv1.invoice_number, inv2.invoice_number, inv3.invoice_number] == [
            "DP-2026-0001",
            "DP-2026-0002",
            "DP-2026-0003",
        ]

    def test_sequence_ignores_non_matching_numbers(self):
        inv_repo = InMemoryInvoiceRepository()
        factory = InvoiceFactory(inv_repo)
        inv_custom = Invoice(
            invoice_number="INV-NW-01",
            client_id="c1",
            total=Money(Decimal("100.00"), "USD"),
            issue_date=date(2026, 1, 1),
            due_date=date(2026, 1, 15),
            now=NOW,
        )
        inv_repo.save(inv_custom)
        inv1 = factory.create("c1", Money(Decimal("200.00"), "USD"), date(2026, 1, 1), date(2026, 1, 15), NOW)
        inv_repo.save(inv1)
        assert inv1.invoice_number == "DP-2026-0001"
