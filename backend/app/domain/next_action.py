"""NextAction — a concrete follow-up task on an invoice."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from app.domain.enums import ActionSource, ActionStatus, Priority
from app.domain.exceptions import DomainValidationError, InvalidStateTransition


class NextAction:
    """A concrete task to be performed to resolve an invoice collection issue."""

    def __init__(
        self,
        description: str,
        priority: Priority,
        due_date: date,
        source: ActionSource,
        created_at: datetime,
        source_ref: str | None = None,
        status: ActionStatus = ActionStatus.PENDING,
        completed_at: datetime | None = None,
        id: str | None = None,
    ) -> None:
        self.id: str = id or uuid.uuid4().hex
        self.description: str = description
        self.priority: Priority = priority
        self.due_date: date = due_date
        self.status: ActionStatus = status
        self.source: ActionSource = source
        self.source_ref: str | None = source_ref
        self.created_at: datetime = created_at
        self.completed_at: datetime | None = completed_at

    @classmethod
    def reconstitute(cls, **fields: Any) -> NextAction:
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj

    def is_due_today(self, today: date) -> bool:
        """True if due_date == today."""
        return self.due_date == today

    def is_overdue(self, today: date) -> bool:
        """True if PENDING and due_date < today."""
        return self.status == ActionStatus.PENDING and self.due_date < today

    def is_actionable(self, today: date) -> bool:
        """True if PENDING and due_date <= today (due today or overdue)."""
        return self.status == ActionStatus.PENDING and self.due_date <= today

    def mark_completed(self, now: datetime) -> None:
        """Mark this action as completed with a timestamp."""
        if self.status != ActionStatus.PENDING:
            raise InvalidStateTransition(
                f"Cannot complete action in {self.status.name} status"
            )
        self.status = ActionStatus.COMPLETED
        self.completed_at = now

    def reschedule(self, new_date: date, today: date) -> None:
        """Reschedule to new_date; must be >= today."""
        if self.status != ActionStatus.PENDING:
            raise InvalidStateTransition(
                f"Cannot reschedule action in {self.status.name} status"
            )
        if new_date < today:
            raise DomainValidationError(f"New due date {new_date} cannot be in the past")
        self.due_date = new_date

    def cancel(self) -> None:
        """Cancel this action (no status check — called by aggregate)."""
        self.status = ActionStatus.CANCELLED
