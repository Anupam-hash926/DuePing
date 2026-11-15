"""Domain event listeners acting as observers.

# PATTERN: Observer — Concrete Observers
1. AuditLogListener: writes all events to AuditRepository
2. ActionGenerationListener: reacts to domain events by generating or cancelling NextActions
3. ReliabilityListener: updates Client reliability scores based on kept/missed promises
4. NotificationListener: generates in-app Notifications for key collection milestones
"""
from __future__ import annotations
from datetime import timedelta
import logging

from app.application.event_bus import EventBus, save_and_publish
from app.application.playbook import ResolutionPlaybook
from app.application.ports import (
    AuditRepository, ClientRepository, Clock, InvoiceRepository,
    NotificationRepository,
)
from app.application.reminders import ReminderFactory
from app.domain.audit import AuditEvent, Notification
from app.domain.enums import ActionSource, Priority, InvoiceStatus, ActionStatus
from app.domain.events import (
    BlockerRaised, BlockerResolved, DomainEvent, InvoiceBecameOverdue,
    InvoicePaid, InvoiceWrittenOff, PaymentReceived, PromiseKept, PromiseMissed,
)
from app.domain.next_action import NextAction

logger = logging.getLogger(__name__)


class AuditLogListener:
    """Observer recording every domain event into the audit trail.

    # PATTERN: Observer — Concrete Observer 1
    """

    def __init__(self, audit_repo: AuditRepository) -> None:
        self.audit_repo = audit_repo

    def register(self, bus: EventBus) -> None:
        bus.subscribe_all(self.on_event)

    def on_event(self, event: DomainEvent) -> None:
        entry = AuditEvent(
            event_type=event.event_type,
            description=event.describe(),
            occurred_at=event.occurred_at,
            invoice_id=event.invoice_id,
        )
        self.audit_repo.add(entry)


