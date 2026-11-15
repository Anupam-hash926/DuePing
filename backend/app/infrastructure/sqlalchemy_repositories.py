"""SQLAlchemy implementations of all repository ports.

# PATTERN: Repository — Concrete SQL Repositories
Implements full aggregate persistence for Invoice and children via unified
transactions, selectinload queries, and deep collection synchronisation.
"""
from __future__ import annotations

import builtins
import uuid
from collections.abc import Callable

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.application.ports import (
    AuditRepository,
    ClientRepository,
    FailureLogRepository,
    HandlerFailure,
    InvoiceRepository,
    NotificationRepository,
    ProjectRepository,
    SettingsRepository,
)
from app.domain.audit import AuditEvent, Notification
from app.domain.client import Client
from app.domain.enums import ActionStatus, InvoiceStatus
from app.domain.exceptions import ConcurrencyConflict, EntityNotFound
from app.domain.invoice import Invoice
from app.domain.project import Project
from app.infrastructure.mappers import (
    audit_event_to_model,
    blocker_to_model,
    client_to_model,
    document_to_model,
    follow_up_to_model,
    model_to_audit_event,
    model_to_client,
    model_to_invoice,
    model_to_notification,
    model_to_project,
    next_action_to_model,
    notification_to_model,
    payment_to_model,
    project_to_model,
    promise_to_model,
)
from app.infrastructure.orm_models import (
    AppSettingsModel,
    AuditEventModel,
    BlockerModel,
    ClientModel,
    DocumentModel,
    FollowUpModel,
    HandlerFailureModel,
    InvoiceModel,
    NextActionModel,
    NotificationModel,
    PaymentModel,
    ProjectModel,
    PromiseModel,
)


