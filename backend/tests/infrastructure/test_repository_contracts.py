"""Contract tests parameterized to execute against both InMemory and SQLite repositories."""
from __future__ import annotations
from datetime import date, datetime, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.domain.audit import AuditEvent, Notification
from app.domain.client import Client
from app.domain.document import SupportingDocument
from app.domain.enums import (
    ActionSource, BlockerType, Channel, DocumentType, FollowUpOutcome,
    InvoiceStatus, PaymentMethod, Priority,
)
from app.domain.exceptions import EntityNotFound
from app.domain.invoice import Invoice
from app.domain.money import Money
from app.domain.next_action import NextAction
from app.domain.payment import Payment
from app.domain.project import Project
from app.infrastructure.db import Base
from app.infrastructure.in_memory_repositories import (
    InMemoryAuditRepository, InMemoryClientRepository,
    InMemoryInvoiceRepository, InMemoryNotificationRepository,
    InMemoryProjectRepository, InMemorySettingsRepository,
)
from app.infrastructure.sqlalchemy_repositories import (
    SqlAlchemyAuditRepository, SqlAlchemyClientRepository,
    SqlAlchemyInvoiceRepository, SqlAlchemyNotificationRepository,
    SqlAlchemyProjectRepository, SqlAlchemySettingsRepository,
)
from tests.domain.conftest import NOW, TODAY


@pytest.fixture(params=["in_memory", "sqlite"])
def repo_bundle(request):
    """Yield a repository bundle configured for either InMemory or in-memory SQLite."""
    if request.param == "in_memory":
        return {
            "invoice_repo": InMemoryInvoiceRepository(),
            "client_repo": InMemoryClientRepository(),
            "project_repo": InMemoryProjectRepository(),
            "audit_repo": InMemoryAuditRepository(),
            "notification_repo": InMemoryNotificationRepository(),
            "settings_repo": InMemorySettingsRepository(),
            "backend": "in_memory",
        }
    else:
        # SQLite in-memory test database
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(bind=engine)
        session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        return {
            "invoice_repo": SqlAlchemyInvoiceRepository(session_factory),
            "client_repo": SqlAlchemyClientRepository(session_factory),
            "project_repo": SqlAlchemyProjectRepository(session_factory),
            "audit_repo": SqlAlchemyAuditRepository(session_factory),
            "notification_repo": SqlAlchemyNotificationRepository(session_factory),
            "settings_repo": SqlAlchemySettingsRepository(session_factory),
            "backend": "sqlite",
        }


# ── Client Repository Contract ────────────────────────────────────────────────

class TestClientRepositoryContract:
    def test_client_crud_roundtrip(self, repo_bundle):
        repo = repo_bundle["client_repo"]
        client = Client(name="Zeta Corp", email="zeta@corp.com", phone="123", company_name="Zeta Inc", created_at=NOW)
        repo.save(client)

        loaded = repo.get(client.id)
        assert loaded.id == client.id
        assert loaded.name == "Zeta Corp"
        assert loaded.email == "zeta@corp.com"
        assert loaded.phone == "123"
        assert loaded.company_name == "Zeta Inc"

        by_email = repo.find_by_email("ZETA@corp.com")
        assert by_email is not None
        assert by_email.id == client.id

        assert len(repo.list_all()) == 1

        with pytest.raises(EntityNotFound):
            repo.get("nonexistent_client_id")

    def test_client_repository_case_insensitive_lookup_and_unique(self, repo_bundle):
        repo = repo_bundle["client_repo"]
        c1 = Client(name="Case Alpha", email="alpha@test.com")
        repo.save(c1)

        # Lookup with mixed case
        assert repo.find_by_email("ALPHA@test.com") is not None
        assert repo.find_by_email("  alpha@test.com  ") is not None


# ── Project Repository Contract ───────────────────────────────────────────────

class TestProjectRepositoryContract:
    def test_project_crud_and_client_filtering(self, repo_bundle):
        c_repo = repo_bundle["client_repo"]
        p_repo = repo_bundle["project_repo"]

        c1 = Client("C1", "c1@test.com")
        c2 = Client("C2", "c2@test.com")
        c_repo.save(c1)
        c_repo.save(c2)

        p1 = Project(client_id=c1.id, project_name="Portal Redesign", start_date=TODAY)
        p2 = Project(client_id=c1.id, project_name="App Build", start_date=TODAY)
        p3 = Project(client_id=c2.id, project_name="SEO", start_date=TODAY)

        p_repo.save(p1)
        p_repo.save(p2)
        p_repo.save(p3)

        assert len(p_repo.list_all()) == 3
        c1_projs = p_repo.list_by_client(c1.id)
        assert len(c1_projs) == 2
        assert {p.project_name for p in c1_projs} == {"Portal Redesign", "App Build"}

        loaded = p_repo.get(p1.id)
        assert loaded.project_name == "Portal Redesign"

        with pytest.raises(EntityNotFound):
            p_repo.get("nonexistent_project_id")