class ActionGenerationListener:
    """Observer translating domain events into next actions or cancellations.

    # PATTERN: Observer — Concrete Observer 2
    """

    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        client_repo: ClientRepository,
        playbook: ResolutionPlaybook,
        reminder_factory: ReminderFactory,
        clock: Clock,
        bus: EventBus,
    ) -> None:
        self.invoice_repo = invoice_repo
        self.client_repo = client_repo
        self.playbook = playbook
        self.reminder_factory = reminder_factory
        self.clock = clock
        self.bus = bus

    def register(self, bus: EventBus) -> None:
        bus.subscribe(BlockerRaised, self.on_blocker_raised)
        bus.subscribe(BlockerResolved, self.on_blocker_resolved)
        bus.subscribe(PromiseMissed, self.on_promise_missed)
        bus.subscribe(InvoiceBecameOverdue, self.on_invoice_became_overdue)
        bus.subscribe(InvoicePaid, self.on_invoice_closed)
        bus.subscribe(InvoiceWrittenOff, self.on_invoice_closed)

    def on_blocker_raised(self, event: BlockerRaised) -> None:
        if not event.invoice_id:
            return
        invoice = self.invoice_repo.get(event.invoice_id)
        if invoice.status not in (InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.DISPUTED):
            return
        # Skip if a pending action with same source_ref already exists
        if any(a.source_ref == event.blocker_id and a.status == ActionStatus.PENDING for a in invoice.actions):
            return

        blocker = invoice.get_blocker(event.blocker_id)
        if blocker is None:
            return
        client = self.client_repo.get(invoice.client_id)
        action = self.playbook.plan_for(blocker, invoice, client, self.clock.today())
        invoice.add_action(action)
        save_and_publish(self.invoice_repo, self.bus, invoice)

    def on_blocker_resolved(self, event: BlockerResolved) -> None:
        if not event.invoice_id:
            return
        invoice = self.invoice_repo.get(event.invoice_id)
        invoice.cancel_actions(source=ActionSource.BLOCKER, source_ref=event.blocker_id, now=event.occurred_at)
        save_and_publish(self.invoice_repo, self.bus, invoice)

    def on_promise_missed(self, event: PromiseMissed) -> None:
        if not event.invoice_id:
            return
        invoice = self.invoice_repo.get(event.invoice_id)
        if invoice.status not in (InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.DISPUTED):
            return
        client = self.client_repo.get(event.client_id)
        p_date_str = event.promised_date.strftime("%d %b") if event.promised_date else "scheduled date"
        desc = (
            f"Promise for {p_date_str} was missed — call {client.name} and send a "
            f"FIRM reminder for invoice {invoice.invoice_number}"
        )
        action = NextAction(
            description=desc,
            priority=Priority.HIGH,
            due_date=self.clock.today(),
            source=ActionSource.PROMISE_MISSED,
            created_at=self.clock.now(),
            source_ref=event.promise_id,
        )
        invoice.add_action(action)
        save_and_publish(self.invoice_repo, self.bus, invoice)

    def on_invoice_became_overdue(self, event: InvoiceBecameOverdue) -> None:
        if not event.invoice_id:
            return
        invoice = self.invoice_repo.get(event.invoice_id)
        if invoice.status not in (InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.DISPUTED):
            return
        # Skip creating an OVERDUE action if a PENDING action with source == OVERDUE already exists on that invoice
        if any(a.source == ActionSource.OVERDUE and a.status == ActionStatus.PENDING for a in invoice.actions):
            return
        client = self.client_repo.get(event.client_id)
        today = self.clock.today()
        tone = self.reminder_factory.tone_for(invoice, today)

        if event.days_overdue <= 7:
            prio = Priority.MEDIUM
        elif event.days_overdue <= 30:
            prio = Priority.HIGH
        else:
            prio = Priority.CRITICAL

        desc = (
            f"Invoice {invoice.invoice_number} is {event.days_overdue} days overdue — "
            f"send a {tone.name} reminder to {client.name}"
        )
        action = NextAction(
            description=desc,
            priority=prio,
            due_date=today,
            source=ActionSource.OVERDUE,
            created_at=self.clock.now(),
        )
        invoice.add_action(action)
        save_and_publish(self.invoice_repo, self.bus, invoice)

    def on_invoice_closed(self, event: DomainEvent) -> None:
        if not event.invoice_id:
            return
        invoice = self.invoice_repo.get(event.invoice_id)
        invoice.cancel_actions(now=event.occurred_at)
        save_and_publish(self.invoice_repo, self.bus, invoice)


class ReliabilityListener:
    """Observer maintaining client promise reliability statistics.

    # PATTERN: Observer — Concrete Observer 3
    """

    def __init__(self, client_repo: ClientRepository) -> None:
        self.client_repo = client_repo

    def register(self, bus: EventBus) -> None:
        bus.subscribe(PromiseKept, self.on_promise_kept)
        bus.subscribe(PromiseMissed, self.on_promise_missed)

    def on_promise_kept(self, event: PromiseKept) -> None:
        if not event.client_id:
            return
        client = self.client_repo.get(event.client_id)
        client.register_promise_kept()
        self.client_repo.save(client)

    def on_promise_missed(self, event: PromiseMissed) -> None:
        if not event.client_id:
            return
        client = self.client_repo.get(event.client_id)
        client.register_promise_missed()
        self.client_repo.save(client)


class NotificationListener:
    """Observer creating in-app notification alerts for key events.

    # PATTERN: Observer — Concrete Observer 4
    """

    def __init__(self, notification_repo: NotificationRepository, clock: Clock) -> None:
        self.notification_repo = notification_repo
        self.clock = clock

    def register(self, bus: EventBus) -> None:
        bus.subscribe(PaymentReceived, self.on_notify)
        bus.subscribe(InvoicePaid, self.on_notify)
        bus.subscribe(PromiseMissed, self.on_notify)
        bus.subscribe(InvoiceBecameOverdue, self.on_notify)
        bus.subscribe(BlockerRaised, self.on_notify)

    def on_notify(self, event: DomainEvent) -> None:
        n = Notification(
            message=event.describe(),
            created_at=self.clock.now(),
        )
        self.notification_repo.add(n)
