"""Invoice API endpoints covering lifecycle, payments, blockers, actions, and reminders."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import get_facade
from app.api.presenters import (
    invoice_to_dto,
    invoice_to_summary_dto,
)
from app.api.schemas import (
    BlockerCreate,
    BlockerPatch,
    DocumentCreate,
    FollowUpCreate,
    InvoiceCreate,
    InvoiceRead,
    InvoiceSummaryRead,
    InvoiceUpdate,
    InvoiceWriteOff,
    NextActionCreate,
    NextActionReschedule,
    PaymentCreate,
    PromiseCreate,
    ReminderRead,
    ReminderSentCreate,
)
from app.application.facade import CollectionFacade
from app.domain.enums import (
    BlockerStatus,
    BlockerType,
    Channel,
    DocumentType,
    FollowUpOutcome,
    InvoiceStatus,
    PaymentMethod,
    Priority,
    ReminderTone,
)
from app.domain.invoice import Invoice
from app.domain.money import Money

router = APIRouter(tags=["invoices"])


def _present_invoice(facade: CollectionFacade, invoice: Invoice) -> InvoiceRead:
    client = facade.client_repo.get(invoice.client_id)
    project = facade.project_repo.get(invoice.project_id) if invoice.project_id else None
    today = facade.clock.today()
    return invoice_to_dto(invoice, client, project, today)


@router.get("/invoices", response_model=List[InvoiceSummaryRead])
def list_invoices(
    response: Response,
    status: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    overdue: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    facade: CollectionFacade = Depends(get_facade),
) -> List[InvoiceSummaryRead]:
    status_enum = InvoiceStatus[status] if status else None
    total = facade.count_invoices()
    response.headers["X-Total-Count"] = str(total)
    invoices = facade.list_invoices(
        status=status_enum,
        client_id=client_id,
        overdue_only=bool(overdue) if overdue is not None else False,
        search=q,
        limit=limit,
        offset=offset,
    )
    today = facade.clock.today()

    client_cache = {}
    project_cache = {}

    def get_client(cid: str):
        if cid not in client_cache:
            client_cache[cid] = facade.client_repo.get(cid)
        return client_cache[cid]

    def get_project(pid: Optional[str]):
        if not pid:
            return None
        if pid not in project_cache:
            project_cache[pid] = facade.project_repo.get(pid)
        return project_cache[pid]

    return [
        invoice_to_summary_dto(
            invoice=inv,
            client=get_client(inv.client_id),
            project=get_project(inv.project_id),
            today=today,
        )
        for inv in invoices
    ]


@router.post("/invoices", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
def create_invoice(
    body: InvoiceCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    default_curr = facade.get_settings().get("default_currency", "INR") or "INR"
    total_money = Money.of(body.total_amount, currency=default_curr)
    inv = facade.create_invoice(
        client_id=body.client_id,
        total=total_money,
        issue_date=body.issue_date,
        due_date=body.due_date,
        invoice_number=body.invoice_number,
        project_id=body.project_id,
    )
    return _present_invoice(facade, inv)


@router.get("/invoices/{id}", response_model=InvoiceRead)
def get_invoice(
    id: str,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.get_invoice(id)
    return _present_invoice(facade, inv)


@router.put("/invoices/{id}", response_model=InvoiceRead)
def update_invoice(
    id: str,
    body: InvoiceUpdate,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    total_money = None
    if body.total_amount is not None:
        curr_inv = facade.get_invoice(id)
        total_money = Money.of(body.total_amount, currency=curr_inv.total.currency)

    inv = facade.update_invoice(
        id=id,
        due_date=body.due_date,
        total=total_money,
        project_id=body.project_id,
    )
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/send", response_model=InvoiceRead)
def send_invoice(
    id: str,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.send_invoice(id)
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/payments", response_model=InvoiceRead)
def record_payment(
    id: str,
    body: PaymentCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    curr_inv = facade.get_invoice(id)
    amount_money = Money.of(body.amount, currency=curr_inv.total.currency)
    inv = facade.record_payment(
        invoice_id=id,
        amount=amount_money,
        payment_date=body.payment_date,
        method=PaymentMethod[body.method],
        reference_number=body.reference_number,
    )
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/write-off", response_model=InvoiceRead)
def write_off(
    id: str,
    body: InvoiceWriteOff,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.write_off(id, reason=body.reason)
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/blockers", response_model=InvoiceRead)
def raise_blocker(
    id: str,
    body: BlockerCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.raise_blocker(
        invoice_id=id,
        type=BlockerType[body.type],
        description=body.description or "",
        assigned_to=body.assigned_to,
    )
    return _present_invoice(facade, inv)


@router.patch("/invoices/{id}/blockers/{bid}", response_model=InvoiceRead)
def patch_blocker(
    id: str,
    bid: str,
    body: BlockerPatch,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    if body.assigned_to is not None:
        facade.assign_blocker(id, bid, body.assigned_to)
    if body.status is not None:
        facade.update_blocker_status(id, bid, BlockerStatus[body.status])
    inv = facade.get_invoice(id)
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/blockers/{bid}/resolve", response_model=InvoiceRead)
def resolve_blocker(
    id: str,
    bid: str,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.resolve_blocker(id, bid)
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/follow-ups", response_model=InvoiceRead)
def log_follow_up(
    id: str,
    body: FollowUpCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    curr_inv = facade.get_invoice(id)
    promised_money = (
        Money.of(body.promised_amount, currency=curr_inv.total.currency)
        if body.promised_amount
        else None
    )
    from datetime import datetime
    c_datetime = (
        datetime(body.contact_date.year, body.contact_date.month, body.contact_date.day, 12, 0, 0)
        if body.contact_date
        else None
    )
    inv = facade.log_follow_up(
        invoice_id=id,
        channel=Channel[body.channel],
        notes=body.notes,
        outcome=FollowUpOutcome[body.outcome],
        contact_date=c_datetime,
        promised_date=body.promised_date,
        promised_amount=promised_money,
    )
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/promises", response_model=InvoiceRead)
def record_promise(
    id: str,
    body: PromiseCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    curr_inv = facade.get_invoice(id)
    promised_money = (
        Money.of(body.amount, currency=curr_inv.total.currency)
        if body.amount
        else None
    )
    inv = facade.record_promise(
        invoice_id=id,
        promised_date=body.promised_date,
        amount=promised_money,
        note=body.note or "",
    )
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/documents", response_model=InvoiceRead)
def attach_document(
    id: str,
    body: DocumentCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.attach_document(
        invoice_id=id,
        document_type=DocumentType[body.document_type],
        file_name=body.file_name,
        file_path=body.file_path,
    )
    return _present_invoice(facade, inv)


@router.delete("/invoices/{id}/documents/{did}", response_model=InvoiceRead)
def remove_document(
    id: str,
    did: str,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.remove_document(id, did)
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/actions", response_model=InvoiceRead)
def add_action(
    id: str,
    body: NextActionCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.add_manual_action(
        invoice_id=id,
        description=body.description,
        priority=Priority[body.priority],
        due_date=body.due_date,
    )
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/actions/{aid}/complete", response_model=InvoiceRead)
def complete_action(
    id: str,
    aid: str,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.complete_action(id, aid)
    return _present_invoice(facade, inv)


@router.post("/invoices/{id}/actions/{aid}/reschedule", response_model=InvoiceRead)
def reschedule_action(
    id: str,
    aid: str,
    body: NextActionReschedule,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.reschedule_action(id, aid, body.new_date)
    return _present_invoice(facade, inv)


@router.get("/invoices/{id}/reminder", response_model=ReminderRead)
def get_reminder(
    id: str,
    tone: Optional[str] = Query(None),
    facade: CollectionFacade = Depends(get_facade),
) -> ReminderRead:
    tone_enum = ReminderTone[tone] if tone else None
    reminder = facade.generate_reminder(id, tone=tone_enum)
    return ReminderRead(
        tone=reminder.tone.name,
        subject=reminder.subject,
        body=reminder.body,
    )


@router.post("/invoices/{id}/reminder/sent", response_model=InvoiceRead)
def mark_reminder_sent(
    id: str,
    body: ReminderSentCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> InvoiceRead:
    inv = facade.mark_reminder_sent(
        invoice_id=id,
        tone=ReminderTone[body.tone],
        channel=Channel[body.channel],
    )
    return _present_invoice(facade, inv)
