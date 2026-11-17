"""Tests for Phase 3: EventBus, Listeners, ActionCenter, DailyCheck, Reports, and CollectionFacade."""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.application.action_center import ActionCenter
from app.application.clock import SimulatedClock
from app.application.daily_check import DailyCheckService
from app.application.event_bus import EventBus
from app.application.facade import CollectionFacade
from app.application.importing import InvoiceImporter
from app.application.invoice_factory import InvoiceFactory
from app.application.listeners import (
    ActionGenerationListener,
    AuditLogListener,
    NotificationListener,
    ReliabilityListener,
)
from app.application.playbook import ResolutionPlaybook
from app.application.prioritization import PrioritizationRegistry
from app.application.reminders import ReminderFactory
from app.application.reports import ReportService
from app.application.services.client_service import ClientService
from app.application.services.invoice_commands import InvoiceCommands
from app.application.services.reminder_service import ReminderService
from app.application.services.system_service import SystemService
from app.domain.enums import (
    ActionSource,
    ActionStatus,
    BlockerType,
    InvoiceStatus,
    PaymentMethod,
    Priority,
)
from app.domain.money import Money
from app.infrastructure.in_memory_repositories import (
    InMemoryAuditRepository,
    InMemoryClientRepository,
    InMemoryInvoiceRepository,
    InMemoryNotificationRepository,
    InMemoryProjectRepository,
    InMemorySettingsRepository,
)
from tests.domain.conftest import TODAY


@pytest.fixture
def env():
    """Create a fully wired Phase 3 application environment."""
    invoice_repo = InMemoryInvoiceRepository()
    client_repo = InMemoryClientRepository()
    project_repo = InMemoryProjectRepository()
    audit_repo = InMemoryAuditRepository()
    notification_repo = InMemoryNotificationRepository()
    settings_repo = InMemorySettingsRepository({
        "sender_name": "Test User",
        "default_currency": "INR",
        "simulated_date": "2026-11-10",
    })
    clock = SimulatedClock(settings_repo)
    bus = EventBus()

    playbook = ResolutionPlaybook()
    prio_reg = PrioritizationRegistry()
    reminder_factory = ReminderFactory()
    action_center = ActionCenter(invoice_repo, client_repo, prio_reg, clock, reminder_factory=reminder_factory)
    invoice_factory = InvoiceFactory(invoice_repo)
    importer = InvoiceImporter(invoice_repo, client_repo, project_repo, invoice_factory, bus)
    report_service = ReportService(invoice_repo, client_repo, settings_repo, clock)
    daily_check = DailyCheckService(invoice_repo, bus, clock)

    # Register listeners in specified order: Audit, ActionGeneration, Reliability, Notification
    audit_listener = AuditLogListener(audit_repo)
    action_listener = ActionGenerationListener(invoice_repo, client_repo, playbook, reminder_factory, clock, bus)
    reliability_listener = ReliabilityListener(client_repo)
    notification_listener = NotificationListener(notification_repo, clock)

    audit_listener.register(bus)
    action_listener.register(bus)
    reliability_listener.register(bus)
    notification_listener.register(bus)

    client_service = ClientService(client_repo, project_repo, invoice_repo, clock)
    invoice_commands = InvoiceCommands(invoice_repo, client_repo, project_repo, invoice_factory, bus, clock)
    reminder_service = ReminderService(reminder_factory, invoice_repo, client_repo, settings_repo, clock)
    system_service = SystemService(clock, settings_repo, audit_repo, notification_repo, daily_check)

    facade = CollectionFacade(
        invoice_commands=invoice_commands,
        client_service=client_service,
        reminder_service=reminder_service,
        system_service=system_service,
        report_service=report_service,
        action_center=action_center,
        invoice_importer=importer,
        invoice_repo=invoice_repo,
    )

    return {
        "facade": facade,
        "invoice_repo": invoice_repo,
        "client_repo": client_repo,
        "audit_repo": audit_repo,
        "notification_repo": notification_repo,
        "settings_repo": settings_repo,
        "clock": clock,
        "bus": bus,
        "action_center": action_center,
        "daily_check": daily_check,
        "report_service": report_service,
    }


