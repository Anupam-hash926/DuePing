"""Daily Check Service standing in for periodic scheduler tasks."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from typing import List

from app.application.event_bus import EventBus, save_and_publish
from app.application.ports import Clock, InvoiceRepository


@dataclass(frozen=True)
class DailyCheckSummary:
    date: date
    invoices_checked: int
    promises_missed: int
    newly_overdue: int


class DailyCheckService:
    """Evaluates active invoices for overdue promises and overdue flags.

    Idempotent: running multiple times on the same date creates no duplicate
    promise-missed actions or overdue alerts.
    """

    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        bus: EventBus,
        clock: Clock,
    ) -> None:
        self.invoice_repo = invoice_repo
        self.bus = bus
        self.clock = clock

    def run(self) -> DailyCheckSummary:
        today = self.clock.today()
        now = self.clock.now()

        active = self.invoice_repo.list_active()
        invoices_checked = len(active)
        total_promises_missed = 0
        total_newly_overdue = 0

        for invoice in active:
            missed = invoice.check_promises(today, now)
            flagged = invoice.flag_overdue_if_needed(today, now)

            total_promises_missed += len(missed)
            if flagged:
                total_newly_overdue += 1

            if missed or flagged:
                save_and_publish(self.invoice_repo, self.bus, invoice)

        return DailyCheckSummary(
            date=today,
            invoices_checked=invoices_checked,
            promises_missed=total_promises_missed,
            newly_overdue=total_newly_overdue,
        )
