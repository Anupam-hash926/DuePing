"""Tests for PaymentBlocker domain entity."""
import pytest
from datetime import datetime, timedelta

from app.domain.blocker import PaymentBlocker
from app.domain.enums import BlockerType, BlockerStatus, InvoiceStatus
from app.domain.exceptions import InvalidStateTransition, DomainValidationError

from tests.domain.conftest import TODAY, NOW, make_invoice, make_payment


LATER = NOW + timedelta(hours=2)


# ── Helpers ───────────────────────────────────────────────────────────────────

def sent_invoice():
    inv = make_invoice()
    inv.send(NOW)
    return inv


def open_blocker(**kw) -> PaymentBlocker:
    defaults = dict(type=BlockerType.MISSING_PO, description="Missing PO", created_at=NOW)
    defaults.update(kw)
    return PaymentBlocker(**defaults)


# ── PaymentBlocker unit tests ─────────────────────────────────────────────────

class TestPaymentBlockerUnit:
    def test_new_blocker_is_open(self):
        b = open_blocker()
        assert b.is_open()
        assert b.status == BlockerStatus.OPEN

    def test_assign_owner(self):
        b = open_blocker()
        b.assign_owner("alice@example.com")
        assert b.assigned_to == "alice@example.com"

    def test_update_status_to_in_progress(self):
        b = open_blocker()
        b.update_status(BlockerStatus.IN_PROGRESS)
        assert b.status == BlockerStatus.IN_PROGRESS

    def test_update_status_back_to_open(self):
        b = open_blocker()
        b.update_status(BlockerStatus.IN_PROGRESS)
        b.update_status(BlockerStatus.OPEN)
        assert b.status == BlockerStatus.OPEN

    def test_update_status_to_resolved_raises(self):
        b = open_blocker()
        with pytest.raises(InvalidStateTransition):
            b.update_status(BlockerStatus.RESOLVED)

    def test_resolve_sets_resolved_at(self):
        b = open_blocker()
        b.resolve(LATER)
        assert b.status == BlockerStatus.RESOLVED
        assert b.resolved_at == LATER

    def test_resolve_twice_raises(self):
        b = open_blocker()
        b.resolve(LATER)
        with pytest.raises(InvalidStateTransition):
            b.resolve(LATER)

    def test_assign_resolved_blocker_raises(self):
        b = open_blocker()
        b.resolve(LATER)
        with pytest.raises(InvalidStateTransition):
            b.assign_owner("bob@example.com")

    def test_update_status_resolved_blocker_raises(self):
        b = open_blocker()
        b.resolve(LATER)
        with pytest.raises(InvalidStateTransition):
            b.update_status(BlockerStatus.OPEN)

    def test_is_open_false_after_resolve(self):
        b = open_blocker()
        b.resolve(LATER)
        assert not b.is_open()

    def test_reconstitute_bypasses_validation(self):
        b = PaymentBlocker.reconstitute(
            id="xyz",
            type=BlockerType.OTHER,
            description="test",
            assigned_to=None,
            status=BlockerStatus.RESOLVED,
            created_at=NOW,
            resolved_at=LATER,
        )
        assert b.id == "xyz"
        assert b.status == BlockerStatus.RESOLVED


# ── Invoice.raise_blocker integration ────────────────────────────────────────

