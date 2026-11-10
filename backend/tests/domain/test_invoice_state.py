"""Tests for the Invoice state machine and Invoice aggregate."""
import pytest
from datetime import date, datetime, timedelta

from app.domain.invoice import Invoice
from app.domain.invoice_state import (
    DraftState, SentState, PartiallyPaidState, DisputedState,
    PaidState, WrittenOffState, state_for,
)
from app.domain.enums import InvoiceStatus, BlockerType, Channel, FollowUpOutcome, DocumentType
from app.domain.exceptions import DomainValidationError, InvalidStateTransition
from app.domain.money import Money
from app.domain.payment import Payment
from app.domain.enums import PaymentMethod
from app.domain.document import SupportingDocument

from tests.domain.conftest import TODAY, NOW, make_invoice, make_payment


# ── Helpers ───────────────────────────────────────────────────────────────────

def sent_invoice(**kw) -> Invoice:
    inv = make_invoice(**kw)
    inv.send(NOW)
    return inv


def partially_paid_invoice(total: int = 100_000, paid: int = 40_000) -> Invoice:
    inv = sent_invoice(total_amount=total)
    inv.record_payment(make_payment(paid), TODAY, NOW)
    return inv


def disputed_invoice() -> Invoice:
    inv = sent_invoice()
    inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "wrong amount", None, NOW)
    return inv


# ── State transitions: valid paths ────────────────────────────────────────────

class TestValidTransitions:
    def test_draft_to_sent(self):
        inv = make_invoice()
        assert inv.status == InvoiceStatus.DRAFT
        inv.send(NOW)
        assert inv.status == InvoiceStatus.SENT

    def test_sent_partial_payment_to_partially_paid(self):
        inv = sent_invoice(total_amount=100_000)
        inv.record_payment(make_payment(40_000), TODAY, NOW)
        assert inv.status == InvoiceStatus.PARTIALLY_PAID

    def test_sent_full_payment_to_paid(self):
        inv = sent_invoice(total_amount=100_000)
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        assert inv.status == InvoiceStatus.PAID

    def test_partially_paid_to_paid(self):
        inv = partially_paid_invoice(total=100_000, paid=60_000)
        inv.record_payment(make_payment(40_000), TODAY, NOW)
        assert inv.status == InvoiceStatus.PAID

    def test_sent_to_disputed(self):
        inv = sent_invoice()
        inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "dispute", None, NOW)
        assert inv.status == InvoiceStatus.DISPUTED

    def test_disputed_full_payment_to_paid(self):
        inv = disputed_invoice()
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        assert inv.status == InvoiceStatus.PAID

    def test_disputed_partial_payment_stays_disputed(self):
        inv = disputed_invoice()
        inv.record_payment(make_payment(30_000), TODAY, NOW)
        assert inv.status == InvoiceStatus.DISPUTED

    def test_sent_write_off(self):
        inv = sent_invoice()
        inv.write_off("bad debt", NOW)
        assert inv.status == InvoiceStatus.WRITTEN_OFF

    def test_partially_paid_write_off(self):
        inv = partially_paid_invoice()
        inv.write_off("bad debt", NOW)
        assert inv.status == InvoiceStatus.WRITTEN_OFF

    def test_disputed_write_off(self):
        inv = disputed_invoice()
        inv.write_off("bad debt", NOW)
        assert inv.status == InvoiceStatus.WRITTEN_OFF

    def test_resolve_dispute_no_payment_goes_to_sent(self):
        inv = disputed_invoice()
        # Resolve the disputed blocker to trigger auto-resolve
        blocker_id = inv.blockers[0].id
        inv.resolve_blocker(blocker_id, NOW)
        assert inv.status == InvoiceStatus.SENT

    def test_resolve_dispute_with_payment_goes_to_partially_paid(self):
        inv = disputed_invoice()
        inv.record_payment(make_payment(30_000), TODAY, NOW)
        blocker_id = inv.blockers[0].id
        inv.resolve_blocker(blocker_id, NOW)
        assert inv.status == InvoiceStatus.PARTIALLY_PAID

    def test_partially_paid_to_disputed(self):
        inv = partially_paid_invoice()
        inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "dispute", None, NOW)
        assert inv.status == InvoiceStatus.DISPUTED


# ── Invalid transitions ────────────────────────────────────────────────────────

