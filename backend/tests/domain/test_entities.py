"""Unit tests for Client, Project, NextAction, SupportingDocument, AuditEvent, Notification."""
from __future__ import annotations

from datetime import timedelta

import pytest

from app.domain.audit import AuditEvent, Notification
from app.domain.client import Client
from app.domain.document import SupportingDocument
from app.domain.enums import (
    ActionSource,
    ActionStatus,
    DocumentType,
    PaymentMethod,
    Priority,
)
from app.domain.exceptions import DomainValidationError, InvalidStateTransition
from app.domain.money import Money
from app.domain.next_action import NextAction
from app.domain.payment import Payment
from app.domain.project import Project
from tests.domain.conftest import NOW, TODAY, make_invoice


class TestClientUnit:
    def test_client_init_and_properties(self):
        c = Client(
            name="Acme Corp",
            email="finance@acme.com",
            phone="+919876543210",
            company_name="Acme International",
            created_at=NOW,
        )
        assert c.name == "Acme Corp"
        assert c.email == "finance@acme.com"
        assert c.phone == "+919876543210"
        assert c.company_name == "Acme International"
        assert c.promises_kept == 0
        assert c.promises_missed == 0
        assert c.reliability_score() == 100
        assert c.risk_level() == "LOW"

    def test_client_empty_name_raises(self):
        with pytest.raises(DomainValidationError):
            Client(name="", email="test@example.com")
        with pytest.raises(DomainValidationError):
            Client(name="   ", email="test@example.com")

    def test_client_invalid_email_raises(self):
        with pytest.raises(DomainValidationError):
            Client(name="Alice", email="invalid-email")

    def test_update_contact_details(self):
        c = Client(name="Old Name", email="old@example.com")
        c.update_contact_details(
            name="New Name",
            email="new@example.com",
            phone="123456",
            company_name="New Co",
        )
        assert c.name == "New Name"
        assert c.email == "new@example.com"
        assert c.phone == "123456"
        assert c.company_name == "New Co"

    def test_client_email_normalisation(self):
        c = Client(name="Case Client", email="  Finance@ACME.COM  ")
        assert c.email == "finance@acme.com"

        c.update_contact_details(email="  Billing@Acme.Org  ")
        assert c.email == "billing@acme.org"

    def test_update_contact_details_validation(self):
        c = Client(name="Old Name", email="old@example.com")
        with pytest.raises(DomainValidationError):
            c.update_contact_details(name="  ")
        with pytest.raises(DomainValidationError):
            c.update_contact_details(email="notanemail")

    def test_reliability_scoring_and_risk(self):
        c = Client(name="Client A", email="a@example.com")
        # 100 with no promises
        assert c.reliability_score() == 100
        assert c.risk_level() == "LOW"

        # 4 kept, 1 missed = 80% -> LOW
        for _ in range(4):
            c.register_promise_kept()
        c.register_promise_missed()
        assert c.reliability_score() == 80
        assert c.risk_level() == "LOW"

        # 4 kept, 3 missed = 4/7 = 57% -> MEDIUM
        c.register_promise_missed()
        c.register_promise_missed()
        assert c.reliability_score() == 57
        assert c.risk_level() == "MEDIUM"

        # 4 kept, 6 missed = 4/10 = 40% -> HIGH
        for _ in range(3):
            c.register_promise_missed()
        assert c.reliability_score() == 40
        assert c.risk_level() == "HIGH"

    def test_outstanding_balance(self):
        c = Client(name="Client A", email="a@example.com")
        inv1 = make_invoice(total_amount=50_000, invoice_number="DP-1")
        inv1.send(NOW)
        inv2 = make_invoice(total_amount=30_000, invoice_number="DP-2")
        inv2.send(NOW)
        # Draft invoice should not be counted
        inv_draft = make_invoice(total_amount=20_000, invoice_number="DP-3")
        # Paid invoice should have 0 outstanding
        inv_paid = make_invoice(total_amount=10_000, invoice_number="DP-4")
        inv_paid.send(NOW)
        inv_paid.record_payment(
            Payment(Money.of(10_000), TODAY, PaymentMethod.BANK_TRANSFER, NOW),
            TODAY, NOW
        )

        bal = c.outstanding_balance([inv1, inv2, inv_draft, inv_paid])
        assert bal == Money.of(80_000)

    def test_reconstitute_client(self):
        c = Client.reconstitute(
            id="c123",
            name="Restored",
            email="restored@example.com",
            phone="999",
            company_name="Restored Inc",
            promises_kept=5,
            promises_missed=2,
            created_at=NOW,
        )
        assert c.id == "c123"
        assert c.name == "Restored"
        assert c.promises_kept == 5


