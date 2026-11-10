"""FastAPI dependency injection and composition root.

Constructs the application singleton CollectionFacade wired with SQLAlchemy
repositories, SimulatedClock, EventBus, all 4 listeners, ActionCenter,
ReminderFactory, InvoiceFactory, Importer, ReportService, and DailyCheckService.
"""
from __future__ import annotations

from typing import Optional

from app.application.action_center import ActionCenter
from app.application.clock import SimulatedClock, SystemClock
from app.application.daily_check import DailyCheckService
from app.application.event_bus import EventBus
from app.application.facade import CollectionFacade
from app.application.importing import InvoiceImporter
from app.application.invoice_factory import InvoiceFactory
from app.application.listeners import (
    ActionGenerationListener,
    AuditLogListener,
    NotificationListener,
    ReliabilityListener,
)
from app.application.playbook import ResolutionPlaybook
from app.application.prioritization import PrioritizationRegistry
from app.application.reminders import ReminderFactory
from app.application.reports import ReportService
from app.infrastructure.db import SessionLocal
from app.infrastructure.sqlalchemy_repositories import (
    SqlAlchemyAuditRepository,
    SqlAlchemyClientRepository,
    SqlAlchemyInvoiceRepository,
    SqlAlchemyNotificationRepository,
    SqlAlchemyProjectRepository,
    SqlAlchemySettingsRepository,
)


def create_app_facade() -> CollectionFacade:
    """Build a fully wired CollectionFacade using real SQLAlchemy repositories."""
    invoice_repo = SqlAlchemyInvoiceRepository(SessionLocal)
    client_repo = SqlAlchemyClientRepository(SessionLocal)
    project_repo = SqlAlchemyProjectRepository(SessionLocal)
    settings_repo = SqlAlchemySettingsRepository(SessionLocal)
    audit_repo = SqlAlchemyAuditRepository(SessionLocal)
    notification_repo = SqlAlchemyNotificationRepository(SessionLocal)

    clock = SimulatedClock(settings_repo)
    playbook = ResolutionPlaybook()
    registry = PrioritizationRegistry()
    bus = EventBus()
    reminder_factory = ReminderFactory()
    invoice_factory = InvoiceFactory(invoice_repo)

    # Register listeners
    AuditLogListener(audit_repo).register(bus)
    ActionGenerationListener(
        invoice_repo=invoice_repo,
        client_repo=client_repo,
        playbook=playbook,
        reminder_factory=reminder_factory,
        clock=clock,
        bus=bus,
    ).register(bus)
    ReliabilityListener(client_repo).register(bus)
    NotificationListener(notification_repo, clock).register(bus)

    action_center = ActionCenter(invoice_repo, client_repo, registry, clock)
    importer = InvoiceImporter(
        invoice_repo=invoice_repo,
        client_repo=client_repo,
        project_repo=project_repo,
        invoice_factory=invoice_factory,
        bus=bus,
    )
    report_service = ReportService(
        invoice_repo=invoice_repo,
        client_repo=client_repo,
        settings=settings_repo,
        clock=clock,
    )
    daily_check = DailyCheckService(
        invoice_repo=invoice_repo,
        bus=bus,
        clock=clock,
    )

    facade = CollectionFacade(
        invoice_repo=invoice_repo,
        client_repo=client_repo,
        project_repo=project_repo,
        audit_repo=audit_repo,
        notification_repo=notification_repo,
        settings_repo=settings_repo,
        clock=clock,
        event_bus=bus,
        action_center=action_center,
        reminder_factory=reminder_factory,
        invoice_factory=invoice_factory,
        invoice_importer=importer,
        report_service=report_service,
        daily_check_service=daily_check,
        playbook=playbook,
        reset_demo_callable=None,
    )

    # Attach reset_demo_data
    from app.infrastructure.seed import reset_demo_data

    facade.reset_demo_callable = lambda: reset_demo_data(facade)

    return facade


# Application singleton
_facade_instance: Optional[CollectionFacade] = None


def get_facade() -> CollectionFacade:
    """FastAPI dependency yielding the singleton CollectionFacade."""
    global _facade_instance
    if _facade_instance is None:
        _facade_instance = create_app_facade()
    return _facade_instance


def set_facade(facade: Optional[CollectionFacade]) -> None:
    """Set or reset the global facade instance (used in tests/fixtures)."""
    global _facade_instance
    _facade_instance = facade