# ── Event Flow & Listeners Tests ──────────────────────────────────────────────

class TestEventFlowAndListeners:
    def test_blocker_raised_creates_action_audit_and_notification(self, env):
        facade = env["facade"]
        client = facade.create_client("Bluepeak Agency", "rahul@bluepeak.com")
        inv = facade.create_invoice(
            client_id=client.id,
            total=Money.of(80_000),
            issue_date=TODAY - timedelta(days=20),
            due_date=TODAY - timedelta(days=5),
        )
        facade.send_invoice(inv.id)

        # Raise MISSING_PO blocker
        updated_inv = facade.raise_blocker(
            invoice_id=inv.id,
            type=BlockerType.MISSING_PO,
            description="Client did not issue PO",
            assigned_to="Rahul",
        )
        # ActionGenerationListener creates a HIGH priority blocker action
        actions = updated_inv.pending_actions()
        assert len(actions) == 1
        assert actions[0].priority == Priority.HIGH
        assert actions[0].source == ActionSource.BLOCKER
        assert "missing purchase order" in actions[0].description

        # Audit listener logged it
        audits = facade.list_audit(invoice_id=inv.id)
        assert any(a.event_type == "BlockerRaised" for a in audits)

        # Notification listener recorded it
        notifs = facade.list_notifications()
        assert any("blocker raised" in n.message.lower() for n in notifs)

    def test_blocker_resolved_cancels_generated_action(self, env):
        facade = env["facade"]
        client = facade.create_client("Orbit Labs", "karan@orbit.com")
        inv = facade.create_invoice(
            client_id=client.id,
            total=Money.of(50_000),
            issue_date=TODAY - timedelta(days=10),
            due_date=TODAY + timedelta(days=10),
        )
        facade.send_invoice(inv.id)

        inv = facade.raise_blocker(inv.id, BlockerType.WRONG_DETAILS, "Incorrect tax ID")
        assert len(inv.pending_actions()) == 1
        blocker_id = inv.blockers[0].id

        # Resolve blocker
        resolved_inv = facade.resolve_blocker(inv.id, blocker_id)
        assert len(resolved_inv.pending_actions()) == 0
        assert resolved_inv.actions[0].status == ActionStatus.CANCELLED

    def test_promise_missed_creates_action_updates_reliability_and_notifies(self, env):
        facade = env["facade"]
        client = facade.create_client("Bluepeak Agency", "rahul@bluepeak.com")
        inv = facade.create_invoice(
            client_id=client.id,
            total=Money.of(20_000),
            issue_date=TODAY - timedelta(days=30),
            due_date=TODAY - timedelta(days=10),
        )
        facade.send_invoice(inv.id)

        # Record promise for today
        facade.record_promise(inv.id, promised_date=TODAY, note="Check will clear")

        # Simulate date advancing to tomorrow (promise is now missed)
        facade.set_simulated_date(TODAY + timedelta(days=1))

        # Run daily check
        summary = facade.run_daily_check()
        assert summary.promises_missed == 1

        # Check invoice has promise-missed action
        updated_inv = facade.get_invoice(inv.id)
        pm_actions = [a for a in updated_inv.actions if a.source == ActionSource.PROMISE_MISSED]
        assert len(pm_actions) == 1
        assert pm_actions[0].priority == Priority.HIGH
        assert "Follow up with Bluepeak Agency" in pm_actions[0].description
        assert "FIRM" not in pm_actions[0].description

        # Reliability listener reduced client score
        updated_client, _, _ = facade.get_client_summary(client.id)
        assert updated_client.promises_missed == 1
        assert updated_client.reliability_score() == 0
        assert updated_client.risk_level() == "HIGH"

        # Notification recorded
        notifs = facade.list_notifications()
        assert any("promise for" in n.message.lower() and "missed" in n.message.lower() for n in notifs)

    def test_invoice_became_overdue_action_generated(self, env):
        facade = env["facade"]
        client = facade.create_client("Sunrise Retail", "meera@sunrise.com")
        # Due yesterday, not yet notified
        inv = facade.create_invoice(
            client_id=client.id,
            total=Money.of(22_000),
            issue_date=TODAY - timedelta(days=40),
            due_date=TODAY - timedelta(days=1),
        )
        facade.send_invoice(inv.id)

        summary = facade.run_daily_check()
        assert summary.newly_overdue == 1

        updated_inv = facade.get_invoice(inv.id)
        ovd_actions = [a for a in updated_inv.actions if a.source == ActionSource.OVERDUE]
        assert len(ovd_actions) == 1
        assert "Send a reminder to" in ovd_actions[0].description
        assert "is 1 days overdue" not in ovd_actions[0].description

    def test_invoice_paid_cancels_all_pending_actions(self, env):
        facade = env["facade"]
        client = facade.create_client("Northwind", "priya@northwind.com")
        inv = facade.create_invoice(
            client_id=client.id,
            total=Money.of(30_000),
            issue_date=TODAY - timedelta(days=15),
            due_date=TODAY + timedelta(days=5),
        )
        facade.send_invoice(inv.id)
        facade.add_manual_action(inv.id, "Send contract", Priority.LOW, TODAY)
        inv = facade.raise_blocker(inv.id, BlockerType.AWAITING_APPROVAL, "Waiting on board")

        assert len(inv.pending_actions()) == 2

        # Full payment
        paid_inv = facade.record_payment(
            invoice_id=inv.id,
            amount=Money.of(30_000),
            payment_date=TODAY,
            method=PaymentMethod.BANK_TRANSFER,
        )
        assert paid_inv.status == InvoiceStatus.PAID
        assert len(paid_inv.pending_actions()) == 0
        assert all(a.status == ActionStatus.CANCELLED for a in paid_inv.actions)

    def test_daily_check_idempotency(self, env):
        facade = env["facade"]
        client = facade.create_client("Client", "c@test.com")
        inv = facade.create_invoice(
            client_id=client.id,
            total=Money.of(15_000),
            issue_date=TODAY - timedelta(days=20),
            due_date=TODAY - timedelta(days=5),
        )
        facade.send_invoice(inv.id)
        facade.record_promise(inv.id, promised_date=TODAY)
        # Move simulated date forward by 1 day
        facade.set_simulated_date(TODAY + timedelta(days=1))

        # First run detects 1 missed promise & 1 overdue invoice
        s1 = facade.run_daily_check()
        assert s1.promises_missed == 1
        assert s1.newly_overdue == 1

        # Second run immediately after detects 0
        s2 = facade.run_daily_check()
        assert s2.promises_missed == 0
        assert s2.newly_overdue == 0


