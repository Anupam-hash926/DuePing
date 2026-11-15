"""Data mappers translating between domain entities and SQLAlchemy ORM models.

Pure translation functions; invokes reconstitution methods on domain entities
without re-emitting events or performing creation side-effects.
"""
from __future__ import annotations
from typing import List

from app.domain.audit import AuditEvent, Notification
from app.domain.blocker import PaymentBlocker
from app.domain.client import Client
from app.domain.document import SupportingDocument
from app.domain.enums import (
    ActionSource, ActionStatus, BlockerStatus, BlockerType, Channel,
    DocumentType, FollowUpOutcome, InvoiceStatus, PaymentMethod, Priority,
    PromiseStatus,
)
from app.domain.follow_up import FollowUp
from app.domain.invoice import Invoice
from app.domain.money import Money
from app.domain.next_action import NextAction
from app.domain.payment import Payment
from app.domain.project import Project
from app.domain.promise import PaymentPromise
from app.infrastructure.orm_models import (
    AuditEventModel, BlockerModel, ClientModel, DocumentModel, FollowUpModel,
    InvoiceModel, NextActionModel, NotificationModel, PaymentModel, ProjectModel,
    PromiseModel,
)


# ── Client Mapping ────────────────────────────────────────────────────────────

def client_to_model(client: Client) -> ClientModel:
    return ClientModel(
        id=client.id,
        name=client.name,
        email=client.email,
        phone=client.phone,
        company_name=client.company_name,
        promises_kept=client.promises_kept,
        promises_missed=client.promises_missed,
        created_at=client.created_at,
    )


def model_to_client(m: ClientModel) -> Client:
    return Client.reconstitute(
        id=m.id,
        name=m.name,
        email=m.email,
        phone=m.phone,
        company_name=m.company_name,
        promises_kept=m.promises_kept,
        promises_missed=m.promises_missed,
        created_at=m.created_at,
    )


# ── Project Mapping ───────────────────────────────────────────────────────────

def project_to_model(project: Project) -> ProjectModel:
    return ProjectModel(
        id=project.id,
        client_id=project.client_id,
        project_name=project.project_name,
        description=project.description,
        start_date=project.start_date,
        status=project.status,
    )


def model_to_project(m: ProjectModel) -> Project:
    return Project.reconstitute(
        id=m.id,
        client_id=m.client_id,
        project_name=m.project_name,
        description=m.description,
        start_date=m.start_date,
        status=m.status,
    )


# ── Invoice Aggregate Child Mapping ───────────────────────────────────────────

def payment_to_model(p: Payment, invoice_id: str) -> PaymentModel:
    return PaymentModel(
        id=p.id,
        invoice_id=invoice_id,
        amount_minor=p.amount.to_minor_units(),
        payment_date=p.payment_date,
        method=p.method.name,
        reference_number=p.reference_number,
        recorded_at=p.recorded_at,
    )


def model_to_payment(m: PaymentModel, currency: str) -> Payment:
    return Payment.reconstitute(
        id=m.id,
        amount=Money.from_minor_units(m.amount_minor, currency=currency),
        payment_date=m.payment_date,
        method=PaymentMethod[m.method],
        reference_number=m.reference_number,
        recorded_at=m.recorded_at,
    )


def blocker_to_model(b: PaymentBlocker, invoice_id: str) -> BlockerModel:
    return BlockerModel(
        id=b.id,
        invoice_id=invoice_id,
        type=b.type.name,
        description=b.description,
        assigned_to=b.assigned_to,
        status=b.status.name,
        created_at=b.created_at,
        resolved_at=b.resolved_at,
    )


def model_to_blocker(m: BlockerModel) -> PaymentBlocker:
    return PaymentBlocker.reconstitute(
        id=m.id,
        type=BlockerType[m.type],
        description=m.description,
        assigned_to=m.assigned_to,
        status=BlockerStatus[m.status],
        created_at=m.created_at,
        resolved_at=m.resolved_at,
    )


def promise_to_model(p: PaymentPromise, invoice_id: str) -> PromiseModel:
    return PromiseModel(
        id=p.id,
        invoice_id=invoice_id,
        promised_date=p.promised_date,
        amount_minor=p.amount.to_minor_units() if p.amount is not None else None,
        note=p.note,
        status=p.status.name,
        created_at=p.created_at,
    )


def model_to_promise(m: PromiseModel, currency: str) -> PaymentPromise:
    amt = Money.from_minor_units(m.amount_minor, currency=currency) if m.amount_minor is not None else None
    return PaymentPromise.reconstitute(
        id=m.id,
        promised_date=m.promised_date,
        amount=amt,
        note=m.note,
        status=PromiseStatus[m.status],
        created_at=m.created_at,
    )


