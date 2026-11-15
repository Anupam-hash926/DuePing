"""Invoice mutation commands service."""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional

from app.application.event_bus import EventBus, mutate_invoice, save_and_publish
from app.application.invoice_factory import InvoiceFactory
from app.application.ports import ClientRepository, Clock, InvoiceRepository, ProjectRepository
from app.domain.document import SupportingDocument
from app.domain.enums import (
    ActionSource, BlockerStatus, BlockerType, Channel, DocumentType,
    FollowUpOutcome, PaymentMethod, Priority, ReminderTone,
)
from app.domain.invoice import Invoice
from app.domain.money import Money
from app.domain.next_action import NextAction
from app.domain.payment import Payment


class InvoiceCommands:
    """Executes all state-mutating commands on invoices with concurrency retry protection."""

    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        client_repo: ClientRepository,
        project_repo: ProjectRepository,
        invoice_factory: InvoiceFactory,
        event_bus: EventBus,
        clock: Clock,
    ) -> None:
        self.invoice_repo, self.client_repo = invoice_repo, client_repo
        self.project_repo, self.invoice_factory = project_repo, invoice_factory
        self.event_bus, self.clock = event_bus, clock

    def create_invoice(
        self, client_id: str, total: Money, issue_date: date, due_date: date,
        invoice_number: Optional[str] = None, project_id: Optional[str] = None,
    ) -> Invoice:
        self.client_repo.get(client_id)
        if project_id is not None:
            self.project_repo.get(project_id)
        now = self.clock.now()
        invoice = self.invoice_factory.create(
            client_id=client_id, total=total, issue_date=issue_date, due_date=due_date,
            now=now, invoice_number=invoice_number, project_id=project_id,
        )
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice.id)

    def update_invoice(
        self, id: str, due_date: Optional[date] = None,
        total: Optional[Money] = None, project_id: Optional[str] = None,
    ) -> Invoice:
        if project_id is not None:
            self.project_repo.get(project_id)
        return mutate_invoice(
            self.invoice_repo, self.event_bus, id,
            lambda inv: inv.update_details(due_date=due_date, total=total, project_id=project_id),
        )

    def send_invoice(self, id: str) -> Invoice:
        now = self.clock.now()
        return mutate_invoice(self.invoice_repo, self.event_bus, id, lambda inv: inv.send(now))

    def record_payment(
        self, invoice_id: str, amount: Money, payment_date: date,
        method: PaymentMethod, reference_number: Optional[str] = None,
    ) -> Invoice:
        today, now = self.clock.today(), self.clock.now()
        def do_payment(inv: Invoice) -> None:
            p = Payment(amount=amount, payment_date=payment_date, method=method, recorded_at=now, reference_number=reference_number)
            inv.record_payment(p, today, now)
        return mutate_invoice(self.invoice_repo, self.event_bus, invoice_id, do_payment)

    def raise_blocker(
        self, invoice_id: str, type: BlockerType, description: str, assigned_to: Optional[str] = None,
    ) -> Invoice:
        now = self.clock.now()
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.raise_blocker(type, description, assigned_to, now),
        )

    def assign_blocker(self, invoice_id: str, blocker_id: str, owner: str) -> Invoice:
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.assign_blocker(blocker_id, owner),
        )

    def update_blocker_status(self, invoice_id: str, blocker_id: str, status: BlockerStatus) -> Invoice:
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.update_blocker_status(blocker_id, status),
        )

    def resolve_blocker(self, invoice_id: str, blocker_id: str) -> Invoice:
        now = self.clock.now()
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.resolve_blocker(blocker_id, now),
        )

    def log_follow_up(
        self, invoice_id: str, channel: Channel, notes: str, outcome: FollowUpOutcome,
        contact_date: Optional[datetime] = None, promised_date: Optional[date] = None,
        promised_amount: Optional[Money] = None,
    ) -> Invoice:
        today, now = self.clock.today(), self.clock.now()
        c_date = contact_date or now
        def do_follow_up(inv: Invoice) -> None:
            inv.log_follow_up(c_date, channel, notes, outcome, now)
            if promised_date is not None:
                inv.record_promise(promised_date, today, now, amount=promised_amount, note=notes)
        return mutate_invoice(self.invoice_repo, self.event_bus, invoice_id, do_follow_up)

    def record_promise(
        self, invoice_id: str, promised_date: date, amount: Optional[Money] = None, note: str = "",
    ) -> Invoice:
        today, now = self.clock.today(), self.clock.now()
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.record_promise(promised_date, today, now, amount=amount, note=note),
        )

    def attach_document(
        self, invoice_id: str, document_type: DocumentType, file_name: str, file_path: str,
    ) -> Invoice:
        now = self.clock.now()
        doc = SupportingDocument(document_type=document_type, file_name=file_name, file_path=file_path, uploaded_at=now)
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.attach_document(doc, now),
        )

    def remove_document(self, invoice_id: str, document_id: str) -> Invoice:
        now = self.clock.now()
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.remove_document(document_id, now),
        )

    def add_manual_action(
        self, invoice_id: str, description: str, priority: Priority, due_date: date,
    ) -> Invoice:
        now = self.clock.now()
        act = NextAction(description=description, priority=priority, due_date=due_date, source=ActionSource.MANUAL, created_at=now)
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.add_action(act),
        )

    def complete_action(self, invoice_id: str, action_id: str) -> Invoice:
        now = self.clock.now()
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.complete_action(action_id, now),
        )

    def reschedule_action(self, invoice_id: str, action_id: str, new_date: date) -> Invoice:
        today, now = self.clock.today(), self.clock.now()
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.reschedule_action(action_id, new_date, today, now),
        )

    def mark_reminder_sent(self, invoice_id: str, tone: ReminderTone, channel: Channel) -> Invoice:
        now = self.clock.now()
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.mark_reminder_sent(tone, channel, now),
        )

    def write_off(self, invoice_id: str, reason: str) -> Invoice:
        now = self.clock.now()
        return mutate_invoice(
            self.invoice_repo, self.event_bus, invoice_id,
            lambda inv: inv.write_off(reason, now),
        )
