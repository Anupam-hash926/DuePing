"""In-process synchronous EventBus for publishing domain events to observers.

# PATTERN: Observer — Subject
Synchronous in-process publish/subscribe with thread-safe subscription, thread-local
dispatch queue, and visible failure tracking.
"""
from __future__ import annotations
import collections
from datetime import datetime
import logging
import threading
from typing import Any, Callable, Deque, Dict, List, Optional, Type, TypeVar

from app.application.ports import FailureLogRepository, HandlerFailure, InvoiceRepository
from app.domain.events import DomainEvent
from app.domain.exceptions import ConcurrencyConflict
from app.domain.invoice import Invoice

logger = logging.getLogger(__name__)

E = TypeVar("E", bound=DomainEvent)
EventHandler = Callable[[DomainEvent], None]


class EventBus:
    """Synchronous in-process event bus.

    # PATTERN: Observer — Subject (Observable)
    """

    def __init__(self, failure_log: Optional[FailureLogRepository] = None) -> None:
        self._handlers: Dict[Type[DomainEvent], List[Callable[[Any], None]]] = {}
        self._global_handlers: List[EventHandler] = []
        self._lock = threading.RLock()
        self._local = threading.local()
        self.failures: Deque[tuple[DomainEvent, Exception]] = collections.deque(maxlen=100)
        self._failure_log = failure_log

    def set_failure_log(self, failure_log: FailureLogRepository) -> None:
        self._failure_log = failure_log

    def subscribe(self, event_type: Type[E], handler: Callable[[E], None]) -> None:
        """Subscribe a handler to a specific event type."""
        with self._lock:
            if event_type not in self._handlers:
                self._handlers[event_type] = []
            self._handlers[event_type].append(handler)  # type: ignore[arg-type]

    def subscribe_all(self, handler: EventHandler) -> None:
        """Subscribe a handler to all domain events."""
        with self._lock:
            self._global_handlers.append(handler)

    def _record_failure(self, event: DomainEvent, handler: Callable[..., Any], exc: Exception) -> None:
        logger.exception("Event handler %r failed on event %r", handler, event)
        self.failures.append((event, exc))
        if self._failure_log is not None:
            now = getattr(event, "occurred_at", None) or datetime.now()
            handler_name = getattr(handler, "__qualname__", getattr(handler, "__name__", str(handler)))
            hf = HandlerFailure(
                occurred_at=now,
                event_type=event.event_type,
                handler=handler_name,
                error=str(exc),
            )
            try:
                self._failure_log.add(hf)
            except Exception:
                logger.exception("Failed to write to FailureLogRepository")

    def publish(self, event: DomainEvent) -> None:
        """Publish a single domain event to all subscribed observers."""
        with self._lock:
            globals_copy = list(self._global_handlers)
            specifics_copy = list(self._handlers.get(type(event), []))

        for handler in globals_copy:
            try:
                handler(event)
            except Exception as exc:
                self._record_failure(event, handler, exc)

        for handler in specifics_copy:
            try:
                handler(event)
            except Exception as exc:
                self._record_failure(event, handler, exc)

    def publish_all(self, events: List[DomainEvent]) -> None:
        """Publish a list of domain events in order using a per-thread queue to prevent infinite reentrancy."""
        if not hasattr(self._local, "queue"):
            self._local.queue = []
            self._local.is_dispatching = False

        self._local.queue.extend(events)

        if self._local.is_dispatching:
            return

        self._local.is_dispatching = True
        try:
            while self._local.queue:
                ev = self._local.queue.pop(0)
                self.publish(ev)
        finally:
            self._local.is_dispatching = False


def save_and_publish(repo: InvoiceRepository, bus: EventBus, invoice: Invoice) -> None:
    """Save an invoice aggregate root first, then publish all its pulled domain events.

    Always pull events before saving or save a copy with pulled events, ensuring
    stored invoices do not retain pending events in memory.
    """
    events = invoice.pull_events()
    repo.save(invoice)
    bus.publish_all(events)


def mutate_invoice(
    repo: InvoiceRepository,
    bus: EventBus,
    invoice_id: str,
    fn: Callable[[Invoice], Any],
    retries: int = 2,
) -> Invoice:
    """Safely mutate an invoice with optimistic concurrency retry loop."""
    for attempt in range(retries + 1):
        invoice = repo.get(invoice_id)
        fn(invoice)
        try:
            save_and_publish(repo, bus, invoice)
            return repo.get(invoice.id)
        except ConcurrencyConflict:
            if attempt == retries:
                raise
    raise ConcurrencyConflict(f"Failed to mutate invoice {invoice_id} after {retries} retries")