# ── Invoice Aggregate Repository Contract ─────────────────────────────────────

class TestInvoiceRepositoryContract:
    def test_full_aggregate_roundtrip(self, repo_bundle):
        c_repo = repo_bundle["client_repo"]
        p_repo = repo_bundle["project_repo"]
        inv_repo = repo_bundle["invoice_repo"]

        client = Client("Gamma LLC", "gamma@llc.com")
        c_repo.save(client)
        proj = Project(client_id=client.id, project_name="Consulting", start_date=TODAY)
        p_repo.save(proj)

        inv = Invoice(
            invoice_number="DP-2026-0099",
            client_id=client.id,
            total=Money.of(100_000),
            issue_date=TODAY - timedelta(days=20),
            due_date=TODAY - timedelta(days=5),
            now=NOW,
            project_id=proj.id,
        )
        inv.send(NOW)

        # Add child collections across all 6 domains
        # 1. Payment
        inv.record_payment(Payment(Money.of(25_000), TODAY - timedelta(days=2), PaymentMethod.UPI, NOW), TODAY, NOW)
        # 2. Blocker
        inv.raise_blocker(BlockerType.AWAITING_APPROVAL, "Pending CEO sign-off", "CEO", NOW)
        # 3. Promise
        inv.record_promise(TODAY + timedelta(days=5), TODAY, NOW, amount=Money.of(75_000), note="Wire pending")
        # 4. Follow-up
        inv.log_follow_up(NOW, Channel.EMAIL, "Sent reminder email", FollowUpOutcome.ACKNOWLEDGED, NOW)
        # 5. Document
        doc = SupportingDocument(DocumentType.PURCHASE_ORDER, "po_99.pdf", "/files/po_99.pdf", NOW)
        inv.attach_document(doc, NOW)
        # 6. Action
        inv.add_action(NextAction("Check bank status", Priority.MEDIUM, TODAY, ActionSource.MANUAL, NOW))

        inv_repo.save(inv)

        # Reload full aggregate
        loaded = inv_repo.get(inv.id)
        assert loaded.id == inv.id
        assert loaded.invoice_number == "DP-2026-0099"
        assert loaded.client_id == client.id
        assert loaded.project_id == proj.id
        assert loaded.status == InvoiceStatus.PARTIALLY_PAID
        assert loaded.outstanding() == Money.of(75_000)
        assert loaded.amount_paid() == Money.of(25_000)

        # Assert all child collections reconstituted with exact counts and properties
        assert len(loaded.payments) == 1
        assert loaded.payments[0].amount == Money.of(25_000)
        assert loaded.payments[0].method == PaymentMethod.UPI

        assert len(loaded.blockers) == 1
        assert loaded.blockers[0].type == BlockerType.AWAITING_APPROVAL
        assert loaded.blockers[0].assigned_to == "CEO"

        assert len(loaded.promises) == 1
        assert loaded.promises[0].amount == Money.of(75_000)

        assert len(loaded.follow_ups) == 1
        assert loaded.follow_ups[0].channel == Channel.EMAIL

        assert len(loaded.documents) == 1
        assert loaded.documents[0].file_name == "po_99.pdf"

        assert len(loaded.actions) == 1
        assert loaded.actions[0].description == "Check bank status"

    def test_child_collection_deletion_on_save(self, repo_bundle):
        c_repo = repo_bundle["client_repo"]
        inv_repo = repo_bundle["invoice_repo"]

        client = Client("Delta Co", "delta@test.com")
        c_repo.save(client)

        inv = Invoice(
            invoice_number="DP-2026-0100",
            client_id=client.id,
            total=Money.of(40_000),
            issue_date=TODAY,
            due_date=TODAY + timedelta(days=15),
            now=NOW,
        )
        inv.send(NOW)

        doc1 = SupportingDocument(DocumentType.INVOICE_COPY, "inv.pdf", "/files/inv.pdf", NOW)
        doc2 = SupportingDocument(DocumentType.CONTRACT, "contract.pdf", "/files/c.pdf", NOW)
        inv.attach_document(doc1, NOW)
        inv.attach_document(doc2, NOW)
        inv_repo.save(inv)

        assert len(inv_repo.get(inv.id).documents) == 2

        # Remove one document and save
        inv.remove_document(doc1.id)
        inv_repo.save(inv)

        reloaded = inv_repo.get(inv.id)
        assert len(reloaded.documents) == 1
        assert reloaded.documents[0].id == doc2.id

    def test_next_invoice_sequence(self, repo_bundle):
        c_repo = repo_bundle["client_repo"]
        inv_repo = repo_bundle["invoice_repo"]

        client = Client("Seq Co", "seq@test.com")
        c_repo.save(client)

        assert inv_repo.next_invoice_sequence(2026) == 1

        inv1 = Invoice("DP-2026-0001", client.id, Money.of(1000), TODAY, TODAY, NOW)
        inv_repo.save(inv1)
        assert inv_repo.next_invoice_sequence(2026) == 2

        inv2 = Invoice("DP-2026-0002", client.id, Money.of(2000), TODAY, TODAY, NOW)
        inv_repo.save(inv2)
        assert inv_repo.next_invoice_sequence(2026) == 3

        # Different year starts sequence at 1
        assert inv_repo.next_invoice_sequence(2027) == 1

    def test_list_active_filters_terminal_states(self, repo_bundle):
        c_repo = repo_bundle["client_repo"]
        inv_repo = repo_bundle["invoice_repo"]
        client = Client("Filter Co", "filt@test.com")
        c_repo.save(client)

        # Draft
        inv_draft = Invoice("DP-2026-0010", client.id, Money.of(1000), TODAY, TODAY, NOW)
        # Sent
        inv_sent = Invoice("DP-2026-0011", client.id, Money.of(2000), TODAY, TODAY, NOW)
        inv_sent.send(NOW)
        # Paid
        inv_paid = Invoice("DP-2026-0012", client.id, Money.of(3000), TODAY, TODAY, NOW)
        inv_paid.send(NOW)
        inv_paid.record_payment(Payment(Money.of(3000), TODAY, PaymentMethod.CASH, NOW), TODAY, NOW)

        inv_repo.save(inv_draft)
        inv_repo.save(inv_sent)
        inv_repo.save(inv_paid)

        active = inv_repo.list_active()
        assert len(active) == 1
        assert active[0].invoice_number == "DP-2026-0011"


