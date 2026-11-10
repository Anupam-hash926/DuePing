"""Shared fixtures for domain tests."""
import pytest
from datetime import date, datetime, timedelta
from decimal import Decimal

from app.domain.money import Money
from app.domain.enums import PaymentMethod
from app.domain.payment import Payment
from app.domain.invoice import Invoice


TODAY = date(2026, 11, 10)
NOW = datetime(2026, 11, 10, 9, 0, 0)


def make_invoice(
    total_amount: int = 100_000,
    issue_days_ago: int = 10,
    due_days_ago: int = 0,
    invoice_number: str = "DP-2026-0001",
) -> Invoice:
    """Create a fresh DRAFT invoice relative to TODAY."""
    issue = TODAY - timedelta(days=issue_days_ago)
    due = TODAY - timedelta(days=due_days_ago)
    if due < issue:
        due = issue
    return Invoice(
        invoice_number=invoice_number,
        client_id="client-1",
        total=Money.of(total_amount),
        issue_date=issue,
        due_date=due,
        now=NOW,
    )


def make_payment(amount: int, days_ago: int = 0) -> Payment:
    """Create a payment recorded today (or N days ago)."""
    return Payment(
        amount=Money.of(amount),
        payment_date=TODAY - timedelta(days=days_ago),
        method=PaymentMethod.BANK_TRANSFER,
        recorded_at=NOW,
    )
