"""Pydantic request and response schemas for the API layer.

Defines all input (request body) and output (response) schemas.
Follows JSON conventions in Section 15.3:
- Money: {"amount": "1500.00", "currency": "INR"}
- Dates YYYY-MM-DD, datetimes ISO 8601
- Enums as string names
"""
from __future__ import annotations

from datetime import date, datetime
import datetime as _dt
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Common / Money
# ---------------------------------------------------------------------------


class MoneyDTO(BaseModel):
    amount: str
    currency: str


class SuccessResponse(BaseModel):
    ok: bool = True


# ---------------------------------------------------------------------------
# Clients & Projects
# ---------------------------------------------------------------------------


class ClientCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None


class ClientRead(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    reliability_score: float
    risk_level: str
    promises_kept_count: int
    promises_broken_count: int
    created_at: datetime


class ClientSnippetRead(BaseModel):
    id: str
    name: str
    company_name: Optional[str] = None
    reliability_score: float
    risk_level: str


class ProjectCreate(BaseModel):
    client_id: str
    project_name: str
    description: Optional[str] = None
    start_date: date


class ProjectRead(BaseModel):
    id: str
    client_id: str
    project_name: str
    description: Optional[str] = None
    start_date: date
    status: str


class ProjectSnippetRead(BaseModel):
    id: str
    project_name: str


# ---------------------------------------------------------------------------
# Invoice Children
# ---------------------------------------------------------------------------


class PaymentCreate(BaseModel):
    amount: str
    payment_date: date
    method: str
    reference_number: Optional[str] = None


class PaymentRead(BaseModel):
    id: str
    amount: MoneyDTO
    payment_date: date
    method: str
    reference_number: Optional[str] = None
    recorded_at: datetime


class BlockerCreate(BaseModel):
    type: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None


class BlockerPatch(BaseModel):
    assigned_to: Optional[str] = None
    status: Optional[str] = None


class BlockerRead(BaseModel):
    id: str
    type: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None


class FollowUpCreate(BaseModel):
    channel: str
    notes: str
    outcome: str
    contact_date: Optional[date] = None
    promised_date: Optional[date] = None
    promised_amount: Optional[str] = None


class FollowUpRead(BaseModel):
    id: str
    contact_date: datetime
    channel: str
    notes: str
    outcome: str
    promised_date: Optional[date] = None
    promised_amount: Optional[MoneyDTO] = None


class PromiseCreate(BaseModel):
    promised_date: date
    amount: Optional[str] = None
    note: Optional[str] = None


class PromiseRead(BaseModel):
    id: str
    promised_date: date
    amount: Optional[MoneyDTO] = None
    note: Optional[str] = None
    status: str
    created_at: datetime


class DocumentCreate(BaseModel):
    document_type: str
    file_name: str
    file_path: str


class DocumentRead(BaseModel):
    id: str
    document_type: str
    file_name: str
    file_type: str
    file_path: str
    uploaded_at: datetime


class NextActionCreate(BaseModel):
    description: str
    priority: str
    due_date: date


class NextActionReschedule(BaseModel):
    new_date: date


class NextActionRead(BaseModel):
    id: str
    invoice_id: Optional[str] = None
    description: str
    priority: str
    due_date: date
    status: str
    source: str
    completed_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------


class InvoiceCreate(BaseModel):
    client_id: str
    total_amount: str
    issue_date: date
    due_date: date
    invoice_number: Optional[str] = None
    project_id: Optional[str] = None


class InvoiceUpdate(BaseModel):
    due_date: Optional[date] = None
    total_amount: Optional[str] = None
    project_id: Optional[str] = None


class InvoiceWriteOff(BaseModel):
    reason: str


class InvoiceSummaryRead(BaseModel):
    id: str
    invoice_number: str
    client: ClientSnippetRead
    project: Optional[ProjectSnippetRead] = None
    issue_date: date
    due_date: date
    total: MoneyDTO
    amount_paid: MoneyDTO
    outstanding: MoneyDTO
    status: str
    is_overdue: bool
    days_overdue: int
    reminder_level: int
    allowed_operations: List[str]
    open_blocker_count: int
    pending_action_count: int


class InvoiceRead(BaseModel):
    id: str
    invoice_number: str
    client: ClientSnippetRead
    project: Optional[ProjectSnippetRead] = None
    issue_date: date
    due_date: date
    total: MoneyDTO
    amount_paid: MoneyDTO
    outstanding: MoneyDTO
    status: str
    is_overdue: bool
    days_overdue: int
    reminder_level: int
    allowed_operations: List[str]
    open_blocker_count: int = 0
    pending_action_count: int = 0
    payments: List[PaymentRead] = Field(default_factory=list)
    blockers: List[BlockerRead] = Field(default_factory=list)
    promises: List[PromiseRead] = Field(default_factory=list)
    follow_ups: List[FollowUpRead] = Field(default_factory=list)
    documents: List[DocumentRead] = Field(default_factory=list)
    actions: List[NextActionRead] = Field(default_factory=list)


class ClientSummaryRead(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    reliability_score: float
    risk_level: str
    promises_kept_count: int
    promises_broken_count: int
    created_at: datetime
    total_outstanding: MoneyDTO
    invoices: List[InvoiceSummaryRead] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Reminders
# ---------------------------------------------------------------------------


class ReminderRead(BaseModel):
    tone: str
    subject: str
    body: str


class ReminderSentCreate(BaseModel):
    tone: str
    channel: str


# ---------------------------------------------------------------------------
# Action Centre
# ---------------------------------------------------------------------------


class ActionCenterItemRead(BaseModel):
    action: NextActionRead
    invoice_id: str
    invoice_number: str
    client_id: str
    client_name: str
    outstanding: MoneyDTO
    days_overdue: int
    score: float
    reason: str


class StrategyInfoRead(BaseModel):
    key: str
    label: str


class ActionCenterRead(BaseModel):
    strategy: str
    today: date
    strategies: List[StrategyInfoRead]
    items: List[ActionCenterItemRead]
    upcoming: List[ActionCenterItemRead]


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


class ImportRequest(BaseModel):
    format: str = "csv"
    content: str


class RowErrorRead(BaseModel):
    row_number: int
    messages: List[str]


class ImportResultRead(BaseModel):
    processed: int
    imported: int
    rejected: int
    errors: List[RowErrorRead]
    file_errors: List[str]
    summary: str


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


class AgingRowRead(BaseModel):
    bucket: str
    label: str
    count: int
    amount: MoneyDTO


class TrendPointRead(BaseModel):
    month: str
    collected: MoneyDTO


class DebtorRowRead(BaseModel):
    client_id: str
    name: str
    outstanding: MoneyDTO


class CollectionReportRead(BaseModel):
    generated_at: datetime
    total_outstanding: MoneyDTO
    total_overdue: MoneyDTO
    overdue_count: int
    active_count: int
    broken_promises: int
    kept_promises: int
    promise_keep_rate: Optional[int] = None
    collected_this_month: MoneyDTO
    status_counts: Dict[str, int]
    open_blockers_by_type: Dict[str, int]
    top_debtors: List[DebtorRowRead]
    collection_trend: List[TrendPointRead]
    aging: List[AgingRowRead]


# ---------------------------------------------------------------------------
# System & Audit
# ---------------------------------------------------------------------------


class DailyCheckSummaryRead(BaseModel):
    date: date
    invoices_checked: int
    promises_missed: int
    newly_overdue: int


class SimulatedDateRead(BaseModel):
    today: date
    simulated: bool


class SimulatedDateUpdate(BaseModel):
    date: Optional[_dt.date] = None


class SettingsRead(BaseModel):
    sender_name: str
    default_currency: str


class SettingsUpdate(BaseModel):
    sender_name: Optional[str] = None
    default_currency: Optional[str] = None


class AuditEventRead(BaseModel):
    id: str
    occurred_at: datetime
    event_type: str
    invoice_id: Optional[str] = None
    description: str


class NotificationRead(BaseModel):
    id: str
    message: str
    created_at: datetime
    is_read: bool