# ── Audit, Notification, Settings Repository Contracts ────────────────────────

class TestAuxiliaryRepositoriesContract:
    def test_audit_repository_ordering_and_filtering(self, repo_bundle):
        repo = repo_bundle["audit_repo"]
        ev1 = AuditEvent("InvoiceSent", "Sent invoice 1", NOW - timedelta(seconds=10), invoice_id="inv-1")
        ev2 = AuditEvent("PaymentReceived", "Paid invoice 1", NOW - timedelta(seconds=5), invoice_id="inv-1")
        ev3 = AuditEvent("InvoiceSent", "Sent invoice 2", NOW, invoice_id="inv-2")

        repo.add(ev1)
        repo.add(ev2)
        repo.add(ev3)

        all_events = repo.list()
        assert len(all_events) == 3
        # Newest first
        assert all_events[0].invoice_id == "inv-2"

        inv1_events = repo.list(invoice_id="inv-1")
        assert len(inv1_events) == 2
        assert inv1_events[0].event_type == "PaymentReceived"

    def test_notification_repository_read_management(self, repo_bundle):
        repo = repo_bundle["notification_repo"]
        n1 = Notification("Alert 1", NOW)
        n2 = Notification("Alert 2", NOW)
        repo.add(n1)
        repo.add(n2)

        assert len(repo.list(unread_only=True)) == 2
        repo.mark_all_read()
        assert len(repo.list(unread_only=True)) == 0
        assert len(repo.list(unread_only=False)) == 2

    def test_settings_repository(self, repo_bundle):
        repo = repo_bundle["settings_repo"]
        assert repo.get("custom_key", "default_val") == "default_val"
        repo.set("custom_key", "stored_val")
        assert repo.get("custom_key") == "stored_val"

    def test_next_invoice_sequence_uses_max_suffix(self, repo_bundle):
        repo = repo_bundle["invoice_repo"]
        # Empty repo starts at 1
        assert repo.next_invoice_sequence(2026) == 1

        # Save an invoice with custom high sequence DP-2026-0005
        from decimal import Decimal
        inv = Invoice(
            invoice_number="DP-2026-0005",
            client_id="c1",
            total=Money(Decimal("100.00"), "USD"),
            issue_date=date(2026, 1, 1),
            due_date=date(2026, 1, 15),
            now=NOW,
        )
        repo.save(inv)

        # Non-matching invoice number should be ignored
        inv_custom = Invoice(
            invoice_number="INV-NW-01",
            client_id="c1",
            total=Money(Decimal("200.00"), "USD"),
            issue_date=date(2026, 1, 1),
            due_date=date(2026, 1, 15),
            now=NOW,
        )
        repo.save(inv_custom)

        # Must return 6 (1 + max(5)) despite only 2 total invoices
        assert repo.next_invoice_sequence(2026) == 6