class TestInvalidTransitions:
    def test_draft_cannot_record_payment(self):
        inv = make_invoice()
        with pytest.raises(InvalidStateTransition):
            inv.record_payment(make_payment(100_000), TODAY, NOW)

    def test_paid_cannot_record_payment(self):
        inv = sent_invoice()
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        with pytest.raises(InvalidStateTransition):
            inv.record_payment(make_payment(1), TODAY, NOW)

    def test_written_off_cannot_record_payment(self):
        inv = sent_invoice()
        inv.write_off("bad debt", NOW)
        with pytest.raises(InvalidStateTransition):
            inv.record_payment(make_payment(1_000), TODAY, NOW)

    def test_draft_write_off_raises(self):
        inv = make_invoice()
        with pytest.raises(InvalidStateTransition):
            inv.write_off("nope", NOW)

    def test_paid_write_off_raises(self):
        inv = sent_invoice()
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        with pytest.raises(InvalidStateTransition):
            inv.write_off("nope", NOW)

    def test_send_already_sent_raises(self):
        inv = sent_invoice()
        with pytest.raises(InvalidStateTransition):
            inv.send(NOW)

    def test_send_paid_raises(self):
        inv = sent_invoice()
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        with pytest.raises(InvalidStateTransition):
            inv.send(NOW)

    def test_overpayment_raises(self):
        inv = sent_invoice(total_amount=100_000)
        with pytest.raises(DomainValidationError):
            inv.record_payment(make_payment(200_000), TODAY, NOW)

    def test_update_details_not_draft_raises(self):
        inv = sent_invoice()
        with pytest.raises(InvalidStateTransition):
            inv.update_details(due_date=TODAY + timedelta(days=10))


# ── Payment validation ────────────────────────────────────────────────────────

class TestPaymentValidation:
    def test_future_payment_date_raises(self):
        inv = sent_invoice()
        future_payment = Payment(
            amount=Money.of(10_000),
            payment_date=TODAY + timedelta(days=1),
            method=PaymentMethod.BANK_TRANSFER,
            recorded_at=NOW,
        )
        with pytest.raises(DomainValidationError):
            inv.record_payment(future_payment, TODAY, NOW)

    def test_zero_amount_payment_raises(self):
        inv = sent_invoice()
        zero_payment = Payment(
            amount=Money.zero(),
            payment_date=TODAY,
            method=PaymentMethod.BANK_TRANSFER,
            recorded_at=NOW,
        )
        with pytest.raises(DomainValidationError):
            inv.record_payment(zero_payment, TODAY, NOW)


# ── Overdue logic ─────────────────────────────────────────────────────────────

class TestOverdue:
    def test_not_overdue_on_due_date_itself(self):
        inv = sent_invoice(due_days_ago=0)  # due today
        assert not inv.is_overdue(TODAY)

    def test_overdue_day_after_due_date(self):
        inv = sent_invoice(due_days_ago=1)  # due yesterday
        assert inv.is_overdue(TODAY)

    def test_days_overdue_zero_when_not_overdue(self):
        inv = sent_invoice(due_days_ago=0)
        assert inv.days_overdue(TODAY) == 0

    def test_days_overdue_correct_count(self):
        inv = sent_invoice(due_days_ago=5)
        assert inv.days_overdue(TODAY) == 5

    def test_paid_not_overdue(self):
        inv = sent_invoice(due_days_ago=5)
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        assert not inv.is_overdue(TODAY)

    def test_draft_not_overdue(self):
        inv = make_invoice(due_days_ago=5)
        assert not inv.is_overdue(TODAY)


# ── update_details ────────────────────────────────────────────────────────────

class TestUpdateDetails:
    def test_update_due_date_in_draft(self):
        inv = make_invoice()
        new_due = TODAY + timedelta(days=30)
        inv.update_details(due_date=new_due)
        assert inv.due_date == new_due

    def test_update_total_in_draft(self):
        inv = make_invoice()
        inv.update_details(total=Money.of(200_000))
        assert inv.total == Money.of(200_000)

    def test_due_date_before_issue_raises(self):
        inv = make_invoice()
        with pytest.raises(DomainValidationError):
            inv.update_details(due_date=date(2000, 1, 1))

    def test_zero_total_raises(self):
        inv = make_invoice()
        with pytest.raises(DomainValidationError):
            inv.update_details(total=Money.zero())


# ── allowed_operations ────────────────────────────────────────────────────────