# ── Action Centre & Dashboard Tests ───────────────────────────────────────────

class TestActionCenterAndDashboard:
    def test_action_center_returns_ranked_items_and_upcoming(self, env):
        facade = env["facade"]
        client = facade.create_client("Client A", "a@test.com")
        inv = facade.create_invoice(
            client_id=client.id,
            total=Money.of(45_000),
            issue_date=TODAY - timedelta(days=10),
            due_date=TODAY + timedelta(days=5),
        )
        facade.send_invoice(inv.id)

        # Action 1 due today
        facade.add_manual_action(inv.id, "Call contact", Priority.HIGH, TODAY)
        # Action 2 due in 3 days (upcoming)
        facade.add_manual_action(inv.id, "Follow up next week", Priority.LOW, TODAY + timedelta(days=3))

        ac_view = facade.get_action_center(strategy_key="risk_weighted")
        assert len(ac_view.items) == 1
        assert ac_view.items[0].invoice_number == inv.invoice_number
        assert ac_view.items[0].score > 0

        assert len(ac_view.upcoming) == 1
        assert ac_view.upcoming[0].action.due_date == TODAY + timedelta(days=3)

    def test_reports_dashboard_generation(self, env):
        facade = env["facade"]
        c1 = facade.create_client("Alpha Co", "alpha@test.com")
        c2 = facade.create_client("Beta Co", "beta@test.com")

        inv1 = facade.create_invoice(c1.id, Money.of(100_000), TODAY - timedelta(days=40), TODAY - timedelta(days=10))
        facade.send_invoice(inv1.id)

        inv2 = facade.create_invoice(c2.id, Money.of(50_000), TODAY - timedelta(days=20), TODAY + timedelta(days=10))
        facade.send_invoice(inv2.id)

        # Record payment on inv2
        facade.record_payment(inv2.id, Money.of(20_000), TODAY, PaymentMethod.UPI)

        report = facade.get_dashboard()
        assert report.active_count == 2
        assert report.total_outstanding == Money.of(130_000)
        assert report.total_overdue == Money.of(100_000)
        assert report.overdue_count == 1
        assert report.collected_this_month == Money.of(20_000)
        assert len(report.aging) == 5
        assert len(report.collection_trend) == 6
        assert len(report.top_debtors) == 2
        assert report.top_debtors[0].name == "Alpha Co"
        assert report.top_debtors[0].outstanding == Money.of(100_000)


