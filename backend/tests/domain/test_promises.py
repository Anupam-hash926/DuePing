"""Tests for PaymentPromise domain entity."""
import pytest
from datetime import date, datetime, timedelta

from app.domain.promise import PaymentPromise
from app.domain.enums import PromiseStatus
from app.domain.exceptions import InvalidStateTransition, DomainValidationError
from app.domain.money import Money

from tests.domain.conftest import TODAY, NOW, make_invoice, make_payment


# ── Helpers ───────────────────────────────────────────────────────────────────

TOMORROW = TODAY + timedelta(days=1)
YESTERDAY = TODAY - timedelta(days=1)


def sent_invoice(total: int = 100_000, due_days_ago: int = 0):
    inv = make_invoice(total_amount=total, due_days_ago=due_days_ago)
    inv.send(NOW)
    return inv


# ── record_promise supersedes existing PENDING ────────────────────────────────

class TestRecordPromise:
    def test_record_promise_creates_pending(self):
        inv = sent_invoice()
        promise = inv.record_promise(TOMORROW, TODAY, NOW)
        assert promise.status == PromiseStatus.PENDING

    def test_second_promise_supersedes_first(self):
        inv = sent_invoice()
        p1 = inv.record_promise(TOMORROW, TODAY, NOW)
        p2 = inv.record_promise(TOMORROW + timedelta(days=1), TODAY, NOW)
        assert p1.status == PromiseStatus.SUPERSEDED
        assert p2.status == PromiseStatus.PENDING

    def test_only_one_pending_promise_at_a_time(self):
        inv = sent_invoice()
        inv.record_promise(TOMORROW, TODAY, NOW)
        inv.record_promise(TOMORROW + timedelta(days=3), TODAY, NOW)
        pending = [p for p in inv.promises if p.status == PromiseStatus.PENDING]
        assert len(pending) == 1

    def test_promise_in_past_raises(self):
        inv = sent_invoice()
        with pytest.raises(DomainValidationError):
            inv.record_promise(YESTERDAY, TODAY, NOW)

    def test_promise_today_allowed(self):
        inv = sent_invoice()
        p = inv.record_promise(TODAY, TODAY, NOW)
        assert p.status == PromiseStatus.PENDING

    def test_promise_on_draft_raises(self):
        inv = make_invoice()
        with pytest.raises(InvalidStateTransition):
            inv.record_promise(TOMORROW, TODAY, NOW)

    def test_promise_on_paid_raises(self):
        inv = sent_invoice()
        inv.record_promise(TOMORROW, TODAY, NOW)
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        with pytest.raises(InvalidStateTransition):
            inv.record_promise(TOMORROW, TODAY, NOW)


# ── Promise kept via payment ──────────────────────────────────────────────────

class TestPromiseKept:
    def test_promise_kept_on_time_no_amount_constraint(self):
        inv = sent_invoice()
        p = inv.record_promise(TOMORROW, TODAY, NOW)
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        assert p.status == PromiseStatus.KEPT

    def test_promise_kept_on_due_date(self):
        inv = sent_invoice()
        p = inv.record_promise(TODAY, TODAY, NOW)
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        assert p.status == PromiseStatus.KEPT

    def test_promise_kept_with_sufficient_amount(self):
        inv = sent_invoice()
        p = inv.record_promise(TOMORROW, TODAY, NOW, amount=Money.of(50_000))
        inv.record_payment(make_payment(50_000), TODAY, NOW)
        assert p.status == PromiseStatus.KEPT

    def test_promise_kept_payment_exceeds_promised_amount(self):
        inv = sent_invoice()
        p = inv.record_promise(TOMORROW, TODAY, NOW, amount=Money.of(30_000))
        inv.record_payment(make_payment(60_000), TODAY, NOW)
        assert p.status == PromiseStatus.KEPT

    def test_promise_not_kept_when_payment_too_small(self):
        inv = sent_invoice()
        p = inv.record_promise(TOMORROW, TODAY, NOW, amount=Money.of(60_000))
        inv.record_payment(make_payment(30_000), TODAY, NOW)
        # Still PENDING — amount constraint not satisfied
        assert p.status == PromiseStatus.PENDING

    def test_promise_not_kept_when_payment_late(self):
        """Payment after promised_date does not mark promise kept."""
        inv = sent_invoice()
        # Recorded when "today" was earlier:
        earlier_date = TODAY - timedelta(days=5)
        promised_date = TODAY - timedelta(days=2)
        p = inv.record_promise(promised_date, earlier_date, NOW)
        # Payment made TODAY (which is after promised_date)
        inv.record_payment(make_payment(50_000), TODAY, NOW)
        assert p.status == PromiseStatus.PENDING