class SqlAlchemyInvoiceRepository(InvoiceRepository):
    """SQLAlchemy implementation of InvoiceRepository handling full aggregate persistence."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def _eager_load(self):
        return (
            selectinload(InvoiceModel.payments),
            selectinload(InvoiceModel.blockers),
            selectinload(InvoiceModel.promises),
            selectinload(InvoiceModel.follow_ups),
            selectinload(InvoiceModel.documents),
            selectinload(InvoiceModel.actions),
        )

    def get(self, id: str) -> Invoice:
        with self.session_factory() as session:
            stmt = select(InvoiceModel).options(*self._eager_load()).where(InvoiceModel.id == id)
            model = session.scalar(stmt)
            if model is None:
                raise EntityNotFound(f"Invoice {id} not found")
            return model_to_invoice(model)

    def find_by_number(self, number: str) -> Invoice | None:
        with self.session_factory() as session:
            stmt = select(InvoiceModel).options(*self._eager_load()).where(InvoiceModel.invoice_number == number)
            model = session.scalar(stmt)
            if model is None:
                return None
            return model_to_invoice(model)

    def save(self, invoice: Invoice) -> None:
        """In one transaction upsert the invoice row, and synchronize all child collections."""
        with self.session_factory() as session:
            with session.begin():
                # 1. Upsert invoice row
                m_inv = session.get(InvoiceModel, invoice.id)
                if m_inv is None:
                    m_inv = InvoiceModel(
                        id=invoice.id,
                        invoice_number=invoice.invoice_number,
                        client_id=invoice.client_id,
                        project_id=invoice.project_id,
                        issue_date=invoice.issue_date,
                        due_date=invoice.due_date,
                        total_minor=invoice.total.to_minor_units(),
                        currency=invoice.total.currency,
                        status=invoice.status.name,
                        reminder_level=invoice.reminder_level,
                        overdue_notified=invoice.overdue_notified,
                        created_at=invoice.created_at,
                        version=0,
                    )
                    session.add(m_inv)
                    invoice.version = 0
                else:
                    stmt = (
                        update(InvoiceModel)
                        .where(
                            InvoiceModel.id == invoice.id,
                            InvoiceModel.version == invoice.version,
                        )
                        .values(
                            invoice_number=invoice.invoice_number,
                            client_id=invoice.client_id,
                            project_id=invoice.project_id,
                            issue_date=invoice.issue_date,
                            due_date=invoice.due_date,
                            total_minor=invoice.total.to_minor_units(),
                            currency=invoice.total.currency,
                            status=invoice.status.name,
                            reminder_level=invoice.reminder_level,
                            overdue_notified=invoice.overdue_notified,
                            version=InvoiceModel.version + 1,
                        )
                    )
                    res = session.execute(stmt)
                    if res.rowcount == 0:
                        raise ConcurrencyConflict(
                            f"Invoice {invoice.id} was modified concurrently (expected version {invoice.version})"
                        )
                    invoice.version += 1

                # 2. Synchronize child collections: delete removed items, merge current ones
                # Payments
                # Payments
                current_p_ids = {p.id for p in invoice.payments}
                p_conds = [PaymentModel.invoice_id == invoice.id]
                if current_p_ids:
                    p_conds.append(PaymentModel.id.not_in(current_p_ids))
                session.execute(delete(PaymentModel).where(*p_conds))
                for p in invoice.payments:
                    session.merge(payment_to_model(p, invoice.id))

                # Blockers
                current_b_ids = {b.id for b in invoice.blockers}
                b_conds = [BlockerModel.invoice_id == invoice.id]
                if current_b_ids:
                    b_conds.append(BlockerModel.id.not_in(current_b_ids))
                session.execute(delete(BlockerModel).where(*b_conds))
                for b in invoice.blockers:
                    session.merge(blocker_to_model(b, invoice.id))

                # Promises
                current_pr_ids = {pr.id for pr in invoice.promises}
                pr_conds = [PromiseModel.invoice_id == invoice.id]
                if current_pr_ids:
                    pr_conds.append(PromiseModel.id.not_in(current_pr_ids))
                session.execute(delete(PromiseModel).where(*pr_conds))
                for pr in invoice.promises:
                    session.merge(promise_to_model(pr, invoice.id))

                # Follow-ups
                current_fu_ids = {fu.id for fu in invoice.follow_ups}
                fu_conds = [FollowUpModel.invoice_id == invoice.id]
                if current_fu_ids:
                    fu_conds.append(FollowUpModel.id.not_in(current_fu_ids))
                session.execute(delete(FollowUpModel).where(*fu_conds))
                for fu in invoice.follow_ups:
                    session.merge(follow_up_to_model(fu, invoice.id))

                # Documents
                current_doc_ids = {d.id for d in invoice.documents}
                doc_conds = [DocumentModel.invoice_id == invoice.id]
                if current_doc_ids:
                    doc_conds.append(DocumentModel.id.not_in(current_doc_ids))
                session.execute(delete(DocumentModel).where(*doc_conds))
                for d in invoice.documents:
                    session.merge(document_to_model(d, invoice.id))

                # Actions
                current_act_ids = {a.id for a in invoice.actions}
                act_conds = [NextActionModel.invoice_id == invoice.id]
                if current_act_ids:
                    act_conds.append(NextActionModel.id.not_in(current_act_ids))
                session.execute(delete(NextActionModel).where(*act_conds))
                for a in invoice.actions:
                    session.merge(next_action_to_model(a, invoice.id))

    def list_all(self, limit: int | None = None, offset: int = 0) -> list[Invoice]:
        with self.session_factory() as session:
            stmt = select(InvoiceModel).options(*self._eager_load()).order_by(InvoiceModel.created_at.desc())
            if offset:
                stmt = stmt.offset(offset)
            if limit is not None:
                stmt = stmt.limit(limit)
            models = session.scalars(stmt).all()
            return [model_to_invoice(m) for m in models]

    def count_all(self) -> int:
        with self.session_factory() as session:
            return session.scalar(select(func.count(InvoiceModel.id))) or 0

    def list_active(self) -> list[Invoice]:
        active_names = [InvoiceStatus.SENT.name, InvoiceStatus.PARTIALLY_PAID.name, InvoiceStatus.DISPUTED.name]
        with self.session_factory() as session:
            stmt = (
                select(InvoiceModel)
                .options(*self._eager_load())
                .where(InvoiceModel.status.in_(active_names))
                .order_by(InvoiceModel.created_at.desc())
            )
            models = session.scalars(stmt).all()
            return [model_to_invoice(m) for m in models]

    def list_active_with_pending_actions(self) -> list[Invoice]:
        active_names = [InvoiceStatus.SENT.name, InvoiceStatus.PARTIALLY_PAID.name, InvoiceStatus.DISPUTED.name]
        with self.session_factory() as session:
            stmt = (
                select(InvoiceModel)
                .options(*self._eager_load())
                .where(
                    InvoiceModel.status.in_(active_names),
                    InvoiceModel.actions.any(NextActionModel.status == ActionStatus.PENDING.name),
                )
                .order_by(InvoiceModel.created_at.desc())
            )
            models = session.scalars(stmt).all()
            return [model_to_invoice(m) for m in models]

    def list_by_client(self, client_id: str) -> list[Invoice]:
        with self.session_factory() as session:
            stmt = (
                select(InvoiceModel)
                .options(*self._eager_load())
                .where(InvoiceModel.client_id == client_id)
                .order_by(InvoiceModel.created_at.desc())
            )
            models = session.scalars(stmt).all()
            return [model_to_invoice(m) for m in models]

    def list_by_project(self, project_id: str) -> list[Invoice]:
        with self.session_factory() as session:
            stmt = (
                select(InvoiceModel)
                .options(*self._eager_load())
                .where(InvoiceModel.project_id == project_id)
                .order_by(InvoiceModel.created_at.desc())
            )
            models = session.scalars(stmt).all()
            return [model_to_invoice(m) for m in models]

    def next_invoice_sequence(self, year: int) -> int:
        import re
        prefix = f"DP-{year}-%"
        pattern = re.compile(rf"^DP-{year}-(\d+)$")
        with self.session_factory() as session:
            stmt = select(InvoiceModel.invoice_number).where(InvoiceModel.invoice_number.like(prefix))
            numbers = session.scalars(stmt).all()
            suffixes: list[int] = []
            for num in numbers:
                m = pattern.match(num)
                if m:
                    suffixes.append(int(m.group(1)))
            return 1 + max(suffixes) if suffixes else 1


class SqlAlchemyClientRepository(ClientRepository):
    """SQLAlchemy implementation of ClientRepository."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def get(self, id: str) -> Client:
        with self.session_factory() as session:
            model = session.get(ClientModel, id)
            if model is None:
                raise EntityNotFound(f"Client {id} not found")
            return model_to_client(model)

    def find_by_email(self, email: str) -> Client | None:
        norm = email.strip().lower()
        with self.session_factory() as session:
            stmt = select(ClientModel).where(func.lower(ClientModel.email) == norm)
            model = session.scalar(stmt)
            if model is None:
                return None
            return model_to_client(model)

    def save(self, client: Client) -> None:
        with self.session_factory() as session:
            with session.begin():
                session.merge(client_to_model(client))

    def list_all(self) -> list[Client]:
        with self.session_factory() as session:
            stmt = select(ClientModel).order_by(ClientModel.name.asc())
            models = session.scalars(stmt).all()
            return [model_to_client(m) for m in models]


