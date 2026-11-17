"""Tests for domain events emitted by Invoice operations."""
from __future__ import annotations

from datetime import timedelta

from app.domain.document import SupportingDocument
from app.domain.enums import (
    ActionSource,
    ActionStatus,
    BlockerType,
    Channel,
    DocumentType,
    FollowUpOutcome,
    Priority,
    ReminderTone,
)
from app.domain.events import (
    ActionCompleted,
    ActionCreated,
    ActionReopened,
    ActionRescheduled,
    ActionsCancelled,
    BlockerRaised,
    BlockerResolved,
    DisputeResolved,
    DocumentAttached,
    DocumentRemoved,
    FollowUpLogged,
    InvoiceBecameOverdue,
    InvoiceDisputed,
    InvoicePaid,
    InvoiceSent,
    InvoiceWrittenOff,
    PaymentReceived,
    PromiseKept,
    PromiseMissed,
    PromiseRecorded,
    ReminderSent,
)
from app.domain.money import Money
from app.domain.next_action import NextAction
from tests.domain.conftest import NOW, TODAY, make_invoice, make_payment


def sent_invoice(total: int = 100_000) -> make_invoice:
    inv = make_invoice(total_amount=total)
    inv.send(NOW)
    inv.pull_events()  # clear creation / sent events
    return inv


def test_send_emits_invoice_sent():
    inv = make_invoice()
    inv.send(NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], InvoiceSent)
    assert events[0].invoice_number == inv.invoice_number
    assert "sent to client" in events[0].describe()


def test_record_payment_partial_emits_payment_received():
    inv = sent_invoice(100_000)
    p = make_payment(40_000)
    inv.record_payment(p, TODAY, NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], PaymentReceived)
    assert events[0].amount == Money.of(40_000)
    assert events[0].fully_paid is False
    assert "payment of" in events[0].describe()


def test_record_payment_full_emits_payment_received_and_invoice_paid():
    inv = sent_invoice(100_000)
    p = make_payment(100_000)
    inv.record_payment(p, TODAY, NOW)
    events = inv.pull_events()
    assert len(events) == 2
    assert isinstance(events[0], PaymentReceived)
    assert events[0].fully_paid is True
    assert isinstance(events[1], InvoicePaid)
    assert "fully paid" in events[1].describe()


def test_record_payment_emits_promise_kept():
    inv = sent_invoice(100_000)
    inv.record_promise(TODAY + timedelta(days=2), TODAY, NOW, amount=Money.of(50_000))
    inv.pull_events()

    p = make_payment(50_000)
    inv.record_payment(p, TODAY, NOW)
    events = inv.pull_events()
    types = [type(e) for e in events]
    assert PaymentReceived in types
    assert PromiseKept in types
    kept_event = [e for e in events if isinstance(e, PromiseKept)][0]
    assert kept_event.client_id == inv.client_id
    assert "promise kept" in kept_event.describe()


def test_raise_blocker_emits_blocker_raised():
    inv = sent_invoice()
    b = inv.raise_blocker(BlockerType.MISSING_PO, "No PO", "Anupam", NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], BlockerRaised)
    assert events[0].blocker_id == b.id
    assert events[0].blocker_type == "MISSING_PO"


def test_raise_disputed_amount_emits_blocker_raised_and_invoice_disputed():
    inv = sent_invoice()
    inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "Rate error", "Client", NOW)
    events = inv.pull_events()
    assert len(events) == 2
    assert isinstance(events[0], BlockerRaised)
    assert isinstance(events[1], InvoiceDisputed)


def test_resolve_blocker_emits_blocker_resolved():
    inv = sent_invoice()
    b = inv.raise_blocker(BlockerType.MISSING_PO, "No PO", "Anupam", NOW)
    inv.pull_events()

    inv.resolve_blocker(b.id, NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], BlockerResolved)
    assert events[0].blocker_id == b.id


def test_resolve_last_disputed_blocker_emits_dispute_resolved():
    inv = sent_invoice()
    b = inv.raise_blocker(BlockerType.DISPUTED_AMOUNT, "Rate error", "Client", NOW)
    inv.pull_events()

    inv.resolve_blocker(b.id, NOW)
    events = inv.pull_events()
    assert len(events) == 2
    assert isinstance(events[0], BlockerResolved)
    assert isinstance(events[1], DisputeResolved)


def test_log_follow_up_emits_follow_up_logged():
    inv = sent_invoice()
    fu = inv.log_follow_up(NOW, Channel.EMAIL, "Called client", FollowUpOutcome.ACKNOWLEDGED, NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], FollowUpLogged)
    assert events[0].follow_up_id == fu.id


def test_record_promise_emits_promise_recorded():
    inv = sent_invoice()
    p = inv.record_promise(TODAY + timedelta(days=3), TODAY, NOW, note="Will pay soon")
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], PromiseRecorded)
    assert events[0].promise_id == p.id
    assert events[0].promised_date == TODAY + timedelta(days=3)