class TestRaiseBlocker:
    def test_raise_blocker_on_sent_invoice(self):
        inv = sent_invoice()
        b = inv.raise_blocker(BlockerType.MISSING_PO, "need PO", None, NOW)
        assert b in inv.blockers
        assert b.is_open()

    def test_raise_blocker_on_draft_raises(self):
        inv = make_invoice()
        with pytest.raises(InvalidStateTransition):
            inv.raise_blocker(BlockerType.MISSING_PO, "need PO", None, NOW)

    def test_raise_blocker_on_paid_raises(self):
        inv = sent_invoice()
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        with pytest.raises(InvalidStateTransition):
            inv.raise_blocker(BlockerType.MISSING_PO, "need PO", None, NOW)

    def test_raise_disputed_blocker_transitions_invoice(self):
        inv = sent_invoice()
        inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "wrong amount", None, NOW)
        assert inv.status == InvoiceStatus.DISPUTED

    def test_raise_non_disputed_blocker_keeps_sent_status(self):
        inv = sent_invoice()
        inv.raise_blocker(BlockerType.MISSING_PO, "no PO", None, NOW)
        assert inv.status == InvoiceStatus.SENT

    def test_multiple_blockers_allowed(self):
        inv = sent_invoice()
        inv.raise_blocker(BlockerType.MISSING_PO, "PO missing", None, NOW)
        inv.raise_blocker(BlockerType.NO_RESPONSE, "not responding", None, NOW)
        assert len(inv.blockers) == 2

    def test_assign_blocker(self):
        inv = sent_invoice()
        b = inv.raise_blocker(BlockerType.MISSING_PO, "need PO", None, NOW)
        inv.assign_blocker(b.id, "owner@example.com")
        assert b.assigned_to == "owner@example.com"

    def test_update_blocker_status(self):
        inv = sent_invoice()
        b = inv.raise_blocker(BlockerType.MISSING_PO, "need PO", None, NOW)
        inv.update_blocker_status(b.id, BlockerStatus.IN_PROGRESS)
        assert b.status == BlockerStatus.IN_PROGRESS


# ── Invoice.resolve_blocker integration ───────────────────────────────────────

class TestResolveBlocker:
    def test_resolve_blocker_on_invoice(self):
        inv = sent_invoice()
        b = inv.raise_blocker(BlockerType.MISSING_PO, "need PO", None, NOW)
        inv.resolve_blocker(b.id, LATER)
        assert not b.is_open()

    def test_resolve_nonexistent_blocker_raises(self):
        from app.domain.exceptions import EntityNotFound
        inv = sent_invoice()
        with pytest.raises(EntityNotFound):
            inv.resolve_blocker("nonexistent", NOW)

    def test_resolve_already_resolved_raises(self):
        inv = sent_invoice()
        b = inv.raise_blocker(BlockerType.MISSING_PO, "need PO", None, NOW)
        inv.resolve_blocker(b.id, LATER)
        with pytest.raises(InvalidStateTransition):
            inv.resolve_blocker(b.id, LATER)

    def test_resolve_disputed_blocker_auto_resolves_dispute(self):
        inv = sent_invoice()
        b = inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "wrong amount", None, NOW)
        assert inv.status == InvoiceStatus.DISPUTED
        inv.resolve_blocker(b.id, LATER)
        assert inv.status == InvoiceStatus.SENT

    def test_resolve_one_of_two_disputed_blockers_keeps_disputed(self):
        inv = sent_invoice()
        b1 = inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "dispute 1", None, NOW)
        b2 = inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "dispute 2", None, NOW)
        inv.resolve_blocker(b1.id, LATER)
        # Still disputed because b2 is open
        assert inv.status == InvoiceStatus.DISPUTED

    def test_resolve_all_disputed_blockers_resolves_dispute(self):
        inv = sent_invoice()
        b1 = inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "dispute 1", None, NOW)
        b2 = inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "dispute 2", None, NOW)
        inv.resolve_blocker(b1.id, LATER)
        inv.resolve_blocker(b2.id, LATER)
        assert inv.status == InvoiceStatus.SENT

    def test_open_blockers_property(self):
        inv = sent_invoice()
        b1 = inv.raise_blocker(BlockerType.MISSING_PO, "need PO", None, NOW)
        b2 = inv.raise_blocker(BlockerType.NO_RESPONSE, "silent", None, NOW)
        inv.resolve_blocker(b1.id, LATER)
        assert len(inv.open_blockers()) == 1
        assert b2 in inv.open_blockers()
