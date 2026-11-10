"""Repository and Clock ports (interfaces) for the DuePing application.

# PATTERN: Repository — Repository Interfaces
Application services depend strictly on these abstract interfaces, never on
concrete persistence implementations (Dependency Inversion Principle).
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import List, Optional

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
    def find_by_number(self, number: str) -> Optional[Invoice]:
        """Find invoice by its unique invoice_number or return None."""
        ...

    @abstractmethod
    def save(self, invoice: Invoice) -> None:
        """Insert or update the entire aggregate root and child collections."""
        ...

    @abstractmethod
    def list_all(self) -> List[Invoice]:
        """List all invoices."""
        ...

    @abstractmethod
    def list_active(self) -> List[Invoice]:
        """List active invoices (SENT, PARTIALLY_PAID, DISPUTED)."""
        ...

    @abstractmethod
    def list_by_client(self, client_id: str) -> List[Invoice]:
        """List all invoices for a given client."""
        ...

    @abstractmethod
    def list_by_project(self, project_id: str) -> List[Invoice]:
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
    def find_by_email(self, email: str) -> Optional[Client]:
        """Find client by email address or return None."""
        ...

    @abstractmethod
    def save(self, client: Client) -> None:
        """Insert or update client."""
        ...

    @abstractmethod
    def list_all(self) -> List[Client]:
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
    def list_all(self) -> List[Project]:
        """List all projects."""
        ...

    @abstractmethod
    def list_by_client(self, client_id: str) -> List[Project]:
        """List all projects for a specific client."""
        ...


class AuditRepository(ABC):
    """Port for audit log persistence."""

    @abstractmethod
    def add(self, event: AuditEvent) -> None:
        """Append an audit event to the store."""
        ...

    @abstractmethod
    def list(self, invoice_id: Optional[str] = None, limit: int = 200) -> List[AuditEvent]:
        """List audit events ordered newest first."""
        ...


class NotificationRepository(ABC):
    """Port for in-app notification persistence."""

    @abstractmethod
    def add(self, n: Notification) -> None:
        """Add a notification."""
        ...

    @abstractmethod
    def list(self, unread_only: bool = False) -> List[Notification]:
        """List notifications, optionally filtering for unread only."""
        ...

    @abstractmethod
    def mark_all_read(self) -> None:
        """Mark all notifications as read."""
        ...


class SettingsRepository(ABC):
    """Port for application settings key-value persistence."""

    @abstractmethod
    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Get setting value or default."""
        ...

    @abstractmethod
    def set(self, key: str, value: str) -> None:
        """Set setting value."""
        ...