class TestProjectUnit:
    def test_project_init_and_methods(self):
        p = Project(
            client_id="c1",
            project_name="Web Redesign",
            start_date=TODAY,
            description="Full revamp",
            status="Active",
        )
        assert p.project_name == "Web Redesign"
        assert p.status == "Active"

        p.rename("Mobile App")
        assert p.project_name == "Mobile App"

        p.update_status("Completed")
        assert p.status == "Completed"

    def test_project_empty_name_raises(self):
        with pytest.raises(DomainValidationError):
            Project(client_id="c1", project_name="", start_date=TODAY)
        p = Project(client_id="c1", project_name="Valid", start_date=TODAY)
        with pytest.raises(DomainValidationError):
            p.rename("   ")

    def test_reconstitute_project(self):
        p = Project.reconstitute(
            id="p123",
            client_id="c1",
            project_name="Archived",
            description="Old",
            start_date=TODAY,
            status="Done",
        )
        assert p.id == "p123"
        assert p.status == "Done"


class TestNextActionUnit:
    def test_action_lifecycle(self):
        act = NextAction(
            description="Follow up on PO",
            priority=Priority.HIGH,
            due_date=TODAY,
            source=ActionSource.BLOCKER,
            created_at=NOW,
            source_ref="b1",
        )
        assert act.is_due_today(TODAY)
        assert act.is_actionable(TODAY)
        assert not act.is_overdue(TODAY)

        # Due yesterday -> is_overdue
        yesterday = TODAY - timedelta(days=1)
        act_yesterday = NextAction(
            description="Old task",
            priority=Priority.MEDIUM,
            due_date=yesterday,
            source=ActionSource.MANUAL,
            created_at=NOW,
        )
        assert act_yesterday.is_overdue(TODAY)
        assert act_yesterday.is_actionable(TODAY)

        # Complete
        act.mark_completed(NOW)
        assert act.status == ActionStatus.COMPLETED
        assert act.completed_at == NOW
        with pytest.raises(InvalidStateTransition):
            act.mark_completed(NOW)

    def test_reschedule(self):
        tomorrow = TODAY + timedelta(days=1)
        act = NextAction(
            description="Task",
            priority=Priority.LOW,
            due_date=TODAY,
            source=ActionSource.MANUAL,
            created_at=NOW,
        )
        act.reschedule(tomorrow, TODAY)
        assert act.due_date == tomorrow

        # Reschedule to the past raises
        yesterday = TODAY - timedelta(days=1)
        with pytest.raises(DomainValidationError):
            act.reschedule(yesterday, TODAY)

        # Reschedule completed raises
        act.mark_completed(NOW)
        with pytest.raises(InvalidStateTransition):
            act.reschedule(tomorrow, TODAY)

    def test_cancel(self):
        act = NextAction(
            description="Task",
            priority=Priority.LOW,
            due_date=TODAY,
            source=ActionSource.MANUAL,
            created_at=NOW,
        )
        act.cancel()
        assert act.status == ActionStatus.CANCELLED

    def test_reconstitute_next_action(self):
        act = NextAction.reconstitute(
            id="a1",
            description="Reconstituted",
            priority=Priority.CRITICAL,
            due_date=TODAY,
            status=ActionStatus.COMPLETED,
            source=ActionSource.BLOCKER,
            source_ref="b1",
            created_at=NOW,
            completed_at=NOW,
        )
        assert act.id == "a1"
        assert act.priority == Priority.CRITICAL