def test_check_promises_emits_promise_missed():
    inv = sent_invoice()
    p = inv.record_promise(TODAY + timedelta(days=1), TODAY, NOW)
    inv.pull_events()

    # Pass day after promise
    missed = inv.check_promises(TODAY + timedelta(days=2), NOW)
    assert len(missed) == 1
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], PromiseMissed)
    assert events[0].promise_id == p.id
    assert events[0].client_id == inv.client_id


def test_flag_overdue_if_needed_emits_event_idempotently():
    # Due yesterday
    inv = make_invoice(due_days_ago=1)
    inv.send(NOW)
    inv.pull_events()

    # First check
    flagged = inv.flag_overdue_if_needed(TODAY, NOW)
    assert flagged is True
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], InvoiceBecameOverdue)
    assert events[0].days_overdue == 1

    # Second check should do nothing
    flagged_again = inv.flag_overdue_if_needed(TODAY, NOW)
    assert flagged_again is False
    assert len(inv.pull_events()) == 0


def test_mark_reminder_sent_emits_reminder_sent():
    inv = sent_invoice()
    inv.mark_reminder_sent(ReminderTone.POLITE, Channel.EMAIL, NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], ReminderSent)
    assert events[0].tone == "POLITE"


def test_attach_document_emits_document_attached():
    inv = sent_invoice()
    doc = SupportingDocument(
        document_type=DocumentType.PURCHASE_ORDER,
        file_name="po.pdf",
        file_path="/files/po.pdf",
        uploaded_at=NOW,
    )
    inv.attach_document(doc, NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], DocumentAttached)
    assert events[0].document_id == doc.id


def test_add_and_complete_action_emit_events():
    inv = sent_invoice()
    act = NextAction(
        description="Call CFO",
        priority=Priority.HIGH,
        due_date=TODAY,
        source=ActionSource.MANUAL,
        created_at=NOW,
    )
    inv.add_action(act)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], ActionCreated)
    assert events[0].action_id == act.id

    inv.complete_action(act.id, NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], ActionCompleted)
    assert events[0].action_id == act.id

    inv.reopen_action(act.id, NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], ActionReopened)
    assert events[0].action_id == act.id
    assert inv.actions[0].status == ActionStatus.PENDING


def test_write_off_emits_invoice_written_off():
    inv = sent_invoice()
    inv.write_off("Client in liquidation", NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], InvoiceWrittenOff)
    assert events[0].reason == "Client in liquidation"


def test_pull_events_clears_list():
    inv = make_invoice()
    inv.send(NOW)
    assert len(inv._events) == 1
    pulled = inv.pull_events()
    assert len(pulled) == 1
    assert len(inv._events) == 0
    # Second pull returns empty
    assert len(inv.pull_events()) == 0


def test_remove_document_emits_document_removed():
    inv = sent_invoice()
    doc = SupportingDocument(
        document_type=DocumentType.PURCHASE_ORDER,
        file_name="po.pdf",
        file_path="/tmp/po.pdf",
        uploaded_at=NOW,
    )
    inv.attach_document(doc, NOW)
    inv.pull_events()

    inv.remove_document(doc.id, NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], DocumentRemoved)
    assert events[0].document_id == doc.id
    assert f"document {doc.id} removed" in events[0].describe()


def test_reschedule_action_emits_action_rescheduled():
    inv = sent_invoice()
    act = NextAction(
        description="Call CFO",
        priority=Priority.HIGH,
        due_date=TODAY,
        source=ActionSource.MANUAL,
        created_at=NOW,
    )
    inv.add_action(act)
    inv.pull_events()

    new_due = TODAY + timedelta(days=5)
    inv.reschedule_action(act.id, new_due, TODAY, NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], ActionRescheduled)
    assert events[0].action_id == act.id
    assert events[0].new_date == new_due
    assert f"rescheduled to {new_due.isoformat()}" in events[0].describe()


def test_cancel_actions_emits_actions_cancelled_only_when_count_positive():
    inv = sent_invoice()
    # No actions -> cancelling emits nothing
    inv.cancel_actions(now=NOW)
    assert len(inv.pull_events()) == 0

    act1 = NextAction(
        description="Task 1",
        priority=Priority.MEDIUM,
        due_date=TODAY,
        source=ActionSource.MANUAL,
        created_at=NOW,
    )
    act2 = NextAction(
        description="Task 2",
        priority=Priority.LOW,
        due_date=TODAY,
        source=ActionSource.MANUAL,
        created_at=NOW,
    )
    inv.add_action(act1)
    inv.add_action(act2)
    inv.pull_events()

    inv.cancel_actions(source=ActionSource.MANUAL, now=NOW)
    events = inv.pull_events()
    assert len(events) == 1
    assert isinstance(events[0], ActionsCancelled)
    assert events[0].count == 2
    assert events[0].source == "MANUAL"
    assert "2 action(s) cancelled (source: MANUAL)" in events[0].describe()

