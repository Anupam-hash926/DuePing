"""Domain events emitted by Invoice aggregate operations.

Each event is a plain dataclass carrying enough data for listeners to act
without reloading anything from the repository.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from app.domain.money import Money


@dataclass
class DomainEvent:
    """Base class for all domain events."""

    occurred_at: datetime
    invoice_id: str | None = None
    invoice_number: str | None = None

    @property
    def event_type(self) -> str:
        """Return the concrete class name as the event type string."""
        return type(self).__name__

    def describe(self) -> str:
        """Human-readable audit description including the invoice number."""
        return f"{self.event_type} on invoice {self.invoice_number}"


# ── Invoice lifecycle ─────────────────────────────────────────────────────────

@dataclass
class InvoiceSent(DomainEvent):
    """Invoice has been sent to the client."""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: sent to client"


@dataclass
class PaymentReceived(DomainEvent):
    """A payment has been recorded against the invoice."""

    payment_id: str = ""
    amount: Money | None = None
    fully_paid: bool = False

    def describe(self) -> str:
        amt = self.amount.format() if self.amount else "unknown"
        suffix = " — fully paid" if self.fully_paid else ""
        return f"Invoice {self.invoice_number}: payment of {amt} received{suffix}"


@dataclass
class InvoicePaid(DomainEvent):
    """Invoice has been fully paid."""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: fully paid"


@dataclass
class InvoiceDisputed(DomainEvent):
    """Invoice has been marked as disputed."""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: marked as disputed"


@dataclass
class DisputeResolved(DomainEvent):
    """The dispute on this invoice has been resolved."""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: dispute resolved"


@dataclass
class InvoiceWrittenOff(DomainEvent):
    """Invoice has been written off."""

    reason: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: written off — {self.reason}"


# ── Blockers ──────────────────────────────────────────────────────────────────

@dataclass
class BlockerRaised(DomainEvent):
    """A payment blocker has been raised."""

    blocker_id: str = ""
    blocker_type: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: blocker raised ({self.blocker_type})"


@dataclass
class BlockerResolved(DomainEvent):
    """A payment blocker has been resolved."""

    blocker_id: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: blocker resolved"


# ── Promises ──────────────────────────────────────────────────────────────────

@dataclass
class PromiseRecorded(DomainEvent):
    """A payment promise has been recorded."""

    promise_id: str = ""
    promised_date: date | None = None

    def describe(self) -> str:
        d = self.promised_date.strftime("%d %b %Y") if self.promised_date else "unknown"
        return f"Invoice {self.invoice_number}: payment promised by {d}"


@dataclass
class PromiseKept(DomainEvent):
    """A payment promise was honoured."""

    promise_id: str = ""
    client_id: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: promise kept"


@dataclass
class PromiseMissed(DomainEvent):
    """A payment promise was not honoured by its promised date."""

    promise_id: str = ""
    client_id: str = ""
    promised_date: date | None = None

    def describe(self) -> str:
        d = self.promised_date.strftime("%d %b %Y") if self.promised_date else "unknown"
        return f"Invoice {self.invoice_number}: promise for {d} was missed"


@dataclass
class InvoiceBecameOverdue(DomainEvent):
    """First detection that the invoice is overdue."""

    client_id: str = ""
    days_overdue: int = 0

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: became overdue ({self.days_overdue} days)"


# ── Follow-ups & reminders ────────────────────────────────────────────────────

@dataclass
class FollowUpLogged(DomainEvent):
    """A follow-up contact has been logged."""

    follow_up_id: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: follow-up logged"


@dataclass
class ReminderSent(DomainEvent):
    """A reminder has been marked as sent."""

    tone: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: {self.tone} reminder sent"


# ── Documents & actions ───────────────────────────────────────────────────────

@dataclass
class DocumentAttached(DomainEvent):
    """A supporting document has been attached."""

    document_id: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: document attached"


@dataclass
class DocumentRemoved(DomainEvent):
    """A supporting document has been removed."""

    document_id: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: document {self.document_id} removed"


@dataclass
class ActionCreated(DomainEvent):
    """A next action has been created."""

    action_id: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: action created"


@dataclass
class ActionCompleted(DomainEvent):
    """A next action has been completed."""

    action_id: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: action {self.action_id} completed"


@dataclass
class ActionReopened(DomainEvent):
    """A completed next action has been reopened back to pending."""

    action_id: str = ""

    def describe(self) -> str:
        return f"Invoice {self.invoice_number}: action {self.action_id} reopened"


@dataclass
class ActionRescheduled(DomainEvent):
    """A next action has been rescheduled to a new due date."""

    action_id: str = ""
    new_date: date | None = None

    def describe(self) -> str:
        date_str = self.new_date.isoformat() if self.new_date else "unknown"
        return f"Invoice {self.invoice_number}: action {self.action_id} rescheduled to {date_str}"


@dataclass
class ActionsCancelled(DomainEvent):
    """Pending actions have been cancelled."""

    count: int = 0
    source: str | None = None

    def describe(self) -> str:
        src = f" (source: {self.source})" if self.source else ""
        return f"Invoice {self.invoice_number}: {self.count} action(s) cancelled{src}"
