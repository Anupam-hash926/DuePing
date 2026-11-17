"""Presenters converting domain entity instances to API response DTOs.

Pure presentation layer keeping mapping logic out of FastAPI route handlers.
"""
from __future__ import annotations

from datetime import date

from app.api.schemas import (
    ActionCenterItemRead,
    ActionCenterRead,
    AgingRowRead,
    AuditEventRead,
    BlockerRead,
    ClientRead,
    ClientSnippetRead,
    ClientSummaryRead,
    CollectionReportRead,
    DebtorRowRead,
    DocumentRead,
    FollowUpRead,
    ImportResultRead,
    InvoiceRead,
    InvoiceSummaryRead,
    MoneyDTO,
    NextActionRead,
    NotificationRead,
    PaymentRead,
    ProjectRead,
    ProjectSnippetRead,
    PromiseRead,
    RowErrorRead,
    StrategyInfoRead,
    TrendPointRead,
)
from app.application.action_center import ActionCenterItem, ActionCenterView
from app.application.importing import ImportResult
from app.application.reports import CollectionReport
from app.domain.audit import AuditEvent, Notification
from app.domain.blocker import PaymentBlocker
from app.domain.client import Client
from app.domain.document import SupportingDocument
from app.domain.enums import ActionStatus
from app.domain.follow_up import FollowUp
from app.domain.invoice import Invoice
from app.domain.money import Money
from app.domain.next_action import NextAction
from app.domain.payment import Payment
from app.domain.project import Project
from app.domain.promise import PaymentPromise


def money_to_dto(m: Money) -> MoneyDTO:
    return MoneyDTO(amount=str(m.amount), currency=m.currency)


def client_to_snippet(c: Client) -> ClientSnippetRead:
    return ClientSnippetRead(
        id=c.id,
        name=c.name,
        company_name=c.company_name,
        reliability_score=c.reliability_score(),
        risk_level=c.risk_level(),
    )


def client_to_dto(c: Client) -> ClientRead:
    return ClientRead(
        id=c.id,
        name=c.name,
        email=c.email,
        phone=c.phone,
        company_name=c.company_name,
        reliability_score=c.reliability_score(),
        risk_level=c.risk_level(),
        promises_kept_count=c.promises_kept,
        promises_broken_count=c.promises_missed,
        created_at=c.created_at,
    )


def project_to_snippet(p: Project) -> ProjectSnippetRead:
    return ProjectSnippetRead(
        id=p.id,
        project_name=p.project_name,
    )


def project_to_dto(p: Project) -> ProjectRead:
    return ProjectRead(
        id=p.id,
        client_id=p.client_id,
        project_name=p.project_name,
        description=p.description,
        start_date=p.start_date,
        status=p.status,
    )


def payment_to_dto(p: Payment) -> PaymentRead:
    return PaymentRead(
        id=p.id,
        amount=money_to_dto(p.amount),
        payment_date=p.payment_date,
        method=p.method.name,
        reference_number=p.reference_number,
        recorded_at=p.recorded_at,
    )


def blocker_to_dto(b: PaymentBlocker) -> BlockerRead:
    return BlockerRead(
        id=b.id,
        type=b.type.name,
        description=b.description,
        assigned_to=b.assigned_to,
        status=b.status.name,
        created_at=b.created_at,
        resolved_at=b.resolved_at,
    )


def promise_to_dto(pr: PaymentPromise) -> PromiseRead:
    return PromiseRead(
        id=pr.id,
        promised_date=pr.promised_date,
        amount=money_to_dto(pr.amount) if pr.amount is not None else None,
        note=pr.note,
        status=pr.status.name,
        created_at=pr.created_at,
    )


def follow_up_to_dto(f: FollowUp) -> FollowUpRead:
    return FollowUpRead(
        id=f.id,
        contact_date=f.contact_date,
        channel=f.channel.name,
        notes=f.notes,
        outcome=f.outcome.name,
        promised_date=None,
        promised_amount=None,
    )


def document_to_dto(d: SupportingDocument) -> DocumentRead:
    return DocumentRead(
        id=d.id,
        document_type=d.document_type.name,
        file_name=d.file_name,
        file_type=d.file_type,
        file_path=d.file_path,
        uploaded_at=d.uploaded_at,
    )


def next_action_to_dto(a: NextAction, invoice_id: str | None = None) -> NextActionRead:
    return NextActionRead(
        id=a.id,
        invoice_id=invoice_id,
        description=a.description,
        priority=a.priority.name,
        due_date=a.due_date,
        status=a.status.name,
        source=a.source.name,
        completed_at=a.completed_at,
    )


def invoice_to_summary_dto(
    invoice: Invoice,
    client: Client,
    project: Project | None,
    today: date,
) -> InvoiceSummaryRead:
    return InvoiceSummaryRead(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        client=client_to_snippet(client),
        project=project_to_snippet(project) if project is not None else None,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        total=money_to_dto(invoice.total),
        amount_paid=money_to_dto(invoice.amount_paid()),
        outstanding=money_to_dto(invoice.outstanding()),
        status=invoice.status.name,
        is_overdue=invoice.is_overdue(today),
        days_overdue=invoice.days_overdue(today),
        reminder_level=invoice.reminder_level,
        allowed_operations=list(invoice.allowed_operations()),
        open_blocker_count=len(invoice.open_blockers()),
        pending_action_count=len([a for a in invoice.actions if a.status == ActionStatus.PENDING]),
    )


