"""FollowUp — immutable log entry of a client contact."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional

from app.domain.enums import Channel, FollowUpOutcome


from dataclasses import dataclass

@dataclass(frozen=True)
class FollowUp:
    """Immutable log entry of a follow-up contact with a client."""

    id: str
    contact_date: datetime
    channel: Channel
    notes: str
    outcome: FollowUpOutcome

    def __init__(
        self,
        contact_date: datetime,
        channel: Channel,
        notes: str,
        outcome: FollowUpOutcome,
        id: Optional[str] = None,
    ) -> None:
        object.__setattr__(self, "id", id or uuid.uuid4().hex)
        object.__setattr__(self, "contact_date", contact_date)
        object.__setattr__(self, "channel", channel)
        object.__setattr__(self, "notes", notes)
        object.__setattr__(self, "outcome", outcome)

    @classmethod
    def reconstitute(cls, **fields) -> "FollowUp":
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj
