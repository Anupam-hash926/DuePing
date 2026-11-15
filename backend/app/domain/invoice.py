"""Invoice aggregate root — owns all child entities and enforces invariants."""
from __future__ import annotations
import uuid
from datetime import date, datetime
from typing import Any, List, Optional, Set

from app.domain.enums import (
    InvoiceStatus, BlockerType, BlockerStatus, ActionSource,
    Channel, FollowUpOutcome, DocumentType, ReminderTone, PromiseStatus, ActionStatus,
)
from app.domain.exceptions import DomainValidationError, InvalidStateTransition, EntityNotFound
from app.domain.money import Money
from app.domain.payment import Payment
from app.domain.blocker import PaymentBlocker
from app.domain.promise import PaymentPromise
from app.domain.follow_up import FollowUp
from app.domain.document import SupportingDocument
from app.domain.next_action import NextAction
from app.domain.invoice_state import InvoiceState, DraftState, state_for
from app.domain.events import (
    DomainEvent, InvoiceSent, PaymentReceived, InvoicePaid,
    InvoiceDisputed, DisputeResolved, InvoiceWrittenOff,
    BlockerRaised, BlockerResolved, PromiseRecorded, PromiseKept,
    PromiseMissed, InvoiceBecameOverdue, FollowUpLogged, ReminderSent,
    DocumentAttached, DocumentRemoved, ActionCreated, ActionCompleted,
    ActionRescheduled, ActionsCancelled,
)

ACTIVE_STATUSES = {InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.DISPUTED}