def invoice_to_dto(
    invoice: Invoice,
    client: Client,
    project: Project | None,
    today: date,
) -> InvoiceRead:
    return InvoiceRead(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        client=client_to_snippet(client),
        project=project_to_snippet(project) if project is not None else None,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        total=money_to_dto(invoice.total),
        amount_paid=money_to_dto(invoice.amount_paid()),
        outstanding=money_to_dto(invoice.outstanding()),
        status=invoice.status.name,
        is_overdue=invoice.is_overdue(today),
        days_overdue=invoice.days_overdue(today),
        reminder_level=invoice.reminder_level,
        allowed_operations=list(invoice.allowed_operations()),
        open_blocker_count=len(invoice.open_blockers()),
        pending_action_count=len([a for a in invoice.actions if a.status == ActionStatus.PENDING]),
        payments=[payment_to_dto(p) for p in invoice.payments],
        blockers=[blocker_to_dto(b) for b in invoice.blockers],
        promises=[promise_to_dto(pr) for pr in invoice.promises],
        follow_ups=[follow_up_to_dto(f) for f in invoice.follow_ups],
        documents=[document_to_dto(d) for d in invoice.documents],
        actions=[next_action_to_dto(a, invoice_id=invoice.id) for a in invoice.actions],
    )


def client_summary_to_dto(
    client: Client,
    outstanding: Money,
    invoices: list[InvoiceSummaryRead],
) -> ClientSummaryRead:
    return ClientSummaryRead(
        id=client.id,
        name=client.name,
        email=client.email,
        phone=client.phone,
        company_name=client.company_name,
        reliability_score=client.reliability_score(),
        risk_level=client.risk_level(),
        promises_kept_count=client.promises_kept,
        promises_broken_count=client.promises_missed,
        created_at=client.created_at,
        total_outstanding=money_to_dto(outstanding),
        invoices=invoices,
    )


def action_center_item_to_dto(item: ActionCenterItem) -> ActionCenterItemRead:
    return ActionCenterItemRead(
        action=next_action_to_dto(item.action, invoice_id=item.invoice_id),
        invoice_id=item.invoice_id,
        invoice_number=item.invoice_number,
        client_id=item.client_id,
        client_name=item.client_name,
        outstanding=money_to_dto(item.outstanding),
        days_overdue=item.days_overdue,
        score=item.score,
        reason=item.reason,
        suggested_tone=item.suggested_tone,
    )


def action_center_to_dto(
    view: ActionCenterView,
    strategies: list[dict[str, str]],
) -> ActionCenterRead:
    return ActionCenterRead(
        strategy=view.strategy_key,
        today=view.today,
        strategies=[StrategyInfoRead(key=s["key"], label=s["label"]) for s in strategies],
        items=[action_center_item_to_dto(item) for item in view.items],
        upcoming=[action_center_item_to_dto(item) for item in view.upcoming],
    )


def import_result_to_dto(res: ImportResult) -> ImportResultRead:
    return ImportResultRead(
        processed=res.processed,
        imported=res.imported,
        rejected=res.rejected,
        errors=[RowErrorRead(row_number=e.row_number, messages=e.messages) for e in res.errors],
        file_errors=res.file_errors,
        summary=res.summary(),
    )


def report_to_dto(report: CollectionReport) -> CollectionReportRead:
    return CollectionReportRead(
        generated_at=report.generated_at,
        total_outstanding=money_to_dto(report.total_outstanding),
        total_overdue=money_to_dto(report.total_overdue),
        overdue_count=report.overdue_count,
        active_count=report.active_count,
        broken_promises=report.broken_promises,
        kept_promises=report.kept_promises,
        promise_keep_rate=report.promise_keep_rate,
        collected_this_month=money_to_dto(report.collected_this_month),
        status_counts=report.status_counts,
        open_blockers_by_type=report.open_blockers_by_type,
        top_debtors=[
            DebtorRowRead(
                client_id=d.client_id,
                name=d.name,
                outstanding=money_to_dto(d.outstanding),
            )
            for d in report.top_debtors
        ],
        collection_trend=[
            TrendPointRead(month=t.month, collected=money_to_dto(t.collected))
            for t in report.collection_trend
        ],
        aging=[
            AgingRowRead(
                bucket=a.bucket.name,
                label=a.label,
                count=a.count,
                amount=money_to_dto(a.amount),
            )
            for a in report.aging
        ],
    )


def audit_event_to_dto(ev: AuditEvent) -> AuditEventRead:
    return AuditEventRead(
        id=ev.id,
        occurred_at=ev.occurred_at,
        event_type=ev.event_type,
        invoice_id=ev.invoice_id,
        description=ev.description,
    )


def notification_to_dto(n: Notification) -> NotificationRead:
    return NotificationRead(
        id=n.id,
        message=n.message,
        created_at=n.created_at,
        is_read=n.is_read,
    )