# ── check_promises marks missed ───────────────────────────────────────────────

class TestCheckPromises:
    def test_overdue_promise_marked_missed(self):
        inv = sent_invoice()
        p = inv.record_promise(TOMORROW, TODAY, NOW)
        # Simulate time passing — check with day after promised_date
        after_due = TOMORROW + timedelta(days=1)
        missed = inv.check_promises(after_due, NOW)
        assert p in missed
        assert p.status == PromiseStatus.MISSED

    def test_non_overdue_promise_not_missed(self):
        inv = sent_invoice()
        p = inv.record_promise(TOMORROW, TODAY, NOW)
        missed = inv.check_promises(TODAY, NOW)
        assert p not in missed
        assert p.status == PromiseStatus.PENDING

    def test_check_promises_idempotent(self):
        inv = sent_invoice()
        p = inv.record_promise(TOMORROW, TODAY, NOW)
        after_due = TOMORROW + timedelta(days=1)
        inv.check_promises(after_due, NOW)
        # Second call should not raise and missed list should be empty
        missed2 = inv.check_promises(after_due, NOW)
        assert len(missed2) == 0

    def test_check_promises_emits_missed_event(self):
        from app.domain.events import PromiseMissed
        inv = sent_invoice()
        inv.record_promise(TOMORROW, TODAY, NOW)
        inv.pull_events()  # clear previous events
        inv.check_promises(TOMORROW + timedelta(days=1), NOW)
        events = inv.pull_events()
        assert any(isinstance(e, PromiseMissed) for e in events)

    def test_kept_promise_not_remarked(self):
        inv = sent_invoice()
        p = inv.record_promise(TOMORROW, TODAY, NOW)
        inv.record_payment(make_payment(100_000), TODAY, NOW)
        assert p.status == PromiseStatus.KEPT
        # check_promises on a kept promise should do nothing
        missed = inv.check_promises(TOMORROW + timedelta(days=1), NOW)
        assert len(missed) == 0

    def test_superseded_promise_not_missed(self):
        inv = sent_invoice()
        p1 = inv.record_promise(TOMORROW, TODAY, NOW)
        inv.record_promise(TOMORROW + timedelta(days=3), TODAY, NOW)
        assert p1.status == PromiseStatus.SUPERSEDED
        missed = inv.check_promises(TOMORROW + timedelta(days=1), NOW)
        assert p1 not in missed


# ── PaymentPromise unit tests ─────────────────────────────────────────────────

class TestPaymentPromiseUnit:
    def _promise(self, promised_date=TOMORROW) -> PaymentPromise:
        return PaymentPromise(promised_date=promised_date, created_at=NOW)

    def test_is_overdue_pending_past_date(self):
        p = PaymentPromise(promised_date=YESTERDAY, created_at=NOW)
        assert p.is_overdue(TODAY)

    def test_is_overdue_pending_today(self):
        p = self._promise(TODAY)
        assert not p.is_overdue(TODAY)  # promised_date < today is False

    def test_is_overdue_kept_not_overdue(self):
        p = PaymentPromise(promised_date=YESTERDAY, created_at=NOW)
        p.mark_kept()
        assert not p.is_overdue(TODAY)

    def test_mark_kept_twice_raises(self):
        p = self._promise()
        p.mark_kept()
        with pytest.raises(InvalidStateTransition):
            p.mark_kept()

    def test_mark_missed_twice_raises(self):
        p = self._promise()
        p.mark_missed()
        with pytest.raises(InvalidStateTransition):
            p.mark_missed()

    def test_supersede_then_mark_kept_raises(self):
        p = self._promise()
        p.supersede()
        with pytest.raises(InvalidStateTransition):
            p.mark_kept()

    def test_reconstitute_bypasses_validation(self):
        p = PaymentPromise.reconstitute(
            id="abc",
            promised_date=YESTERDAY,
            created_at=NOW,
            amount=None,
            note="",
            status=PromiseStatus.MISSED,
        )
        assert p.status == PromiseStatus.MISSED
        assert p.id == "abc"