class Invoice:
    """Aggregate root for invoice collection.

    Owns: payments, blockers, promises, follow_ups, documents, actions.
    # PATTERN: State — Context (delegates lifecycle to InvoiceState hierarchy)
    """

    def __init__(
        self,
        invoice_number: str,
        client_id: str,
        total: Money,
        issue_date: date,
        due_date: date,
        now: datetime,
        project_id: Optional[str] = None,
        id: Optional[str] = None,
        reminder_level: int = 0,
        overdue_notified: bool = False,
        created_at: Optional[datetime] = None,
        version: int = 0,
    ) -> None:
        if not invoice_number or not invoice_number.strip():
            raise DomainValidationError("Invoice number cannot be empty")
        if not total.is_positive():
            raise DomainValidationError("Invoice total must be positive")
        if due_date < issue_date:
            raise DomainValidationError("due_date must be >= issue_date")
        if not (0 <= reminder_level <= 3):
            raise DomainValidationError("reminder_level must be 0–3")

        self.id: str = id or uuid.uuid4().hex
        self.invoice_number: str = invoice_number.strip()
        self.client_id: str = client_id
        self.project_id: Optional[str] = project_id
        self.issue_date: date = issue_date
        self.due_date: date = due_date
        self.total: Money = total
        self.reminder_level: int = reminder_level
        self.overdue_notified: bool = overdue_notified
        self.created_at: datetime = created_at or now
        self.version: int = version

        self._payments: List[Payment] = []
        self._blockers: List[PaymentBlocker] = []
        self._promises: List[PaymentPromise] = []
        self._follow_ups: List[FollowUp] = []
        self._documents: List[SupportingDocument] = []
        self._actions: List[NextAction] = []

        self._state: InvoiceState = DraftState()
        self._events: List[DomainEvent] = []

    @classmethod
    def reconstitute(cls, **fields: Any) -> "Invoice":
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        obj.id = fields["id"]
        obj.invoice_number = fields["invoice_number"]
        obj.client_id = fields["client_id"]
        obj.project_id = fields.get("project_id")
        obj.issue_date = fields["issue_date"]
        obj.due_date = fields["due_date"]
        obj.total = fields["total"]
        obj.reminder_level = fields.get("reminder_level", 0)
        obj.overdue_notified = fields.get("overdue_notified", False)
        obj.created_at = fields["created_at"]
        obj.version = fields.get("version", 0)
        obj._payments = list(fields.get("payments", []))
        obj._blockers = list(fields.get("blockers", []))
        obj._promises = list(fields.get("promises", []))
        obj._follow_ups = list(fields.get("follow_ups", []))
        obj._documents = list(fields.get("documents", []))
        obj._actions = list(fields.get("actions", []))
        obj._state = state_for(fields["status"])
        obj._events = []
        return obj

    # ── Internal ─────────────────────────────────────────────────────────────

    def _record(self, event: DomainEvent) -> None:
        self._events.append(event)

    def _set_state(self, state: InvoiceState) -> None:
        """Called by state objects to perform transitions."""
        self._state = state

    def _base(self) -> dict:
        return {"invoice_id": self.id, "invoice_number": self.invoice_number}

    # ── Encapsulated Collections & Lookups ───────────────────────────────────

    @property
    def payments(self) -> tuple[Payment, ...]:
        return tuple(self._payments)

    @property
    def blockers(self) -> tuple[PaymentBlocker, ...]:
        return tuple(self._blockers)

    @property
    def promises(self) -> tuple[PaymentPromise, ...]:
        return tuple(self._promises)

    @property
    def follow_ups(self) -> tuple[FollowUp, ...]:
        return tuple(self._follow_ups)

    @property
    def documents(self) -> tuple[SupportingDocument, ...]:
        return tuple(self._documents)

    @property
    def actions(self) -> tuple[NextAction, ...]:
        return tuple(self._actions)

    def get_blocker(self, blocker_id: str) -> Optional[PaymentBlocker]:
        for b in self._blockers:
            if b.id == blocker_id:
                return b
        return None

    def _get_blocker(self, blocker_id: str) -> PaymentBlocker:
        b = self.get_blocker(blocker_id)
        if b is None:
            raise EntityNotFound(f"Blocker {blocker_id} not found on invoice {self.id}")
        return b

    def get_promise(self, promise_id: str) -> Optional[PaymentPromise]:
        for p in self._promises:
            if p.id == promise_id:
                return p
        return None

    def get_action(self, action_id: str) -> Optional[NextAction]:
        for a in self._actions:
            if a.id == action_id:
                return a
        return None

    # ── Derived properties ────────────────────────────────────────────────────

    @property
    def status(self) -> InvoiceStatus:
        return self._state.status

    def amount_paid(self) -> Money:
        """Sum of all recorded payments."""
        total = Money.zero(self.total.currency)
        for p in self._payments:
            total = total.add(p.amount)
        return total

    def outstanding(self) -> Money:
        """Remaining balance: total minus amount paid."""
        return self.total.subtract(self.amount_paid())

    def is_overdue(self, today: date) -> bool:
        """True if active, still has balance, and past due date."""
        return (
            self.status in ACTIVE_STATUSES
            and self.outstanding().is_positive()
            and today > self.due_date
        )

    def days_overdue(self, today: date) -> int:
        """Number of calendar days past due_date; 0 if not overdue."""
        if not self.is_overdue(today):
            return 0
        return (today - self.due_date).days

    def open_blockers(self) -> List[PaymentBlocker]:
        """All unresolved blockers on this invoice."""
        return [b for b in self._blockers if b.is_open()]

    def pending_promise(self) -> Optional[PaymentPromise]:
        """Most recent PENDING promise, or None."""
        for p in reversed(self._promises):
            if p.status == PromiseStatus.PENDING:
                return p
        return None

    def pending_actions(self) -> List[NextAction]:
        """All PENDING next actions."""
        return [a for a in self._actions if a.status == ActionStatus.PENDING]

    def last_contact_date(self) -> Optional[datetime]:
        """Datetime of the most recent follow-up, or None."""
        if not self._follow_ups:
            return None
        return max(f.contact_date for f in self._follow_ups)

    def allowed_operations(self) -> Set[str]:
        """Operations permitted in the current state."""
        return self._state.allowed_operations()

    # ── Behaviour ─────────────────────────────────────────────────────────────

    def send(self, now: datetime) -> None:
        """DRAFT → SENT."""
        self._state.send(self)
        self._record(InvoiceSent(occurred_at=now, **self._base()))

    def record_payment(self, payment: Payment, today: date, now: datetime) -> None:
        """Record a payment; validate, transition state, check promises.

        Order: state allows payment → validate inputs → state.record_payment() →
        append payment → emit events → check promises.
        """
        if "record_payment" not in self._state.allowed_operations():
            self._state.record_payment(self, payment)
        if not payment.is_valid():
            raise DomainValidationError("Payment amount must be positive")
        if payment.payment_date < self.issue_date:
            raise DomainValidationError("Payment date cannot be before the invoice issue date")
        if payment.payment_date > today:
            raise DomainValidationError("Payment date cannot be in the future")
        if payment.amount > self.outstanding():
            raise DomainValidationError(
                f"Payment {payment.amount.format()} exceeds outstanding {self.outstanding().format()}"
            )
        # State transition: state.record_payment calculates remaining = outstanding - payment.amount
        # BEFORE we append, so outstanding() still reflects pre-payment balance here.
        self._state.record_payment(self, payment)
        self._payments.append(payment)

        fully_paid = self.outstanding().is_zero()
        self._record(PaymentReceived(
            occurred_at=now, payment_id=payment.id,
            amount=payment.amount, fully_paid=fully_paid, **self._base()
        ))

        if fully_paid:
            # 1. For every PENDING promise: if on time mark KEPT, else mark MISSED
            for promise in self._promises:
                if promise.status == PromiseStatus.PENDING:
                    date_ok = payment.payment_date <= promise.promised_date
                    amount_ok = (promise.amount is None or payment.amount >= promise.amount)
                    if date_ok and amount_ok:
                        promise.mark_kept()
                        self._record(PromiseKept(
                            occurred_at=now, promise_id=promise.id,
                            client_id=self.client_id, **self._base()
                        ))
                    else:
                        promise.mark_missed()
                        self._record(PromiseMissed(
                            occurred_at=now, promise_id=promise.id,
                            client_id=self.client_id, promised_date=promise.promised_date,
                            **self._base()
                        ))

            # 2. For every open blocker: resolve and emit BlockerResolved
            for blocker in list(self.open_blockers()):
                blocker.resolve(now)
                self._record(BlockerResolved(
                    occurred_at=now, blocker_id=blocker.id, **self._base()
                ))

            # 3. InvoicePaid emitted LAST
            self.overdue_notified = False
            self._record(InvoicePaid(occurred_at=now, **self._base()))
        else:
            # Check promises for partial payment: mark kept if payment is on time and meets amount constraint
            for promise in self._promises:
                if promise.status == PromiseStatus.PENDING:
                    date_ok = payment.payment_date <= promise.promised_date
                    amount_ok = (promise.amount is None or payment.amount >= promise.amount)
                    if date_ok and amount_ok:
                        promise.mark_kept()
                        self._record(PromiseKept(
                            occurred_at=now, promise_id=promise.id,
                            client_id=self.client_id, **self._base()
                        ))

    def raise_blocker(
        self, type: BlockerType, description: str,
        assigned_to: Optional[str], now: datetime,
    ) -> PaymentBlocker:
        """Raise a payment blocker on an active invoice."""
        if self.status not in ACTIVE_STATUSES:
            raise InvalidStateTransition(
                f"Cannot raise blocker in {self.status.name} status"
            )
        blocker = PaymentBlocker(type=type, description=description,
                                 assigned_to=assigned_to, created_at=now)
        self._blockers.append(blocker)
        self._record(BlockerRaised(occurred_at=now, blocker_id=blocker.id,
                                   blocker_type=type.name, **self._base()))
        if type == BlockerType.DISPUTED_AMOUNT and self.status != InvoiceStatus.DISPUTED:
            self._state.mark_disputed(self)
            self._record(InvoiceDisputed(occurred_at=now, **self._base()))
        return blocker

    def assign_blocker(self, blocker_id: str, owner: str) -> None:
        """Assign an owner to an existing blocker."""
        self._get_blocker(blocker_id).assign_owner(owner)

    def update_blocker_status(self, blocker_id: str, status: BlockerStatus) -> None:
        """Move a blocker between OPEN and IN_PROGRESS."""
        self._get_blocker(blocker_id).update_status(status)

    def resolve_blocker(self, blocker_id: str, now: datetime) -> None:
        """Resolve a blocker; auto-resolve dispute if no DISPUTED_AMOUNT blockers remain."""
        blocker = self._get_blocker(blocker_id)
        if not blocker.is_open():
            raise InvalidStateTransition("Blocker is already resolved")
        blocker.resolve(now)
        self._record(BlockerResolved(occurred_at=now, blocker_id=blocker_id, **self._base()))
        if self.status == InvoiceStatus.DISPUTED:
            has_open_disputed = any(
                b.type == BlockerType.DISPUTED_AMOUNT and b.is_open()
                for b in self._blockers
            )
            if not has_open_disputed:
                self._state.resolve_dispute(self)
                self._record(DisputeResolved(occurred_at=now, **self._base()))

    def log_follow_up(
        self, contact_date: datetime, channel: Channel,
        notes: str, outcome: FollowUpOutcome, now: datetime,
    ) -> FollowUp:
        """Log a follow-up contact on an active invoice."""
        if self.status not in ACTIVE_STATUSES:
            raise InvalidStateTransition(
                f"Cannot log follow-up in {self.status.name} status"
            )
        fu = FollowUp(contact_date=contact_date, channel=channel, notes=notes, outcome=outcome)
        self._follow_ups.append(fu)
        self._record(FollowUpLogged(occurred_at=now, follow_up_id=fu.id, **self._base()))
        return fu

    def record_promise(
        self, promised_date: date, today: date, now: datetime,
        amount: Optional[Money] = None, note: str = "",
    ) -> PaymentPromise:
        """Record a payment promise; supersede any existing PENDING promise."""
        if self.status not in ACTIVE_STATUSES:
            raise InvalidStateTransition(
                f"Cannot record promise in {self.status.name} status"
            )
        if promised_date < today:
            raise DomainValidationError("promised_date must be >= today")
        for p in self._promises:
            if p.status == PromiseStatus.PENDING:
                p.supersede()
        promise = PaymentPromise(promised_date=promised_date, amount=amount,
                                 note=note, created_at=now)
        self._promises.append(promise)
        self._record(PromiseRecorded(occurred_at=now, promise_id=promise.id,
                                     promised_date=promised_date, **self._base()))
        return promise

    def check_promises(self, today: date, now: datetime) -> List[PaymentPromise]:
        """Mark overdue PENDING promises as MISSED. Returns the list of missed promises."""
        missed = []
        for promise in self._promises:
            if promise.is_overdue(today):
                promise.mark_missed()
                missed.append(promise)
                self._record(PromiseMissed(
                    occurred_at=now, promise_id=promise.id,
                    client_id=self.client_id, promised_date=promise.promised_date,
                    **self._base()
                ))
        return missed

    def flag_overdue_if_needed(self, today: date, now: datetime) -> bool:
        """If newly overdue, set flag and emit event. If not overdue, reset flag."""
        if not self.is_overdue(today):
            self.overdue_notified = False
            return False
        if not self.overdue_notified:
            self.overdue_notified = True
            self._record(InvoiceBecameOverdue(
                occurred_at=now, client_id=self.client_id,
                days_overdue=self.days_overdue(today), **self._base()
            ))
            return True
        return False

    def mark_reminder_sent(self, tone: ReminderTone, channel: Channel, now: datetime) -> None:
        """Mark reminder sent; bump reminder_level (max 3); auto-log follow-up."""
        if self.status not in ACTIVE_STATUSES:
            raise InvalidStateTransition(
                f"Cannot mark reminder sent in {self.status.name} status"
            )
        self.reminder_level = min(3, self.reminder_level + 1)
        fu = FollowUp(contact_date=now, channel=channel,
                      notes=f"{tone.name} reminder sent", outcome=FollowUpOutcome.OTHER)
        self._follow_ups.append(fu)
        self._record(ReminderSent(occurred_at=now, tone=tone.name, **self._base()))

    def attach_document(self, doc: SupportingDocument, now: datetime) -> None:
        """Attach a supporting document after validating its file type."""
        if not doc.validate_file_type():
            raise DomainValidationError(f"File type not allowed: {doc.file_name}")
        self._documents.append(doc)
        self._record(DocumentAttached(occurred_at=now, document_id=doc.id, **self._base()))

    def remove_document(self, document_id: str, now: Optional[datetime] = None) -> None:
        """Remove a document by id; raises EntityNotFound if absent."""
        original = len(self._documents)
        self._documents = [d for d in self._documents if d.id != document_id]
        if len(self._documents) == original:
            raise EntityNotFound(f"Document {document_id} not found")
        ev_now = now or datetime(2024, 1, 1)
        self._record(DocumentRemoved(occurred_at=ev_now, document_id=document_id, **self._base()))

    def add_action(self, action: NextAction) -> None:
        """Add a next action to this invoice."""
        self._actions.append(action)
        self._record(ActionCreated(occurred_at=action.created_at,
                                   action_id=action.id, **self._base()))

    def complete_action(self, action_id: str, now: datetime) -> None:
        """Mark an action as completed."""
        for a in self._actions:
            if a.id == action_id:
                a.mark_completed(now)
                self._record(ActionCompleted(occurred_at=now,
                                             action_id=action_id, **self._base()))
                return
        raise EntityNotFound(f"Action {action_id} not found")

    def reschedule_action(
        self, action_id: str, new_date: date, today: date, now: Optional[datetime] = None,
    ) -> None:
        """Reschedule a PENDING action to a future date."""
        for a in self._actions:
            if a.id == action_id:
                a.reschedule(new_date, today)
                ev_now = now or datetime.combine(today, datetime.min.time())
                self._record(ActionRescheduled(
                    occurred_at=ev_now, action_id=action_id, new_date=new_date, **self._base()
                ))
                return
        raise EntityNotFound(f"Action {action_id} not found")

    def cancel_actions(
        self,
        source: Optional[ActionSource] = None,
        source_ref: Optional[str] = None,
        now: Optional[datetime] = None,
    ) -> int:
        """Cancel PENDING actions matching optional source/source_ref filters."""
        count = 0
        for a in self._actions:
            if a.status != ActionStatus.PENDING:
                continue
            if source is not None and a.source != source:
                continue
            if source_ref is not None and a.source_ref != source_ref:
                continue
            a.cancel()
            count += 1
        if count > 0:
            ev_now = now or datetime(2024, 1, 1)
            self._record(ActionsCancelled(
                occurred_at=ev_now,
                count=count,
                source=source.name if source else None,
                **self._base()
            ))
        return count

    def write_off(self, reason: str, now: datetime) -> None:
        """Write off an active invoice; cancels pending actions and supersedes promises."""
        if self.status not in ACTIVE_STATUSES:
            raise InvalidStateTransition(
                f"Cannot write off invoice in {self.status.name} status"
            )
        self.cancel_actions(now=now)
        for p in self._promises:
            if p.status == PromiseStatus.PENDING:
                p.supersede()
        self._state.write_off(self)
        self._record(InvoiceWrittenOff(occurred_at=now, reason=reason, **self._base()))

    def update_details(
        self,
        due_date: Optional[date] = None,
        total: Optional[Money] = None,
        project_id: Optional[str] = None,
    ) -> None:
        """Update invoice details — only allowed in DRAFT status."""
        if self.status != InvoiceStatus.DRAFT:
            raise InvalidStateTransition("Can only update details when invoice is DRAFT")
        if due_date is not None:
            if due_date < self.issue_date:
                raise DomainValidationError("due_date must be >= issue_date")
            self.due_date = due_date
            self.overdue_notified = False
        if total is not None:
            if not total.is_positive():
                raise DomainValidationError("Invoice total must be positive")
            self.total = total
        if project_id is not None:
            self.project_id = project_id

    def pull_events(self) -> List[DomainEvent]:
        """Return and clear the pending domain events."""
        events = list(self._events)
        self._events.clear()
        return events
