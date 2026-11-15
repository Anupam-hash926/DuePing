"""In-memory implementations of repository ports.

# PATTERN: Repository — In-Memory Repositories
Used for fast, isolated unit and application-layer testing.
Enforces deep-copy semantics on save and get to simulate database serialization
and prevent shared mutable object bugs across boundaries.
"""
from __future__ import annotations
import copy
from typing import Dict, List, Optional

from app.application.ports import (
    InvoiceRepository, ClientRepository, ProjectRepository,
    AuditRepository, NotificationRepository, SettingsRepository,
    FailureLogRepository, HandlerFailure,
)
from app.domain.audit import AuditEvent, Notification
from app.domain.client import Client
from app.domain.enums import ActionStatus, InvoiceStatus
from app.domain.exceptions import ConcurrencyConflict, EntityNotFound
from app.domain.invoice import Invoice
from app.domain.project import Project


class InMemoryInvoiceRepository(InvoiceRepository):
    """In-memory storage for Invoices with deep-copy isolation."""

    def __init__(self) -> None:
        self._items: Dict[str, Invoice] = {}

    def get(self, id: str) -> Invoice:
        if id not in self._items:
            raise EntityNotFound(f"Invoice {id} not found")
        return copy.deepcopy(self._items[id])

    def find_by_number(self, number: str) -> Optional[Invoice]:
        for inv in self._items.values():
            if inv.invoice_number == number:
                return copy.deepcopy(inv)
        return None

    def save(self, invoice: Invoice) -> None:
        if invoice.id in self._items:
            expected_version = invoice.version
            current_version = self._items[invoice.id].version
            if current_version != expected_version:
                raise ConcurrencyConflict(
                    f"Invoice {invoice.id} was modified concurrently (expected version {expected_version}, found {current_version})"
                )
            invoice.version += 1
        else:
            invoice.version = 0
        self._items[invoice.id] = copy.deepcopy(invoice)

    def list_all(self, limit: Optional[int] = None, offset: int = 0) -> List[Invoice]:
        items = [copy.deepcopy(inv) for inv in self._items.values()]
        if offset:
            items = items[offset:]
        if limit is not None:
            items = items[:limit]
        return items

    def count_all(self) -> int:
        return len(self._items)

    def list_active(self) -> List[Invoice]:
        active_statuses = {
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.DISPUTED,
        }
        return [
            copy.deepcopy(inv)
            for inv in self._items.values()
            if inv.status in active_statuses
        ]

    def list_active_with_pending_actions(self) -> List[Invoice]:
        active_statuses = {
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.DISPUTED,
        }
        return [
            copy.deepcopy(inv)
            for inv in self._items.values()
            if inv.status in active_statuses
            and any(a.status == ActionStatus.PENDING for a in inv.actions)
        ]

    def list_by_client(self, client_id: str) -> List[Invoice]:
        return [
            copy.deepcopy(inv)
            for inv in self._items.values()
            if inv.client_id == client_id
        ]

    def list_by_project(self, project_id: str) -> List[Invoice]:
        return [
            copy.deepcopy(inv)
            for inv in self._items.values()
            if inv.project_id == project_id
        ]

    def next_invoice_sequence(self, year: int) -> int:
        import re
        pattern = re.compile(rf"^DP-{year}-(\d+)$")
        suffixes: list[int] = []
        for inv in self._items.values():
            m = pattern.match(inv.invoice_number)
            if m:
                suffixes.append(int(m.group(1)))
        return 1 + max(suffixes) if suffixes else 1


class InMemoryClientRepository(ClientRepository):
    """In-memory storage for Clients with deep-copy isolation."""

    def __init__(self) -> None:
        self._items: Dict[str, Client] = {}

    def get(self, id: str) -> Client:
        if id not in self._items:
            raise EntityNotFound(f"Client {id} not found")
        return copy.deepcopy(self._items[id])

    def find_by_email(self, email: str) -> Optional[Client]:
        norm = email.strip().lower()
        for c in self._items.values():
            if c.email.strip().lower() == norm:
                return copy.deepcopy(c)
        return None

    def save(self, client: Client) -> None:
        self._items[client.id] = copy.deepcopy(client)

    def list_all(self) -> List[Client]:
        return [copy.deepcopy(c) for c in self._items.values()]


class InMemoryProjectRepository(ProjectRepository):
    """In-memory storage for Projects with deep-copy isolation."""

    def __init__(self) -> None:
        self._items: Dict[str, Project] = {}

    def get(self, id: str) -> Project:
        if id not in self._items:
            raise EntityNotFound(f"Project {id} not found")
        return copy.deepcopy(self._items[id])

    def save(self, project: Project) -> None:
        self._items[project.id] = copy.deepcopy(project)

    def list_all(self) -> List[Project]:
        return [copy.deepcopy(p) for p in self._items.values()]

    def list_by_client(self, client_id: str) -> List[Project]:
        return [
            copy.deepcopy(p)
            for p in self._items.values()
            if p.client_id == client_id
        ]


class InMemoryAuditRepository(AuditRepository):
    """In-memory storage for AuditEvents."""

    def __init__(self) -> None:
        self._events: List[AuditEvent] = []

    def add(self, event: AuditEvent) -> None:
        self._events.append(copy.deepcopy(event))

    def list(
        self,
        invoice_id: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> List[AuditEvent]:
        # Newest first
        reversed_events = list(reversed(self._events))
        if invoice_id is not None:
            filtered = [e for e in reversed_events if e.invoice_id == invoice_id]
        else:
            filtered = reversed_events
        return [copy.deepcopy(e) for e in filtered[offset : offset + limit]]

    def count(self, invoice_id: Optional[str] = None) -> int:
        if invoice_id is not None:
            return sum(1 for e in self._events if e.invoice_id == invoice_id)
        return len(self._events)


class InMemoryNotificationRepository(NotificationRepository):
    """In-memory storage for Notifications."""

    def __init__(self) -> None:
        self._items: List[Notification] = []

    def add(self, n: Notification) -> None:
        self._items.append(copy.deepcopy(n))

    def list(
        self,
        unread_only: bool = False,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Notification]:
        # Newest first
        reversed_items = list(reversed(self._items))
        if unread_only:
            filtered = [n for n in reversed_items if not n.is_read]
        else:
            filtered = reversed_items
        if offset:
            filtered = filtered[offset:]
        if limit is not None:
            filtered = filtered[:limit]
        return [copy.deepcopy(n) for n in filtered]

    def count(self, unread_only: bool = False) -> int:
        if unread_only:
            return sum(1 for n in self._items if not n.is_read)
        return len(self._items)

    def mark_all_read(self) -> None:
        for n in self._items:
            n.mark_read()


class InMemorySettingsRepository(SettingsRepository):
    """In-memory key-value store for application settings."""

    def __init__(self, initial: Optional[Dict[str, str]] = None) -> None:
        self._data: Dict[str, str] = dict(initial or {})

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        return self._data.get(key, default)

    def set(self, key: str, value: str) -> None:
        self._data[key] = str(value)


class InMemoryFailureLogRepository(FailureLogRepository):
    """In-memory store for listener execution failures."""

    def __init__(self) -> None:
        self._items: List[HandlerFailure] = []

    def add(self, failure: HandlerFailure) -> None:
        import uuid
        f_copy = copy.deepcopy(failure)
        if not f_copy.id:
            f_copy.id = uuid.uuid4().hex
        self._items.insert(0, f_copy)

    def list(self, limit: int = 50) -> List[HandlerFailure]:
        return [copy.deepcopy(f) for f in self._items[:limit]]