class SqlAlchemyProjectRepository(ProjectRepository):
    """SQLAlchemy implementation of ProjectRepository."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def get(self, id: str) -> Project:
        with self.session_factory() as session:
            model = session.get(ProjectModel, id)
            if model is None:
                raise EntityNotFound(f"Project {id} not found")
            return model_to_project(model)

    def save(self, project: Project) -> None:
        with self.session_factory() as session:
            with session.begin():
                session.merge(project_to_model(project))

    def list_all(self) -> list[Project]:
        with self.session_factory() as session:
            stmt = select(ProjectModel).order_by(ProjectModel.project_name.asc())
            models = session.scalars(stmt).all()
            return [model_to_project(m) for m in models]

    def list_by_client(self, client_id: str) -> list[Project]:
        with self.session_factory() as session:
            stmt = select(ProjectModel).where(ProjectModel.client_id == client_id).order_by(ProjectModel.project_name.asc())
            models = session.scalars(stmt).all()
            return [model_to_project(m) for m in models]


class SqlAlchemyAuditRepository(AuditRepository):
    """SQLAlchemy implementation of AuditRepository."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def add(self, event: AuditEvent) -> None:
        with self.session_factory() as session:
            with session.begin():
                session.merge(audit_event_to_model(event))

    def list(
        self,
        invoice_id: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> builtins.list[AuditEvent]:
        with self.session_factory() as session:
            stmt = select(AuditEventModel).order_by(AuditEventModel.occurred_at.desc())
            if invoice_id is not None:
                stmt = stmt.where(AuditEventModel.invoice_id == invoice_id)
            if offset:
                stmt = stmt.offset(offset)
            stmt = stmt.limit(limit)
            models = session.scalars(stmt).all()
            return [model_to_audit_event(m) for m in models]

    def count(self, invoice_id: str | None = None) -> int:
        with self.session_factory() as session:
            stmt = select(func.count(AuditEventModel.id))
            if invoice_id is not None:
                stmt = stmt.where(AuditEventModel.invoice_id == invoice_id)
            return session.scalar(stmt) or 0


class SqlAlchemyNotificationRepository(NotificationRepository):
    """SQLAlchemy implementation of NotificationRepository."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def add(self, n: Notification) -> None:
        with self.session_factory() as session:
            with session.begin():
                session.merge(notification_to_model(n))

    def list(
        self,
        unread_only: bool = False,
        limit: int | None = None,
        offset: int = 0,
    ) -> builtins.list[Notification]:
        with self.session_factory() as session:
            stmt = select(NotificationModel).order_by(NotificationModel.created_at.desc())
            if unread_only:
                stmt = stmt.where(NotificationModel.is_read.is_(False))
            if offset:
                stmt = stmt.offset(offset)
            if limit is not None:
                stmt = stmt.limit(limit)
            models = session.scalars(stmt).all()
            return [model_to_notification(m) for m in models]

    def count(self, unread_only: bool = False) -> int:
        with self.session_factory() as session:
            stmt = select(func.count(NotificationModel.id))
            if unread_only:
                stmt = stmt.where(NotificationModel.is_read.is_(False))
            return session.scalar(stmt) or 0

    def mark_all_read(self) -> None:
        with self.session_factory() as session:
            with session.begin():
                models = session.scalars(select(NotificationModel).where(NotificationModel.is_read.is_(False))).all()
                for m in models:
                    m.is_read = True


class SqlAlchemySettingsRepository(SettingsRepository):
    """SQLAlchemy implementation of SettingsRepository."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def get(self, key: str, default: str | None = None) -> str | None:
        with self.session_factory() as session:
            model = session.get(AppSettingsModel, key)
            if model is None:
                return default
            return model.value

    def set(self, key: str, value: str) -> None:
        with self.session_factory() as session:
            with session.begin():
                session.merge(AppSettingsModel(key=key, value=str(value)))


class SqlAlchemyFailureLogRepository(FailureLogRepository):
    """SQLAlchemy implementation of FailureLogRepository."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def add(self, failure: HandlerFailure) -> None:
        fid = failure.id or uuid.uuid4().hex
        with self.session_factory() as session:
            with session.begin():
                m = HandlerFailureModel(
                    id=fid,
                    occurred_at=failure.occurred_at,
                    event_type=failure.event_type,
                    handler=failure.handler,
                    error=failure.error,
                )
                session.add(m)

    def list(self, limit: int = 50) -> builtins.list[HandlerFailure]:
        with self.session_factory() as session:
            stmt = select(HandlerFailureModel).order_by(HandlerFailureModel.occurred_at.desc()).limit(limit)
            models = session.scalars(stmt).all()
            return [
                HandlerFailure(
                    id=m.id,
                    occurred_at=m.occurred_at,
                    event_type=m.event_type,
                    handler=m.handler,
                    error=m.error,
                )
                for m in models
            ]
