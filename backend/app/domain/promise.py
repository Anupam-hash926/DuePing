"""PaymentPromise — a client's commitment to pay by a date."""
from __future__ import annotations
import uuid
from datetime import date, datetime
from typing import Optional

from app.domain.enums import PromiseStatus
from app.domain.exceptions import InvalidStateTransition
from app.domain.money import Money


class PaymentPromise:
    """First-class object representing a client's payment promise."""

    def __init__(
        self,
        promised_date: date,
        created_at: datetime,
        note: str = "",
        amount: Optional[Money] = None,
        status: PromiseStatus = PromiseStatus.PENDING,
        id: Optional[str] = None,
    ) -> None:
        self.id: str = id or uuid.uuid4().hex
        self.promised_date: date = promised_date
        self.amount: Optional[Money] = amount
        self.note: str = note
        self.status: PromiseStatus = status
        self.created_at: datetime = created_at

    @classmethod
    def reconstitute(cls, **fields) -> "PaymentPromise":
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj

    def _require_pending(self) -> None:
        if self.status != PromiseStatus.PENDING:
            raise InvalidStateTransition(
                f"Promise is already {self.status.name}; cannot change status"
            )

    def is_overdue(self, today: date) -> bool:
        """True if PENDING and promised_date < today."""
        return self.status == PromiseStatus.PENDING and self.promised_date < today

    def mark_kept(self) -> None:
        """Mark this promise as kept."""
        self._require_pending()
        self.status = PromiseStatus.KEPT

    def mark_missed(self) -> None:
        """Mark this promise as missed."""
        self._require_pending()
        self.status = PromiseStatus.MISSED

    def supersede(self) -> None:
        """Mark this promise as superseded by a newer promise."""
        self._require_pending()
        self.status = PromiseStatus.SUPERSEDED
