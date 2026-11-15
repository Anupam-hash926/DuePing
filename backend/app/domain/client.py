"""Client aggregate — represents a client with payment reliability tracking."""
from __future__ import annotations
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Optional

from app.domain.exceptions import DomainValidationError
from app.domain.money import Money


# PATTERN: Aggregate Root — Client owns its state; reliability is computed from promises.
@dataclass
class Client:
    """Client entity. Tracks payment promises for reliability scoring."""

    id: str
    name: str
    email: str
    phone: Optional[str]
    company_name: Optional[str]
    promises_kept: int
    promises_missed: int
    created_at: datetime

    def __init__(
        self,
        name: str,
        email: str,
        phone: Optional[str] = None,
        company_name: Optional[str] = None,
        id: Optional[str] = None,
        promises_kept: int = 0,
        promises_missed: int = 0,
        created_at: Optional[datetime] = None,
    ) -> None:
        if not name or not name.strip():
            raise DomainValidationError("Client name cannot be empty")
        if "@" not in email:
            raise DomainValidationError(f"Invalid email: {email!r}")
        self.id = id or uuid.uuid4().hex
        self.name = name.strip()
        self.email = email.strip().lower()
        self.phone = phone
        self.company_name = company_name
        self.promises_kept = promises_kept
        self.promises_missed = promises_missed
        self.created_at = created_at or datetime(2024, 1, 1)  # placeholder; real clock injected above

    @classmethod
    def reconstitute(cls, **fields) -> "Client":
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj

    def update_contact_details(
        self,
        name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> None:
        """Update contact details with validation."""
        if name is not None:
            if not name.strip():
                raise DomainValidationError("Client name cannot be empty")
            self.name = name.strip()
        if email is not None:
            if "@" not in email:
                raise DomainValidationError(f"Invalid email: {email!r}")
            self.email = email.strip().lower()
        if phone is not None:
            self.phone = phone
        if company_name is not None:
            self.company_name = company_name

    def register_promise_kept(self) -> None:
        """Increment kept promises counter."""
        self.promises_kept += 1

    def register_promise_missed(self) -> None:
        """Increment missed promises counter."""
        self.promises_missed += 1

    def reliability_score(self) -> int:
        """0–100 score: 100 if no resolved promises, else round(100 * kept / total)."""
        total = self.promises_kept + self.promises_missed
        if total == 0:
            return 100
        return round(100 * self.promises_kept / total)

    def risk_level(self) -> str:
        """LOW if score >= 80, MEDIUM if 50-79, else HIGH."""
        score = self.reliability_score()
        if score >= 80:
            return "LOW"
        if score >= 50:
            return "MEDIUM"
        return "HIGH"

    def outstanding_balance(self, invoices: Iterable) -> Money:
        """Sum outstanding() of active invoices (SENT, PARTIALLY_PAID, DISPUTED)."""
        from app.domain.enums import InvoiceStatus

        active_statuses = {
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.DISPUTED,
        }
        total: Optional[Money] = None
        for inv in invoices:
            if inv.status in active_statuses:
                if total is None:
                    total = inv.outstanding()
                else:
                    total = total.add(inv.outstanding())
        if total is None:
            return Money.zero()
        return total
