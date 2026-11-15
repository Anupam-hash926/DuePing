"""AuditEvent and Notification domain objects."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class AuditEvent:
    """Immutable record of a domain event for the audit trail."""

    id: str
    occurred_at: datetime
    event_type: str
    invoice_id: str | None
    description: str

    def __init__(
        self,
        event_type: str,
        description: str,
        occurred_at: datetime,
        invoice_id: str | None = None,
        id: str | None = None,
    ) -> None:
        object.__setattr__(self, "id", id or uuid.uuid4().hex)
        object.__setattr__(self, "occurred_at", occurred_at)
        object.__setattr__(self, "event_type", event_type)
        object.__setattr__(self, "invoice_id", invoice_id)
        object.__setattr__(self, "description", description)

    @classmethod
    def reconstitute(cls, **fields: Any) -> AuditEvent:
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj


class Notification:
    """In-app notification for significant domain events."""

    def __init__(
        self,
        message: str,
        created_at: datetime,
        is_read: bool = False,
        id: str | None = None,
    ) -> None:
        self.id: str = id or uuid.uuid4().hex
        self.message: str = message
        self.created_at: datetime = created_at
        self.is_read: bool = is_read

    @classmethod
    def reconstitute(cls, **fields: Any) -> Notification:
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj

    def mark_read(self) -> None:
        """Mark this notification as read."""
        self.is_read = True