def follow_up_to_model(fu: FollowUp, invoice_id: str) -> FollowUpModel:
    return FollowUpModel(
        id=fu.id,
        invoice_id=invoice_id,
        contact_date=fu.contact_date,
        channel=fu.channel.name,
        notes=fu.notes,
        outcome=fu.outcome.name,
    )


def model_to_follow_up(m: FollowUpModel) -> FollowUp:
    return FollowUp.reconstitute(
        id=m.id,
        contact_date=m.contact_date,
        channel=Channel[m.channel],
        notes=m.notes,
        outcome=FollowUpOutcome[m.outcome],
    )


def document_to_model(d: SupportingDocument, invoice_id: str) -> DocumentModel:
    return DocumentModel(
        id=d.id,
        invoice_id=invoice_id,
        document_type=d.document_type.name,
        file_name=d.file_name,
        file_type=d.file_type,
        file_path=d.file_path,
        uploaded_at=d.uploaded_at,
    )


def model_to_document(m: DocumentModel) -> SupportingDocument:
    return SupportingDocument.reconstitute(
        id=m.id,
        document_type=DocumentType[m.document_type],
        file_name=m.file_name,
        file_type=m.file_type,
        file_path=m.file_path,
        uploaded_at=m.uploaded_at,
    )


def next_action_to_model(a: NextAction, invoice_id: str) -> NextActionModel:
    return NextActionModel(
        id=a.id,
        invoice_id=invoice_id,
        description=a.description,
        priority=a.priority.name,
        due_date=a.due_date,
        status=a.status.name,
        source=a.source.name,
        source_ref=a.source_ref,
        created_at=a.created_at,
        completed_at=a.completed_at,
    )


def model_to_next_action(m: NextActionModel) -> NextAction:
    return NextAction.reconstitute(
        id=m.id,
        description=m.description,
        priority=Priority[m.priority],
        due_date=m.due_date,
        status=ActionStatus[m.status],
        source=ActionSource[m.source],
        source_ref=m.source_ref,
        created_at=m.created_at,
        completed_at=m.completed_at,
    )


# ── Full Invoice Aggregate Mapping ────────────────────────────────────────────

def model_to_invoice(m: InvoiceModel) -> Invoice:
    curr = m.currency
    payments = [model_to_payment(pm, curr) for pm in (m.payments or [])]
    blockers = [model_to_blocker(bm) for bm in (m.blockers or [])]
    promises = [model_to_promise(pr, curr) for pr in (m.promises or [])]
    follow_ups = [model_to_follow_up(fm) for fm in (m.follow_ups or [])]
    documents = [model_to_document(dm) for dm in (m.documents or [])]
    actions = [model_to_next_action(am) for am in (m.actions or [])]

    return Invoice.reconstitute(
        id=m.id,
        invoice_number=m.invoice_number,
        client_id=m.client_id,
        project_id=m.project_id,
        issue_date=m.issue_date,
        due_date=m.due_date,
        total=Money.from_minor_units(m.total_minor, currency=curr),
        status=InvoiceStatus[m.status],
        reminder_level=m.reminder_level,
        overdue_notified=m.overdue_notified,
        created_at=m.created_at,
        version=m.version,
        payments=payments,
        blockers=blockers,
        promises=promises,
        follow_ups=follow_ups,
        documents=documents,
        actions=actions,
    )


# ── Audit & Notification Mapping ──────────────────────────────────────────────

def audit_event_to_model(ev: AuditEvent) -> AuditEventModel:
    return AuditEventModel(
        id=ev.id,
        occurred_at=ev.occurred_at,
        event_type=ev.event_type,
        invoice_id=ev.invoice_id,
        description=ev.description,
    )


def model_to_audit_event(m: AuditEventModel) -> AuditEvent:
    return AuditEvent.reconstitute(
        id=m.id,
        occurred_at=m.occurred_at,
        event_type=m.event_type,
        invoice_id=m.invoice_id,
        description=m.description,
    )


def notification_to_model(n: Notification) -> NotificationModel:
    return NotificationModel(
        id=n.id,
        message=n.message,
        created_at=n.created_at,
        is_read=n.is_read,
    )


def model_to_notification(m: NotificationModel) -> Notification:
    return Notification.reconstitute(
        id=m.id,
        message=m.message,
        created_at=m.created_at,
        is_read=m.is_read,
    )
