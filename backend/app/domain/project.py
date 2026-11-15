"""Project entity — an optional grouping of invoices for a client."""
from __future__ import annotations
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Any, Optional

from app.domain.exceptions import DomainValidationError


@dataclass
class Project:
    """Project entity. Status is free-text (not behavioural state)."""

    id: str
    client_id: str
    project_name: str
    description: str
    start_date: date
    status: str  # free text: "Active", "Completed", etc.

    def __init__(
        self,
        client_id: str,
        project_name: str,
        start_date: date,
        description: str = "",
        status: str = "Active",
        id: Optional[str] = None,
    ) -> None:
        if not project_name or not project_name.strip():
            raise DomainValidationError("Project name cannot be empty")
        self.id = id or uuid.uuid4().hex
        self.client_id = client_id
        self.project_name = project_name.strip()
        self.description = description
        self.start_date = start_date
        self.status = status

    @classmethod
    def reconstitute(cls, **fields: Any) -> "Project":
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj

    def update_status(self, status: str) -> None:
        """Update the project status (free-text)."""
        self.status = status

    def rename(self, name: str) -> None:
        """Rename the project."""
        if not name or not name.strip():
            raise DomainValidationError("Project name cannot be empty")
        self.project_name = name.strip()