class TestSupportingDocumentUnit:
    def test_validate_allowed_extensions(self):
        for ext in ["pdf", "png", "jpg", "jpeg", "docx", "xlsx", "csv"]:
            doc = SupportingDocument(
                document_type=DocumentType.PURCHASE_ORDER,
                file_name=f"file.{ext}",
                file_path=f"/path/file.{ext}",
                uploaded_at=NOW,
            )
            assert doc.validate_file_type() is True
            assert doc.file_type == ext

    def test_validate_disallowed_extension(self):
        doc = SupportingDocument(
            document_type=DocumentType.OTHER,
            file_name="script.exe",
            file_path="/path/script.exe",
            uploaded_at=NOW,
        )
        assert doc.validate_file_type() is False

    def test_details_and_reconstitute(self):
        doc = SupportingDocument(
            document_type=DocumentType.INVOICE_COPY,
            file_name="inv.pdf",
            file_path="/files/inv.pdf",
            uploaded_at=NOW,
        )
        assert "INVOICE_COPY: inv.pdf (pdf)" in doc.details()

        reconstituted = SupportingDocument.reconstitute(
            id="d1",
            document_type=DocumentType.CONTRACT,
            file_name="contract.pdf",
            file_type="pdf",
            file_path="/files/c.pdf",
            uploaded_at=NOW,
        )
        assert reconstituted.id == "d1"


class TestAuditAndNotificationUnit:
    def test_audit_event_immutability(self):
        ev = AuditEvent(
            event_type="PaymentReceived",
            description="Payment of 1000",
            occurred_at=NOW,
            invoice_id="inv-1",
        )
        assert ev.event_type == "PaymentReceived"
        with pytest.raises(AttributeError):
            ev.description = "hacked"

        reconstituted = AuditEvent.reconstitute(
            id="ev1",
            occurred_at=NOW,
            event_type="InvoiceSent",
            invoice_id="inv-2",
            description="Sent",
        )
        assert reconstituted.id == "ev1"

    def test_notification_lifecycle(self):
        n = Notification(message="Invoice overdue", created_at=NOW)
        assert n.is_read is False
        n.mark_read()
        assert n.is_read is True

        reconstituted = Notification.reconstitute(
            id="n1",
            message="Test msg",
            created_at=NOW,
            is_read=True,
        )
        assert reconstituted.id == "n1"
        assert reconstituted.is_read is True


class TestPaymentUnit:
    def test_payment_details_and_immutability(self):
        p = Payment(
            amount=Money.of(25_000),
            payment_date=TODAY,
            method=PaymentMethod.UPI,
            recorded_at=NOW,
            reference_number="UPI-12345",
        )
        assert p.is_valid() is True
        assert "₹25,000.00 via UPI on 2026-11-10 (ref: UPI-12345)" in p.details()

        with pytest.raises(AttributeError):
            p.reference_number = "hacked"

        reconstituted = Payment.reconstitute(
            id="pay1",
            amount=Money.of(10_000),
            payment_date=TODAY,
            method=PaymentMethod.CARD,
            reference_number=None,
            recorded_at=NOW,
        )
        assert reconstituted.id == "pay1"


class TestInvoiceEncapsulation:
    def test_invoice_child_collections_are_read_only_tuples(self):
        inv = make_invoice()
        assert isinstance(inv.payments, tuple)
        assert isinstance(inv.blockers, tuple)
        assert isinstance(inv.promises, tuple)
        assert isinstance(inv.follow_ups, tuple)
        assert isinstance(inv.documents, tuple)
        assert isinstance(inv.actions, tuple)

        with pytest.raises(AttributeError):
            inv.payments.append(None)  # type: ignore

        with pytest.raises(AttributeError):
            inv.blockers.append(None)  # type: ignore

        with pytest.raises(AttributeError):
            inv.promises.append(None)  # type: ignore

        with pytest.raises(AttributeError):
            inv.follow_ups.append(None)  # type: ignore

        with pytest.raises(AttributeError):
            inv.documents.append(None)  # type: ignore

        with pytest.raises(AttributeError):
            inv.actions.append(None)  # type: ignore

    def test_invoice_entity_level_lookups(self):
        inv = make_invoice()
        inv.send(NOW)

        # Blocker lookup
        from app.domain.enums import BlockerType
        b = inv.raise_blocker(BlockerType.MISSING_PO, "No PO", None, NOW)
        assert inv.get_blocker(b.id) is b
        assert inv.get_blocker("nonexistent") is None

        # Promise lookup
        pr = inv.record_promise(TODAY + timedelta(days=3), TODAY, NOW)
        assert inv.get_promise(pr.id) is pr
        assert inv.get_promise("nonexistent") is None

        # Action lookup
        act = NextAction("Call client", Priority.HIGH, TODAY, ActionSource.MANUAL, NOW)
        inv.add_action(act)
        assert inv.get_action(act.id) is act
        assert inv.get_action("nonexistent") is None

