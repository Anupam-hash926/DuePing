"""CollectionFacade — Unified application boundary for all DuePing workflows.

# PATTERN: Facade — Facade Pattern
Coordinates repositories, clock, event bus, factories, resolution playbook,
action center, reports, and daily checks. The sole application service interface
called by the API layer.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import Callable, Dict, List, Optional, Tuple

from app.application.action_center import ActionCenter, ActionCenterView
from app.application.daily_check import DailyCheckService, DailyCheckSummary
from app.application.event_bus import EventBus, save_and_publish
from app.application.importing import ImportResult, InvoiceImporter, InvoiceSourceFactory
from app.application.invoice_factory import InvoiceFactory
from app.application.playbook import ResolutionPlaybook
from app.application.ports import (
    AuditRepository, ClientRepository, Clock, InvoiceRepository,
    NotificationRepository, ProjectRepository, SettingsRepository,
)
from app.application.prioritization import PrioritizationStrategy
from app.application.reminders import GeneratedReminder, ReminderFactory
from app.application.reports import CollectionReport, ReportService
from app.domain.audit import AuditEvent, Notification
from app.domain.client import Client
from app.domain.enums import (
    ActionSource, BlockerStatus, BlockerType, Channel, DocumentType,
    FollowUpOutcome, InvoiceStatus, PaymentMethod, Priority, ReminderTone,
)
from app.domain.exceptions import DomainValidationError, EntityNotFound
from app.domain.invoice import Invoice
from app.domain.money import Money
from app.domain.payment import Payment
from app.domain.project import Project


class CollectionFacade:
    """Facade orchestrating collection operations across domain and application services.

    # PATTERN: Facade — Facade
    """

    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        client_repo: ClientRepository,
        project_repo: ProjectRepository,
        audit_repo: AuditRepository,
        notification_repo: NotificationRepository,
        settings_repo: SettingsRepository,
        clock: Clock,
        event_bus: EventBus,
        action_center: ActionCenter,
        reminder_factory: ReminderFactory,
        invoice_factory: InvoiceFactory,
        invoice_importer: InvoiceImporter,
        report_service: ReportService,
        daily_check_service: DailyCheckService,
        playbook: ResolutionPlaybook,
        reset_demo_callable: Optional[Callable[[], None]] = None,
    ) -> None:
        self.invoice_repo = invoice_repo
        self.client_repo = client_repo
        self.project_repo = project_repo
        self.audit_repo = audit_repo
        self.notification_repo = notification_repo
        self.settings_repo = settings_repo
        self.clock = clock
        self.event_bus = event_bus
        self.action_center = action_center
        self.reminder_factory = reminder_factory
        self.invoice_factory = invoice_factory
        self.invoice_importer = invoice_importer
        self.report_service = report_service
        self.daily_check_service = daily_check_service
        self.playbook = playbook
        self.reset_demo_callable = reset_demo_callable

    # ── Clients ───────────────────────────────────────────────────────────────

    def create_client(
        self,
        name: str,
        email: str,
        phone: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> Client:
        from app.domain.exceptions import DuplicateClient
        norm_email = email.strip().lower()
        if self.client_repo.find_by_email(norm_email) is not None:
            raise DuplicateClient(f"Client with email {norm_email} already exists")

        client = Client(
            name=name,
            email=norm_email,
            phone=phone,
            company_name=company_name,
            created_at=self.clock.now(),
        )
        self.client_repo.save(client)
        return client

    def update_client(
        self,
        id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> Client:
        from app.domain.exceptions import DuplicateClient
        client = self.client_repo.get(id)
        if email is not None:
            norm_email = email.strip().lower()
            existing = self.client_repo.find_by_email(norm_email)
            if existing is not None and existing.id != id:
                raise DuplicateClient(f"Client with email {norm_email} already exists")
        client.update_contact_details(name=name, email=email, phone=phone, company_name=company_name)
        self.client_repo.save(client)
        return client

    def list_clients(self) -> List[Client]:
        return self.client_repo.list_all()

    def get_client_summary(self, id: str) -> Tuple[Client, Money, List[Invoice]]:
        client = self.client_repo.get(id)
        invoices = self.invoice_repo.list_by_client(id)
        outstanding = client.outstanding_balance(invoices)
        return client, outstanding, invoices

    # ── Projects ──────────────────────────────────────────────────────────────

    def create_project(
        self,
        client_id: str,
        project_name: str,
        description: str = "",
        start_date: Optional[date] = None,
    ) -> Project:
        self.client_repo.get(client_id)  # verify existence
        s_date = start_date or self.clock.today()
        proj = Project(
            client_id=client_id,
            project_name=project_name,
            start_date=s_date,
            description=description,
        )
        self.project_repo.save(proj)
        return proj

    def list_projects(self, client_id: Optional[str] = None) -> List[Project]:
        if client_id is not None:
            return self.project_repo.list_by_client(client_id)
        return self.project_repo.list_all()

    def update_project_status(self, id: str, status: str) -> Project:
        proj = self.project_repo.get(id)
        proj.update_status(status)
        self.project_repo.save(proj)
        return proj

    # ── Invoices ──────────────────────────────────────────────────────────────

    def create_invoice(
        self,
        client_id: str,
        total: Money,
        issue_date: date,
        due_date: date,
        invoice_number: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> Invoice:
        self.client_repo.get(client_id)  # verify existence
        if project_id is not None:
            self.project_repo.get(project_id)

        now = self.clock.now()
        invoice = self.invoice_factory.create(
            client_id=client_id,
            total=total,
            issue_date=issue_date,
            due_date=due_date,
            now=now,
            invoice_number=invoice_number,
            project_id=project_id,
        )
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice.id)

    def update_invoice(
        self,
        id: str,
        due_date: Optional[date] = None,
        total: Optional[Money] = None,
        project_id: Optional[str] = None,
    ) -> Invoice:
        invoice = self.invoice_repo.get(id)
        if project_id is not None:
            self.project_repo.get(project_id)
        invoice.update_details(due_date=due_date, total=total, project_id=project_id)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(id)

    def send_invoice(self, id: str) -> Invoice:
        invoice = self.invoice_repo.get(id)
        invoice.send(self.clock.now())
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(id)

    def get_invoice(self, id: str) -> Invoice:
        return self.invoice_repo.get(id)

    def list_invoices(
        self,
        status: Optional[InvoiceStatus] = None,
        client_id: Optional[str] = None,
        overdue_only: bool = False,
        search: Optional[str] = None,
    ) -> List[Invoice]:
        invoices = self.invoice_repo.list_all()
        today = self.clock.today()

        if status is not None:
            invoices = [inv for inv in invoices if inv.status == status]

        if client_id is not None:
            invoices = [inv for inv in invoices if inv.client_id == client_id]

        if overdue_only:
            invoices = [inv for inv in invoices if inv.is_overdue(today)]

        if search and search.strip():
            query = search.strip().lower()
            # Cache client names for fast matching
            clients = {c.id: c.name.lower() for c in self.client_repo.list_all()}
            filtered = []
            for inv in invoices:
                cname = clients.get(inv.client_id, "")
                if query in inv.invoice_number.lower() or query in cname:
                    filtered.append(inv)
            invoices = filtered

        return invoices

    # ── Payments ──────────────────────────────────────────────────────────────

    def record_payment(
        self,
        invoice_id: str,
        amount: Money,
        payment_date: date,
        method: PaymentMethod,
        reference_number: Optional[str] = None,
    ) -> Invoice:
        today = self.clock.today()
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        payment = Payment(
            amount=amount,
            payment_date=payment_date,
            method=method,
            recorded_at=now,
            reference_number=reference_number,
        )
        invoice.record_payment(payment, today, now)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    # ── Blockers ──────────────────────────────────────────────────────────────

    def raise_blocker(
        self,
        invoice_id: str,
        type: BlockerType,
        description: str,
        assigned_to: Optional[str] = None,
    ) -> Invoice:
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        invoice.raise_blocker(type, description, assigned_to, now)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    def assign_blocker(self, invoice_id: str, blocker_id: str, owner: str) -> Invoice:
        invoice = self.invoice_repo.get(invoice_id)
        invoice.assign_blocker(blocker_id, owner)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    def update_blocker_status(self, invoice_id: str, blocker_id: str, status: BlockerStatus) -> Invoice:
        invoice = self.invoice_repo.get(invoice_id)
        invoice.update_blocker_status(blocker_id, status)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    def resolve_blocker(self, invoice_id: str, blocker_id: str) -> Invoice:
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        invoice.resolve_blocker(blocker_id, now)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    # ── Follow-ups / Promises ─────────────────────────────────────────────────

    def log_follow_up(
        self,
        invoice_id: str,
        channel: Channel,
        notes: str,
        outcome: FollowUpOutcome,
        contact_date: Optional[datetime] = None,
        promised_date: Optional[date] = None,
        promised_amount: Optional[Money] = None,
    ) -> Invoice:
        today = self.clock.today()
        now = self.clock.now()
        c_date = contact_date or now
        invoice = self.invoice_repo.get(invoice_id)
        invoice.log_follow_up(c_date, channel, notes, outcome, now)

        if promised_date is not None:
            invoice.record_promise(promised_date, today, now, amount=promised_amount, note=notes)

        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    def record_promise(
        self,
        invoice_id: str,
        promised_date: date,
        amount: Optional[Money] = None,
        note: str = "",
    ) -> Invoice:
        today = self.clock.today()
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        invoice.record_promise(promised_date, today, now, amount=amount, note=note)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    # ── Supporting Documents ──────────────────────────────────────────────────

    def attach_document(
        self,
        invoice_id: str,
        document_type: DocumentType,
        file_name: str,
        file_path: str,
    ) -> Invoice:
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        from app.domain.document import SupportingDocument
        doc = SupportingDocument(
            document_type=document_type,
            file_name=file_name,
            file_path=file_path,
            uploaded_at=now,
        )
        invoice.attach_document(doc, now)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    def remove_document(self, invoice_id: str, document_id: str) -> Invoice:
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        invoice.remove_document(document_id, now)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    # ── Actions ───────────────────────────────────────────────────────────────

    def add_manual_action(
        self,
        invoice_id: str,
        description: str,
        priority: Priority,
        due_date: date,
    ) -> Invoice:
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        from app.domain.next_action import NextAction
        act = NextAction(
            description=description,
            priority=priority,
            due_date=due_date,
            source=ActionSource.MANUAL,
            created_at=now,
        )
        invoice.add_action(act)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    def complete_action(self, invoice_id: str, action_id: str) -> Invoice:
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        invoice.complete_action(action_id, now)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    def reschedule_action(self, invoice_id: str, action_id: str, new_date: date) -> Invoice:
        today = self.clock.today()
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        invoice.reschedule_action(action_id, new_date, today, now)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    def get_action_center(self, strategy_key: Optional[str] = None) -> ActionCenterView:
        return self.action_center.build(strategy_key=strategy_key)

    def list_strategies(self) -> List[Dict[str, str]]:
        return [
            {"key": s.key, "label": s.label}
            for s in self.action_center.registry.all()
        ]

    # ── Reminders ─────────────────────────────────────────────────────────────

    def generate_reminder(self, invoice_id: str, tone: Optional[ReminderTone] = None) -> GeneratedReminder:
        today = self.clock.today()
        invoice = self.invoice_repo.get(invoice_id)
        client = self.client_repo.get(invoice.client_id)
        sender_name = self.settings_repo.get("sender_name", "DuePing User") or "DuePing User"
        return self.reminder_factory.generate(invoice, client, sender_name, today, tone=tone)

    def mark_reminder_sent(self, invoice_id: str, tone: ReminderTone, channel: Channel) -> Invoice:
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        invoice.mark_reminder_sent(tone, channel, now)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def write_off(self, invoice_id: str, reason: str) -> Invoice:
        now = self.clock.now()
        invoice = self.invoice_repo.get(invoice_id)
        invoice.write_off(reason, now)
        save_and_publish(self.invoice_repo, self.event_bus, invoice)
        return self.invoice_repo.get(invoice_id)

    # ── Import ────────────────────────────────────────────────────────────────

    def import_invoices(self, format: str, content: str) -> ImportResult:
        source = InvoiceSourceFactory.for_format(format, content)
        return self.invoice_importer.import_invoices(source, self.clock.now())

    # ── Reports ───────────────────────────────────────────────────────────────

    def get_dashboard(self) -> CollectionReport:
        return self.report_service.build()

    # ── System / Settings / Audit ─────────────────────────────────────────────

    def run_daily_check(self) -> DailyCheckSummary:
        return self.daily_check_service.run()

    def get_today(self) -> Dict[str, object]:
        today = self.clock.today()
        sim_val = self.settings_repo.get("simulated_date")
        is_simulated = bool(sim_val and sim_val.strip())
        return {
            "today": today.isoformat(),
            "simulated": is_simulated,
        }

    def set_simulated_date(self, new_date: Optional[date]) -> None:
        if new_date is None:
            self.settings_repo.set("simulated_date", "")
        else:
            self.settings_repo.set("simulated_date", new_date.isoformat())

    def get_settings(self) -> Dict[str, str]:
        sender = self.settings_repo.get("sender_name", "DuePing User") or "DuePing User"
        curr = self.settings_repo.get("default_currency", "INR") or "INR"
        sim = self.settings_repo.get("simulated_date", "") or ""
        return {
            "sender_name": sender,
            "default_currency": curr,
            "simulated_date": sim,
        }

    def update_settings(
        self,
        sender_name: Optional[str] = None,
        default_currency: Optional[str] = None,
    ) -> Dict[str, str]:
        if sender_name is not None:
            self.settings_repo.set("sender_name", sender_name.strip())
        if default_currency is not None:
            self.settings_repo.set("default_currency", default_currency.strip().upper())
        return self.get_settings()

    def list_audit(self, invoice_id: Optional[str] = None) -> List[AuditEvent]:
        return self.audit_repo.list(invoice_id=invoice_id)

    def list_notifications(self, unread_only: bool = False) -> List[Notification]:
        return self.notification_repo.list(unread_only=unread_only)

    def mark_notifications_read(self) -> None:
        self.notification_repo.mark_all_read()

    def reset_demo_data(self) -> None:
        if self.reset_demo_callable is not None:
            self.reset_demo_callable()
        else:
            # Fallback in-memory reset
            for inv in self.invoice_repo.list_all():
                pass
