"""CollectionFacade — Unified application boundary delegating to cohesive services."""
from __future__ import annotations
from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

from app.application.action_center import ActionCenter, ActionCenterView
from app.application.daily_check import DailyCheckSummary
from app.application.event_bus import EventBus
from app.application.importing import ImportResult, InvoiceImporter, InvoiceSourceFactory
from app.application.ports import (
    Clock, ClientRepository, HandlerFailure, InvoiceRepository,
    ProjectRepository, SettingsRepository,
)
from app.application.reminders import GeneratedReminder
from app.application.reports import CollectionReport, ReportService
from app.application.services.client_service import ClientService
from app.application.services.invoice_commands import InvoiceCommands
from app.application.services.reminder_service import ReminderService
from app.application.services.system_service import SystemService
from app.domain.audit import AuditEvent, Notification
from app.domain.client import Client
from app.domain.enums import (
    BlockerStatus, BlockerType, Channel, DocumentType, FollowUpOutcome,
    InvoiceStatus, PaymentMethod, Priority, ReminderTone,
)
from app.domain.invoice import Invoice
from app.domain.money import Money
from app.domain.project import Project


class CollectionFacade:
    """Facade orchestrating collection operations across domain and application services."""

    def __init__(
        self,
        invoice_commands: InvoiceCommands,
        client_service: ClientService,
        reminder_service: ReminderService,
        system_service: SystemService,
        report_service: ReportService,
        action_center: ActionCenter,
        invoice_importer: InvoiceImporter,
        invoice_repo: InvoiceRepository,
    ) -> None:
        self.invoice_commands, self.client_service = invoice_commands, client_service
        self.reminder_service, self.system_service = reminder_service, system_service
        self.report_service, self.action_center = report_service, action_center
        self.invoice_importer, self.invoice_repo = invoice_importer, invoice_repo

    # Clients & Projects
    def create_client(self, name: str, email: str, phone: Optional[str] = None, company_name: Optional[str] = None) -> Client:
        return self.client_service.create_client(name, email, phone, company_name)
    def update_client(self, id: str, name: Optional[str] = None, email: Optional[str] = None, phone: Optional[str] = None, company_name: Optional[str] = None) -> Client:
        return self.client_service.update_client(id, name, email, phone, company_name)
    def get_client(self, id: str) -> Client: return self.client_service.get_client(id)
    def list_clients(self) -> List[Client]: return self.client_service.list_clients()
    def get_client_summary(self, id: str) -> Tuple[Client, Money, List[Invoice]]: return self.client_service.get_client_summary(id)
    def create_project(self, client_id: str, project_name: str, description: str = "", start_date: Optional[date] = None) -> Project:
        return self.client_service.create_project(client_id, project_name, description, start_date)
    def get_project(self, id: str) -> Project: return self.client_service.get_project(id)
    def list_projects(self, client_id: Optional[str] = None) -> List[Project]: return self.client_service.list_projects(client_id)
    def update_project_status(self, id: str, status: str) -> Project: return self.client_service.update_project_status(id, status)

    # Invoices (commands & queries)
    def create_invoice(self, client_id: str, total: Money, issue_date: date, due_date: date, invoice_number: Optional[str] = None, project_id: Optional[str] = None) -> Invoice:
        return self.invoice_commands.create_invoice(client_id, total, issue_date, due_date, invoice_number, project_id)
    def update_invoice(self, id: str, due_date: Optional[date] = None, total: Optional[Money] = None, project_id: Optional[str] = None) -> Invoice:
        return self.invoice_commands.update_invoice(id, due_date, total, project_id)
    def send_invoice(self, id: str) -> Invoice: return self.invoice_commands.send_invoice(id)
    def get_invoice(self, id: str) -> Invoice: return self.invoice_repo.get(id)
    def find_invoice_by_number(self, number: str) -> Optional[Invoice]: return self.invoice_repo.find_by_number(number)
    def count_invoices(self) -> int: return self.invoice_repo.count_all()
    def list_active_invoices(self) -> List[Invoice]: return self.invoice_repo.list_active()
    def list_invoices(self, status: Optional[InvoiceStatus] = None, client_id: Optional[str] = None, overdue_only: bool = False, search: Optional[str] = None, limit: Optional[int] = None, offset: int = 0) -> List[Invoice]:
        invoices = self.invoice_repo.list_all()
        today = self.system_service.clock.today()
        if status is not None: invoices = [inv for inv in invoices if inv.status == status]
        if client_id is not None: invoices = [inv for inv in invoices if inv.client_id == client_id]
        if overdue_only: invoices = [inv for inv in invoices if inv.is_overdue(today)]
        if search and search.strip():
            q = search.strip().lower()
            cls = {c.id: c.name.lower() for c in self.client_service.list_clients()}
            invoices = [inv for inv in invoices if q in inv.invoice_number.lower() or q in cls.get(inv.client_id, "")]
        if offset: invoices = invoices[offset:]
        return invoices[:limit] if limit is not None else invoices

    def record_payment(self, invoice_id: str, amount: Money, payment_date: date, method: PaymentMethod, reference_number: Optional[str] = None) -> Invoice:
        return self.invoice_commands.record_payment(invoice_id, amount, payment_date, method, reference_number)
    def raise_blocker(self, invoice_id: str, type: BlockerType, description: str, assigned_to: Optional[str] = None) -> Invoice:
        return self.invoice_commands.raise_blocker(invoice_id, type, description, assigned_to)
    def assign_blocker(self, invoice_id: str, blocker_id: str, owner: str) -> Invoice:
        return self.invoice_commands.assign_blocker(invoice_id, blocker_id, owner)
    def update_blocker_status(self, invoice_id: str, blocker_id: str, status: BlockerStatus) -> Invoice:
        return self.invoice_commands.update_blocker_status(invoice_id, blocker_id, status)
    def resolve_blocker(self, invoice_id: str, blocker_id: str) -> Invoice:
        return self.invoice_commands.resolve_blocker(invoice_id, blocker_id)
    def log_follow_up(self, invoice_id: str, channel: Channel, notes: str, outcome: FollowUpOutcome, contact_date: Optional[datetime] = None, promised_date: Optional[date] = None, promised_amount: Optional[Money] = None) -> Invoice:
        return self.invoice_commands.log_follow_up(invoice_id, channel, notes, outcome, contact_date, promised_date, promised_amount)
    def record_promise(self, invoice_id: str, promised_date: date, amount: Optional[Money] = None, note: str = "") -> Invoice:
        return self.invoice_commands.record_promise(invoice_id, promised_date, amount, note)
    def attach_document(self, invoice_id: str, document_type: DocumentType, file_name: str, file_path: str) -> Invoice:
        return self.invoice_commands.attach_document(invoice_id, document_type, file_name, file_path)
    def remove_document(self, invoice_id: str, document_id: str) -> Invoice:
        return self.invoice_commands.remove_document(invoice_id, document_id)
    def add_manual_action(self, invoice_id: str, description: str, priority: Priority, due_date: date) -> Invoice:
        return self.invoice_commands.add_manual_action(invoice_id, description, priority, due_date)
    def complete_action(self, invoice_id: str, action_id: str) -> Invoice:
        return self.invoice_commands.complete_action(invoice_id, action_id)
    def reschedule_action(self, invoice_id: str, action_id: str, new_date: date) -> Invoice:
        return self.invoice_commands.reschedule_action(invoice_id, action_id, new_date)
    def write_off(self, invoice_id: str, reason: str) -> Invoice:
        return self.invoice_commands.write_off(invoice_id, reason)

    # Reminders, Action Center, Reports, Import
    def generate_reminder(self, invoice_id: str, tone: Optional[ReminderTone] = None) -> GeneratedReminder:
        return self.reminder_service.generate_reminder(invoice_id, tone)
    def mark_reminder_sent(self, invoice_id: str, tone: ReminderTone, channel: Channel) -> Invoice:
        return self.invoice_commands.mark_reminder_sent(invoice_id, tone, channel)
    def get_action_center(self, strategy_key: Optional[str] = None) -> ActionCenterView:
        return self.action_center.build(strategy_key=strategy_key)
    def list_strategies(self) -> List[Dict[str, str]]: return [{"key": s.key, "label": s.label} for s in self.action_center.registry.all()]
    def get_dashboard(self) -> CollectionReport: return self.report_service.build()
    def import_invoices(self, format: str, content: str) -> ImportResult: return self.invoice_importer.import_invoices(InvoiceSourceFactory.for_format(format, content), self.system_service.clock.now())

    # System & Clock
    def run_daily_check(self) -> DailyCheckSummary: return self.system_service.run_daily_check()
    def get_today(self) -> Dict[str, object]: return self.system_service.get_today()
    def set_simulated_date(self, new_date: Optional[date]) -> None: self.system_service.set_simulated_date(new_date)
    def get_settings(self) -> Dict[str, str]: return self.system_service.get_settings()
    def update_settings(self, sender_name: Optional[str] = None, default_currency: Optional[str] = None) -> Dict[str, str]: return self.system_service.update_settings(sender_name, default_currency)
    def list_audit(self, invoice_id: Optional[str] = None, limit: int = 200, offset: int = 0) -> List[AuditEvent]: return self.system_service.list_audit(invoice_id=invoice_id, limit=limit, offset=offset)
    def count_audit(self, invoice_id: Optional[str] = None) -> int: return self.system_service.count_audit(invoice_id=invoice_id)
    def list_notifications(self, unread_only: bool = False, limit: Optional[int] = None, offset: int = 0) -> List[Notification]: return self.system_service.list_notifications(unread_only=unread_only, limit=limit, offset=offset)
    def count_notifications(self, unread_only: bool = False) -> int: return self.system_service.count_notifications(unread_only=unread_only)
    def mark_notifications_read(self) -> None: self.system_service.mark_notifications_read()
    def list_failures(self, limit: int = 50) -> List[HandlerFailure]: return self.system_service.list_failures(limit=limit)
    def reset_demo_data(self) -> None: self.system_service.reset_demo_data()

    @property
    def client_repo(self) -> ClientRepository: return self.client_service.client_repo
    @property
    def project_repo(self) -> ProjectRepository: return self.client_service.project_repo
    @property
    def clock(self) -> Clock: return self.system_service.clock
    @property
    def settings_repo(self) -> SettingsRepository: return self.system_service.settings_repo
    @property
    def event_bus(self) -> EventBus: return self.invoice_commands.event_bus
