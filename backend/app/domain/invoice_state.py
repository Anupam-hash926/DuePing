"""InvoiceState — State pattern for the invoice lifecycle.

# PATTERN: State — AbstractState is InvoiceState; concrete states are the 6 classes below.
The Invoice (Context) delegates all state-specific behaviour here.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from app.domain.enums import InvoiceStatus
from app.domain.exceptions import InvalidStateTransition

if TYPE_CHECKING:
    from app.domain.invoice import Invoice
    from app.domain.payment import Payment


class InvoiceState(ABC):
    """Abstract state in the invoice lifecycle.

    # PATTERN: State — AbstractState
    Default implementation of every transition raises InvalidStateTransition.
    """

    @property
    @abstractmethod
    def status(self) -> InvoiceStatus: ...

    def send(self, inv: Invoice) -> None:
        raise InvalidStateTransition(f"send not allowed in {self.status.name}")

    def record_payment(self, inv: Invoice, payment: Payment) -> None:
        raise InvalidStateTransition(f"record_payment not allowed in {self.status.name}")

    def mark_disputed(self, inv: Invoice) -> None:
        raise InvalidStateTransition(f"mark_disputed not allowed in {self.status.name}")

    def resolve_dispute(self, inv: Invoice) -> None:
        raise InvalidStateTransition(f"resolve_dispute not allowed in {self.status.name}")

    def write_off(self, inv: Invoice) -> None:
        raise InvalidStateTransition(f"write_off not allowed in {self.status.name}")

    def allowed_operations(self) -> set[str]:
        return set()


class DraftState(InvoiceState):
    """Invoice created but not yet sent.

    # PATTERN: State — ConcreteState
    """

    @property
    def status(self) -> InvoiceStatus:
        return InvoiceStatus.DRAFT

    def send(self, inv: Invoice) -> None:
        inv._set_state(SentState())

    def allowed_operations(self) -> set[str]:
        return {"edit", "send"}


class _ActiveState(InvoiceState):
    """Base state for active invoice states (Sent, PartiallyPaid, Disputed)."""

    def mark_disputed(self, inv: Invoice) -> None:
        inv._set_state(DisputedState())

    def write_off(self, inv: Invoice) -> None:
        inv._set_state(WrittenOffState())

    def allowed_operations(self) -> set[str]:
        return {
            "record_payment", "raise_blocker", "log_follow_up",
            "record_promise", "attach_document", "send_reminder", "write_off",
        }


class SentState(_ActiveState):
    """Invoice sent; awaiting payment.

    # PATTERN: State — ConcreteState
    """

    @property
    def status(self) -> InvoiceStatus:
        return InvoiceStatus.SENT

    def record_payment(self, inv: Invoice, payment: Payment) -> None:
        # State transition calculated BEFORE payment is appended to inv.payments.
        # remaining = outstanding() - payment.amount
        remaining = inv.outstanding().subtract(payment.amount)
        if remaining.is_zero():
            inv._set_state(PaidState())
        else:
            inv._set_state(PartiallyPaidState())


class PartiallyPaidState(_ActiveState):
    """Invoice partially paid.

    # PATTERN: State — ConcreteState
    """

    @property
    def status(self) -> InvoiceStatus:
        return InvoiceStatus.PARTIALLY_PAID

    def record_payment(self, inv: Invoice, payment: Payment) -> None:
        remaining = inv.outstanding().subtract(payment.amount)
        if remaining.is_zero():
            inv._set_state(PaidState())
        # else stays PARTIALLY_PAID


class DisputedState(_ActiveState):
    """Invoice disputed; payment on hold.

    # PATTERN: State — ConcreteState
    """

    @property
    def status(self) -> InvoiceStatus:
        return InvoiceStatus.DISPUTED

    def record_payment(self, inv: Invoice, payment: Payment) -> None:
        remaining = inv.outstanding().subtract(payment.amount)
        if remaining.is_zero():
            inv._set_state(PaidState())
        # else stays DISPUTED

    def resolve_dispute(self, inv: Invoice) -> None:
        if inv.amount_paid().is_positive():
            inv._set_state(PartiallyPaidState())
        else:
            inv._set_state(SentState())


class PaidState(InvoiceState):
    """Invoice fully paid — terminal.

    # PATTERN: State — ConcreteState
    """

    @property
    def status(self) -> InvoiceStatus:
        return InvoiceStatus.PAID

    def allowed_operations(self) -> set[str]:
        return {"attach_document"}


class WrittenOffState(InvoiceState):
    """Invoice written off — terminal.

    # PATTERN: State — ConcreteState
    """

    @property
    def status(self) -> InvoiceStatus:
        return InvoiceStatus.WRITTEN_OFF

    def allowed_operations(self) -> set[str]:
        return {"attach_document"}


def state_for(status: InvoiceStatus) -> InvoiceState:
    """Rebuild state object from a stored InvoiceStatus (used by mappers)."""
    _map: dict[InvoiceStatus, type] = {
        InvoiceStatus.DRAFT: DraftState,
        InvoiceStatus.SENT: SentState,
        InvoiceStatus.PARTIALLY_PAID: PartiallyPaidState,
        InvoiceStatus.DISPUTED: DisputedState,
        InvoiceStatus.PAID: PaidState,
        InvoiceStatus.WRITTEN_OFF: WrittenOffState,
    }
    return _map[status]()
