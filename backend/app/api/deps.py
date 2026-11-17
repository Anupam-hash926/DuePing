"""FastAPI dependency injection and composition root.

Constructs the application singleton CollectionFacade wired with SQLAlchemy
repositories, SimulatedClock, EventBus, all 4 listeners, ActionCenter,
ReminderFactory, InvoiceFactory, Importer, ReportService, and DailyCheckService.
"""
from __future__ import annotations

from app.application.action_center import ActionCenter
from app.application.clock import SimulatedClock
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
from app.application.services.client_service import ClientService
from app.application.services.invoice_commands import InvoiceCommands
from app.application.services.reminder_service import ReminderService
from app.application.services.system_service import SystemService
from app.infrastructure.db import SessionLocal
from app.infrastructure.sqlalchemy_repositories import (
    SqlAlchemyAuditRepository,
    SqlAlchemyClientRepository,
    SqlAlchemyFailureLogRepository,
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
    failure_repo = SqlAlchemyFailureLogRepository(SessionLocal)

    clock = SimulatedClock(settings_repo)
    playbook = ResolutionPlaybook()
    registry = PrioritizationRegistry()
    bus = EventBus(failure_log=failure_repo)
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

    action_center = ActionCenter(invoice_repo, client_repo, registry, clock, reminder_factory=reminder_factory)
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

    client_service = ClientService(
        client_repo=client_repo,
        project_repo=project_repo,
        invoice_repo=invoice_repo,
        clock=clock,
    )
    invoice_commands = InvoiceCommands(
        invoice_repo=invoice_repo,
        client_repo=client_repo,
        project_repo=project_repo,
        invoice_factory=invoice_factory,
        event_bus=bus,
        clock=clock,
    )
    reminder_service = ReminderService(
        reminder_factory=reminder_factory,
        invoice_repo=invoice_repo,
        client_repo=client_repo,
        settings_repo=settings_repo,
        clock=clock,
    )
    system_service = SystemService(
        clock=clock,
        settings_repo=settings_repo,
        audit_repo=audit_repo,
        notification_repo=notification_repo,
        daily_check_service=daily_check,
        failure_log_repo=failure_repo,
        reset_callable=None,
    )

    facade = CollectionFacade(
        invoice_commands=invoice_commands,
        client_service=client_service,
        reminder_service=reminder_service,
        system_service=system_service,
        report_service=report_service,
        action_center=action_center,
        invoice_importer=importer,
        invoice_repo=invoice_repo,
    )

    from app.infrastructure.seed import reset_demo_data
    system_service.reset_callable = lambda: reset_demo_data(facade)

    return facade


# Application singleton
_facade_instance: CollectionFacade | None = None


def get_facade() -> CollectionFacade:
    """FastAPI dependency yielding the singleton CollectionFacade."""
    global _facade_instance
    if _facade_instance is None:
        _facade_instance = create_app_facade()
    return _facade_instance


def set_facade(facade: CollectionFacade | None) -> None:
    """Set or reset the global facade instance (used in tests/fixtures)."""
    global _facade_instance
    _facade_instance = facade