class TestAllowedOperations:
    def test_draft_allows_send(self):
        assert "send" in make_invoice().allowed_operations()

    def test_sent_allows_record_payment(self):
        assert "record_payment" in sent_invoice().allowed_operations()

    def test_paid_allows_attach_document(self):
        inv = sent_invoice()
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        assert inv.allowed_operations() == {"attach_document"}

    def test_written_off_allows_attach_document(self):
        inv = sent_invoice()
        inv.write_off("bad debt", NOW)
        assert inv.allowed_operations() == {"attach_document"}

    def test_draft_does_not_allow_record_payment(self):
        assert "record_payment" not in make_invoice().allowed_operations()


# ── state_for() ───────────────────────────────────────────────────────────────

class TestStateFor:
    @pytest.mark.parametrize("status,expected_type", [
        (InvoiceStatus.DRAFT, DraftState),
        (InvoiceStatus.SENT, SentState),
        (InvoiceStatus.PARTIALLY_PAID, PartiallyPaidState),
        (InvoiceStatus.DISPUTED, DisputedState),
        (InvoiceStatus.PAID, PaidState),
        (InvoiceStatus.WRITTEN_OFF, WrittenOffState),
    ])
    def test_state_for_each_status(self, status, expected_type):
        state = state_for(status)
        assert isinstance(state, expected_type)
        assert state.status == status


# ── flag_overdue_if_needed ────────────────────────────────────────────────────

class TestFlagOverdue:
    def test_emits_event_when_newly_overdue(self):
        inv = sent_invoice(due_days_ago=1)
        result = inv.flag_overdue_if_needed(TODAY, NOW)
        assert result is True
        assert inv.overdue_notified is True

    def test_idempotent_second_call(self):
        inv = sent_invoice(due_days_ago=1)
        inv.flag_overdue_if_needed(TODAY, NOW)
        result = inv.flag_overdue_if_needed(TODAY, NOW)
        assert result is False

    def test_not_overdue_returns_false(self):
        inv = sent_invoice(due_days_ago=0)
        result = inv.flag_overdue_if_needed(TODAY, NOW)
        assert result is False


# ── Document attachment ───────────────────────────────────────────────────────

class TestAttachDocument:
    def _doc(self, file_name: str = "contract.pdf") -> SupportingDocument:
        return SupportingDocument(
            document_type=DocumentType.CONTRACT,
            file_name=file_name,
            file_path="/tmp/contract.pdf",
            uploaded_at=NOW,
        )

    def test_attach_valid_document(self):
        inv = sent_invoice()
        doc = self._doc("contract.pdf")
        inv.attach_document(doc, NOW)
        assert len(inv.documents) == 1

    def test_invalid_file_type_raises(self):
        inv = sent_invoice()
        doc = self._doc("virus.exe")
        with pytest.raises(DomainValidationError):
            inv.attach_document(doc, NOW)

    def test_attach_document_to_paid_invoice(self):
        inv = sent_invoice()
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        doc = self._doc("receipt.pdf")
        inv.attach_document(doc, NOW)
        assert len(inv.documents) == 1


# ── Invoice construction validation ──────────────────────────────────────────

class TestInvoiceConstruction:
    def test_empty_invoice_number_raises(self):
        with pytest.raises(DomainValidationError):
            Invoice("", "c1", Money.of(1000), TODAY, TODAY, NOW)

    def test_zero_total_raises(self):
        with pytest.raises(DomainValidationError):
            Invoice("INV-001", "c1", Money.zero(), TODAY, TODAY, NOW)

    def test_due_before_issue_raises(self):
        with pytest.raises(DomainValidationError):
            Invoice("INV-001", "c1", Money.of(1000),
                    TODAY, TODAY - timedelta(days=1), NOW)

    def test_invalid_reminder_level_raises(self):
        with pytest.raises(DomainValidationError):
            Invoice("INV-001", "c1", Money.of(1000), TODAY, TODAY, NOW, reminder_level=4)


# ── pull_events ───────────────────────────────────────────────────────────────

class TestPullEvents:
    def test_pull_clears_events(self):
        inv = make_invoice()
        inv.send(NOW)
        events = inv.pull_events()
        assert len(events) == 1
        assert len(inv.pull_events()) == 0

    def test_send_emits_invoice_sent(self):
        from app.domain.events import InvoiceSent
        inv = make_invoice()
        inv.send(NOW)
        events = inv.pull_events()
        assert any(isinstance(e, InvoiceSent) for e in events)

    def test_full_payment_emits_paid_event(self):
        from app.domain.events import InvoicePaid
        inv = sent_invoice()
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        events = inv.pull_events()
        assert any(isinstance(e, InvoicePaid) for e in events)
