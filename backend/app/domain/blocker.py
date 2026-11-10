"""PaymentBlocker entity — structured reason why an invoice is unpaid."""
from __future__ import annotations
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app.domain.enums import BlockerType, BlockerStatus
from app.domain.exceptions import InvalidStateTransition


@dataclass
class PaymentBlocker:
    """Structured blocker on a payment. Drives the resolution playbook."""

    id: str
    type: BlockerType
    description: str
    assigned_to: Optional[str]
    status: BlockerStatus
    created_at: datetime
    resolved_at: Optional[datetime]

    def __init__(
        self,
        type: BlockerType,
        description: str,
        created_at: datetime,
        assigned_to: Optional[str] = None,
        status: BlockerStatus = BlockerStatus.OPEN,
        resolved_at: Optional[datetime] = None,
        id: Optional[str] = None,
    ) -> None:
        self.id = id or uuid.uuid4().hex
        self.type = type
        self.description = description
        self.assigned_to = assigned_to
        self.status = status
        self.created_at = created_at
        self.resolved_at = resolved_at

    @classmethod
    def reconstitute(cls, **fields) -> "PaymentBlocker":
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj

    def _check_not_resolved(self) -> None:
        if self.status == BlockerStatus.RESOLVED:
            raise InvalidStateTransition("Cannot modify a resolved blocker")

    def assign_owner(self, owner: str) -> None:
        """Assign an owner to this blocker."""
        self._check_not_resolved()
        self.assigned_to = owner

    def update_status(self, status: BlockerStatus) -> None:
        """Move between OPEN and IN_PROGRESS. Use resolve() for RESOLVED."""
        self._check_not_resolved()
        if status == BlockerStatus.RESOLVED:
            raise InvalidStateTransition(
                "Use resolve() to mark a blocker as resolved"
            )
        if status not in (BlockerStatus.OPEN, BlockerStatus.IN_PROGRESS):
            raise InvalidStateTransition(f"Invalid status transition to {status}")
        self.status = status

    def resolve(self, now: datetime) -> None:
        """Mark this blocker as resolved."""
        self._check_not_resolved()
        self.status = BlockerStatus.RESOLVED
        self.resolved_at = now

    def is_open(self) -> bool:
        """True if the blocker is not yet resolved."""
        return self.status != BlockerStatus.RESOLVED
