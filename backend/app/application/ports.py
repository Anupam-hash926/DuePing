"""Repository and Clock ports (interfaces) for the DuePing application.

# PATTERN: Repository — Repository Interfaces
Application services depend strictly on these abstract interfaces, never on
concrete persistence implementations (Dependency Inversion Principle).
"""
from __future__ import annotations

import builtins
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime

from app.domain.audit import AuditEvent, Notification
from app.domain.client import Client
from app.domain.invoice import Invoice
from app.domain.project import Project


class Clock(ABC):
    """Port for time-reading. Domain never reads the system clock directly."""

    @abstractmethod
    def today(self) -> date:
        """Current date in UTC / simulated zone."""
        ...

    @abstractmethod
    def now(self) -> datetime:
        """Current datetime in UTC / simulated zone."""
        ...


class InvoiceRepository(ABC):
    """Port for invoice aggregate persistence."""

    @abstractmethod
    def get(self, id: str) -> Invoice:
        """Retrieve full aggregate by ID or raise EntityNotFound."""
        ...

    @abstractmethod
    def find_by_number(self, number: str) -> Invoice | None:
        """Find invoice by its unique invoice_number or return None."""
        ...

    @abstractmethod
    def save(self, invoice: Invoice) -> None:
        """Insert or update the entire aggregate root and child collections."""
        ...

    @abstractmethod
    def list_all(self, limit: int | None = None, offset: int = 0) -> list[Invoice]:
        """List all invoices with optional pagination."""
        ...

    @abstractmethod
    def count_all(self) -> int:
        """Total count of all invoices."""
        ...

    @abstractmethod
    def list_active(self) -> list[Invoice]:
        """List active invoices (SENT, PARTIALLY_PAID, DISPUTED)."""
        ...

    @abstractmethod
    def list_active_with_pending_actions(self) -> list[Invoice]:
        """List active invoices that have at least one PENDING action."""
        ...

    @abstractmethod
    def list_by_client(self, client_id: str) -> list[Invoice]:
        """List all invoices for a given client."""
        ...

    @abstractmethod
    def list_by_project(self, project_id: str) -> list[Invoice]:
        """List all invoices for a given project."""
        ...

    @abstractmethod
    def next_invoice_sequence(self, year: int) -> int:
        """Return the next 1-based sequence number for invoice numbering in given year."""
        ...


class ClientRepository(ABC):
    """Port for client persistence."""

    @abstractmethod
    def get(self, id: str) -> Client:
        """Retrieve client by ID or raise EntityNotFound."""
        ...

    @abstractmethod
    def find_by_email(self, email: str) -> Client | None:
        """Find client by email address or return None."""
        ...

    @abstractmethod
    def save(self, client: Client) -> None:
        """Insert or update client."""
        ...

    @abstractmethod
    def list_all(self) -> list[Client]:
        """List all clients."""
        ...


class ProjectRepository(ABC):
    """Port for project persistence."""

    @abstractmethod
    def get(self, id: str) -> Project:
        """Retrieve project by ID or raise EntityNotFound."""
        ...

    @abstractmethod
    def save(self, project: Project) -> None:
        """Insert or update project."""
        ...

    @abstractmethod
    def list_all(self) -> list[Project]:
        """List all projects."""
        ...

    @abstractmethod
    def list_by_client(self, client_id: str) -> list[Project]:
        """List all projects for a specific client."""
        ...


class AuditRepository(ABC):
    """Port for audit log persistence."""

    @abstractmethod
    def add(self, event: AuditEvent) -> None:
        """Append an audit event to the store."""
        ...

    @abstractmethod
    def list(
        self,
        invoice_id: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> builtins.list[AuditEvent]:
        """List audit events ordered newest first with pagination."""
        ...

    @abstractmethod
    def count(self, invoice_id: str | None = None) -> int:
        """Count total audit events, optionally filtered by invoice."""
        ...


class NotificationRepository(ABC):
    """Port for in-app notification persistence."""

    @abstractmethod
    def add(self, n: Notification) -> None:
        """Add a notification."""
        ...

    @abstractmethod
    def list(
        self,
        unread_only: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> builtins.list[Notification]:
        """List notifications, optionally filtering for unread only with pagination."""
        ...

    @abstractmethod
    def count(self, unread_only: bool = False) -> int:
        """Count total notifications."""
        ...

    @abstractmethod
    def mark_all_read(self) -> None:
        """Mark all notifications as read."""
        ...


class SettingsRepository(ABC):
    """Port for application settings key-value persistence."""

    @abstractmethod
    def get(self, key: str, default: str | None = None) -> str | None:
        """Get setting value or default."""
        ...

    @abstractmethod
    def set(self, key: str, value: str) -> None:
        """Set setting value."""
        ...


@dataclass
class HandlerFailure:
    """Record of a failed domain event handler."""

    occurred_at: datetime
    event_type: str
    handler: str
    error: str
    id: str | None = None


class FailureLogRepository(ABC):
    """Port for logging listener/handler failures."""

    @abstractmethod
    def add(self, failure: HandlerFailure) -> None:
        """Record a handler failure."""
        ...

    @abstractmethod
    def list(self, limit: int = 50) -> builtins.list[HandlerFailure]:
        """List recent failures, newest first."""
        ...