# ── Facade Settings & System Tests ────────────────────────────────────────────

class TestFacadeSystemSettings:
    def test_time_travel_demo_date(self, env):
        facade = env["facade"]
        assert facade.get_today()["simulated"] is True

        facade.set_simulated_date(date(2027, 1, 1))
        assert facade.get_today()["today"] == "2027-01-01"
        assert facade.get_today()["simulated"] is True

        facade.set_simulated_date(None)
        assert facade.get_today()["simulated"] is False

    def test_settings_update(self, env):
        facade = env["facade"]
        facade.update_settings(sender_name="Anupam", default_currency="USD")
        st = facade.get_settings()
        assert st["sender_name"] == "Anupam"
        assert st["default_currency"] == "USD"

    def test_no_action_created_for_paid_invoice_on_promise_missed(self, env):
        facade = env["facade"]
        clock = env["clock"]
        # Create client & invoice
        client_dto = facade.create_client(name="Beta Corp", email="beta@corp.com")
        inv_dto = facade.create_invoice(
            client_id=client_dto.id,
            total=Money.of(500),
            issue_date=clock.today() - timedelta(days=10),
            due_date=clock.today() - timedelta(days=5),
        )
        facade.send_invoice(inv_dto.id)
        # Record a promise for tomorrow
        tomorrow = clock.today() + timedelta(days=1)
        facade.record_promise(inv_dto.id, promised_date=tomorrow)

        # Advance simulated date past promise
        late_date = clock.today() + timedelta(days=5)
        facade.set_simulated_date(late_date)

        # Fully pay on late date
        facade.record_payment(
            invoice_id=inv_dto.id,
            amount=Money.of(500),
            payment_date=late_date,
            method=PaymentMethod.BANK_TRANSFER,
        )

        inv_after = facade.get_invoice(inv_dto.id)
        assert inv_after.status.name == "PAID"
        # No pending actions should exist for this paid invoice
        pending_actions = [a for a in inv_after.actions if a.status.name == "PENDING"]
        assert len(pending_actions) == 0

        # Client reliability has broken promise recorded
        client_after, _, _ = facade.get_client_summary(client_dto.id)
        assert client_after.promises_missed == 1

    def test_open_blockers_report_ignores_closed_invoices(self, env):
        facade = env["facade"]
        client_dto = facade.create_client(name="Gamma Corp", email="gamma@corp.com")
        inv_dto = facade.create_invoice(
            client_id=client_dto.id,
            total=Money.of(500),
            issue_date=date(2026, 1, 1),
            due_date=date(2026, 1, 15),
        )
        facade.send_invoice(inv_dto.id)
        # Raise blocker
        facade.raise_blocker(inv_dto.id, BlockerType.MISSING_PO, "need PO")

        # Report before payment shows 1 MISSING_PO blocker
        rep1 = facade.get_dashboard()
        assert rep1.open_blockers_by_type.get("MISSING_PO") >= 1

        # Fully settle invoice
        facade.record_payment(
            invoice_id=inv_dto.id,
            amount=Money.of(500),
            payment_date=env["clock"].today(),
            method=PaymentMethod.BANK_TRANSFER,
        )

        rep2 = facade.get_dashboard()
        # Open blockers on closed invoice should be resolved / not counted
        assert rep2.open_blockers_by_type.get("MISSING_PO") == 0

    def test_facade_create_client_duplicate_email_raises_duplicate_client(self, env):
        from app.domain.exceptions import DuplicateClient
        facade = env["facade"]
        facade.create_client(name="Original", email="same@company.com")
        with pytest.raises(DuplicateClient):
            facade.create_client(name="Duplicate", email="SAME@company.com")

    def test_facade_update_client_duplicate_email_raises_duplicate_client(self, env):
        from app.domain.exceptions import DuplicateClient
        facade = env["facade"]
        facade.create_client(name="Client 1", email="c1@company.com")
        c2 = facade.create_client(name="Client 2", email="c2@company.com")
        with pytest.raises(DuplicateClient):
            facade.update_client(c2.id, email="C1@company.com")

    def test_no_duplicate_overdue_action_after_refire(self, env):
        facade = env["facade"]
        clock = env["clock"]
        client_dto = facade.create_client(name="Refire Corp", email="refire@corp.com")
        inv_dto = facade.create_invoice(
            client_id=client_dto.id,
            total=Money.of(1000),
            issue_date=clock.today() - timedelta(days=20),
            due_date=clock.today() - timedelta(days=5),
        )
        facade.send_invoice(inv_dto.id)

        # Run daily check: invoice is overdue, creates an action
        facade.run_daily_check()
        inv1 = facade.get_invoice(inv_dto.id)
        overdue_actions = [a for a in inv1.actions if a.source.name == "OVERDUE" and a.status.name == "PENDING"]
        assert len(overdue_actions) == 1

        # Simulate date reset, flag reset, and refire
        inv_domain = env["invoice_repo"].get(inv_dto.id)
        inv_domain.overdue_notified = False
        env["invoice_repo"].save(inv_domain)

        facade.run_daily_check()
        inv2 = facade.get_invoice(inv_dto.id)
        overdue_actions2 = [a for a in inv2.actions if a.source.name == "OVERDUE" and a.status.name == "PENDING"]
        # Must still be exactly 1, not duplicated!
        assert len(overdue_actions2) == 1

    def test_overdue_action_description_has_no_changing_numbers(self, env):
        import re
        facade = env["facade"]
        clock = env["clock"]
        client = facade.create_client(name="Stable Desc Ltd", email="stable@desc.com")
        inv = facade.create_invoice(
            client_id=client.id,
            total=Money.of(5000),
            issue_date=clock.today() - timedelta(days=35),
            due_date=clock.today() - timedelta(days=12),
        )
        facade.send_invoice(inv.id)
        facade.run_daily_check()

        updated_inv = facade.get_invoice(inv.id)
        ovd_actions = [a for a in updated_inv.actions if a.source == ActionSource.OVERDUE]
        assert len(ovd_actions) == 1
        desc = ovd_actions[0].description
        assert "Send a reminder to" in desc
        assert "days overdue" not in desc
        assert not any(t in desc for t in ["POLITE", "FIRM", "FINAL"])
        # Excluding static invoice number, no changing numbers/digits exist
        desc_without_inv = desc.replace(updated_inv.invoice_number, "")
        assert not re.search(r"\d", desc_without_inv)

    def test_action_center_item_suggested_tone_matches_factory(self, env):
        facade = env["facade"]
        clock = env["clock"]
        client = facade.create_client(name="Tone Test Client", email="tone@client.com")
        inv = facade.create_invoice(
            client_id=client.id,
            total=Money.of(15000),
            issue_date=clock.today() - timedelta(days=50),
            due_date=clock.today() - timedelta(days=15),
        )
        facade.send_invoice(inv.id)
        facade.run_daily_check()

        view = facade.get_action_center()
        matched = [item for item in view.items if item.invoice_id == inv.id]
        assert len(matched) == 1
        assert matched[0].suggested_tone is not None
        assert matched[0].suggested_tone in ("POLITE", "FIRM", "FINAL")
