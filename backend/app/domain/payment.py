"""Payment value object — immutable record of a payment received."""
from __future__ import annotations
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

from app.domain.money import Money
from app.domain.enums import PaymentMethod


# PATTERN: Value Object — Payment has identity (id) but is immutable after creation.
@dataclass(frozen=True)
class Payment:
    """Immutable record of a payment. Created once, never mutated."""

    id: str
    amount: Money
    payment_date: date
    method: PaymentMethod
    reference_number: Optional[str]
    recorded_at: datetime

    def __init__(
        self,
        amount: Money,
        payment_date: date,
        method: PaymentMethod,
        recorded_at: datetime,
        reference_number: Optional[str] = None,
        id: Optional[str] = None,
    ) -> None:
        object.__setattr__(self, "id", id or uuid.uuid4().hex)
        object.__setattr__(self, "amount", amount)
        object.__setattr__(self, "payment_date", payment_date)
        object.__setattr__(self, "method", method)
        object.__setattr__(self, "reference_number", reference_number)
        object.__setattr__(self, "recorded_at", recorded_at)

    @classmethod
    def reconstitute(cls, **fields) -> "Payment":
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj

    def is_valid(self) -> bool:
        """True if the payment amount is positive."""
        return self.amount.is_positive()

    def details(self) -> str:
        """One-line payment summary."""
        ref = f" (ref: {self.reference_number})" if self.reference_number else ""
        return f"{self.amount.format()} via {self.method.name} on {self.payment_date}{ref}"
