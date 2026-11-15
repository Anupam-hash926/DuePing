"""In-process synchronous EventBus for publishing domain events to observers.

# PATTERN: Observer — Subject
Synchronous in-process publish/subscribe. Exception in one listener does not stop others;
failures are recorded for logging/testing.
"""
from __future__ import annotations
import logging
from typing import Any, Callable, Dict, List, Type, TypeVar

from app.application.ports import InvoiceRepository
from app.domain.events import DomainEvent
from app.domain.invoice import Invoice

logger = logging.getLogger(__name__)

E = TypeVar("E", bound=DomainEvent)
EventHandler = Callable[[DomainEvent], None]


class EventBus:
    """Synchronous in-process event bus.

    # PATTERN: Observer — Subject (Observable)
    """

    def __init__(self) -> None:
        self._handlers: Dict[Type[DomainEvent], List[Callable[[Any], None]]] = {}
        self._global_handlers: List[EventHandler] = []
        self.failures: List[tuple[DomainEvent, Exception]] = []

    def subscribe(self, event_type: Type[E], handler: Callable[[E], None]) -> None:
        """Subscribe a handler to a specific event type."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)  # type: ignore[arg-type]

    def subscribe_all(self, handler: EventHandler) -> None:
        """Subscribe a handler to all domain events."""
        self._global_handlers.append(handler)

    def publish(self, event: DomainEvent) -> None:
        """Publish a single domain event to all subscribed observers."""
        # 1. Global handlers
        for handler in list(self._global_handlers):
            try:
                handler(event)
            except Exception as exc:
                logger.exception("Global event handler %r failed on event %r", handler, event)
                self.failures.append((event, exc))

        # 2. Specific handlers
        specific = self._handlers.get(type(event), [])
        for handler in list(specific):
            try:
                handler(event)
            except Exception as exc:
                logger.exception("Event handler %r failed on event %r", handler, event)
                self.failures.append((event, exc))

    def publish_all(self, events: List[DomainEvent]) -> None:
        """Publish a list of domain events in order using a processing queue to prevent infinite reentrancy."""
        if not hasattr(self, "_event_queue"):
            self._event_queue: List[DomainEvent] = []
            self._is_dispatching: bool = False

        self._event_queue.extend(events)

        if self._is_dispatching:
            return

        self._is_dispatching = True
        try:
            while self._event_queue:
                ev = self._event_queue.pop(0)
                self.publish(ev)
        finally:
            self._is_dispatching = False


def save_and_publish(repo: InvoiceRepository, bus: EventBus, invoice: Invoice) -> None:
    """Save an invoice aggregate root first, then publish all its pulled domain events.

    Always pull events before saving or save a copy with pulled events, ensuring
    stored invoices do not retain pending events in memory.
    """
    events = invoice.pull_events()
    repo.save(invoice)
    bus.publish_all(events)
