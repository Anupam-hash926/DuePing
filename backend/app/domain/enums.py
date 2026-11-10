"""All domain enumerations — no stringly-typed state anywhere in the domain."""
from __future__ import annotations
from enum import Enum


class InvoiceStatus(Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    DISPUTED = "DISPUTED"
    WRITTEN_OFF = "WRITTEN_OFF"


class BlockerType(Enum):
    MISSING_PO = "MISSING_PO"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    DISPUTED_AMOUNT = "DISPUTED_AMOUNT"
    WRONG_DETAILS = "WRONG_DETAILS"
    MISSING_DOCUMENTS = "MISSING_DOCUMENTS"
    NO_RESPONSE = "NO_RESPONSE"
    OTHER = "OTHER"


class BlockerStatus(Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class PromiseStatus(Enum):
    PENDING = "PENDING"
    KEPT = "KEPT"
    MISSED = "MISSED"
    SUPERSEDED = "SUPERSEDED"


class ActionStatus(Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ActionSource(Enum):
    BLOCKER = "BLOCKER"
    PROMISE_MISSED = "PROMISE_MISSED"
    OVERDUE = "OVERDUE"
    MANUAL = "MANUAL"


class Priority(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Channel(Enum):
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    WHATSAPP = "WHATSAPP"
    MEETING = "MEETING"
    OTHER = "OTHER"


class FollowUpOutcome(Enum):
    NO_RESPONSE = "NO_RESPONSE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    PROMISED_PAYMENT = "PROMISED_PAYMENT"
    DISPUTED = "DISPUTED"
    PAID = "PAID"
    OTHER = "OTHER"


class PaymentMethod(Enum):
    BANK_TRANSFER = "BANK_TRANSFER"
    UPI = "UPI"
    CARD = "CARD"
    CASH = "CASH"
    CHEQUE = "CHEQUE"
    OTHER = "OTHER"


class DocumentType(Enum):
    PURCHASE_ORDER = "PURCHASE_ORDER"
    INVOICE_COPY = "INVOICE_COPY"
    APPROVAL_EVIDENCE = "APPROVAL_EVIDENCE"
    CONTRACT = "CONTRACT"
    OTHER = "OTHER"


class ReminderTone(Enum):
    POLITE = "POLITE"
    FIRM = "FIRM"
    FINAL = "FINAL"
