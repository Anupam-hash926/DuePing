"""Invoice factory handling unique number generation and initialisation.

# PATTERN: Factory — InvoiceFactory
Ensures unique sequence numbering format (DP-YYYY-NNNN) and encapsulation
of aggregate creation in DRAFT state.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional

from app.application.ports import InvoiceRepository
from app.domain.exceptions import DuplicateInvoiceNumber
from app.domain.invoice import Invoice
from app.domain.money import Money


class InvoiceFactory:
    """Factory creating new Invoice aggregates in DRAFT state.

    # PATTERN: Factory — Factory
    """

    def __init__(self, invoice_repo: InvoiceRepository) -> None:
        self.invoice_repo = invoice_repo

    def create(
        self,
        client_id: str,
        total: Money,
        issue_date: date,
        due_date: date,
        now: datetime,
        invoice_number: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> Invoice:
        """Create a new Invoice in DRAFT status.

        If invoice_number is omitted, generates 'DP-{issue_date.year}-{seq:04d}'.
        Validates uniqueness against the repository.
        """
        if not invoice_number:
            seq = self.invoice_repo.next_invoice_sequence(issue_date.year)
            num = ""
            for _ in range(5):
                candidate = f"DP-{issue_date.year}-{seq:04d}"
                if self.invoice_repo.find_by_number(candidate) is None:
                    num = candidate
                    break
                seq += 1
            if not num:
                raise DuplicateInvoiceNumber(f"Could not allocate unique invoice number for year {issue_date.year}")
        else:
            num = invoice_number.strip()
            # Check uniqueness in repo
            existing = self.invoice_repo.find_by_number(num)
            if existing is not None:
                raise DuplicateInvoiceNumber(f"Invoice number {num} already exists")

        return Invoice(
            invoice_number=num,
            client_id=client_id,
            total=total,
            issue_date=issue_date,
            due_date=due_date,
            now=now,
            project_id=project_id,
        )
