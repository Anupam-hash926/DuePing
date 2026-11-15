"""Collection reporting and aging calculations computed on demand."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from app.application.ports import ClientRepository, Clock, InvoiceRepository, SettingsRepository
from app.domain.enums import BlockerType, InvoiceStatus
from app.domain.money import Money


class AgingBucket(Enum):
    CURRENT = "CURRENT"
    DAYS_1_30 = "DAYS_1_30"
    DAYS_31_60 = "DAYS_31_60"
    DAYS_61_90 = "DAYS_61_90"
    DAYS_90_PLUS = "DAYS_90_PLUS"

    @classmethod
    def for_days(cls, days: int) -> AgingBucket:
        if days <= 0:
            return cls.CURRENT
        elif 1 <= days <= 30:
            return cls.DAYS_1_30
        elif 31 <= days <= 60:
            return cls.DAYS_31_60
        elif 61 <= days <= 90:
            return cls.DAYS_61_90
        else:
            return cls.DAYS_90_PLUS

    @property
    def label(self) -> str:
        _labels = {
            AgingBucket.CURRENT: "Current",
            AgingBucket.DAYS_1_30: "1–30 days",
            AgingBucket.DAYS_31_60: "31–60 days",
            AgingBucket.DAYS_61_90: "61–90 days",
            AgingBucket.DAYS_90_PLUS: "90+ days",
        }
        return _labels[self]


@dataclass(frozen=True)
class DebtorRow:
    client_id: str
    name: str
    outstanding: Money


@dataclass(frozen=True)
class TrendPoint:
    month: str  # YYYY-MM
    collected: Money


@dataclass(frozen=True)
class AgingRow:
    bucket: AgingBucket
    label: str
    count: int
    amount: Money


@dataclass(frozen=True)
class CollectionReport:
    generated_at: datetime
    total_outstanding: Money
    total_overdue: Money
    overdue_count: int
    active_count: int
    broken_promises: int
    kept_promises: int
    promise_keep_rate: int | None
    collected_this_month: Money
    status_counts: dict[str, int]
    open_blockers_by_type: dict[str, int]
    top_debtors: list[DebtorRow]
    collection_trend: list[TrendPoint]
    aging: list[AgingRow]


class ReportService:
    """Service computing collection and aging statistics on demand."""

    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        client_repo: ClientRepository,
        settings: SettingsRepository,
        clock: Clock,
    ) -> None:
        self.invoice_repo = invoice_repo
        self.client_repo = client_repo
        self.settings = settings
        self.clock = clock

    def build(self) -> CollectionReport:
        today = self.clock.today()
        now = self.clock.now()
        default_curr = self.settings.get("default_currency", "INR") or "INR"

        all_invoices = self.invoice_repo.list_all()
        active_statuses = {InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.DISPUTED}
        active_invoices = [inv for inv in all_invoices if inv.status in active_statuses]

        # 1. Totals
        total_outstanding = Money.zero(default_curr)
        for inv in active_invoices:
            total_outstanding = total_outstanding.add(inv.outstanding())

        total_overdue = Money.zero(default_curr)
        overdue_count = 0
        for inv in active_invoices:
            if inv.is_overdue(today):
                total_overdue = total_overdue.add(inv.outstanding())
                overdue_count += 1

        active_count = len(active_invoices)

        # 2. Client promise counters (global across clients)
        clients = self.client_repo.list_all()
        kept_promises = sum(c.promises_kept for c in clients)
        broken_promises = sum(c.promises_missed for c in clients)
        total_resolved_promises = kept_promises + broken_promises
        keep_rate = round(100 * kept_promises / total_resolved_promises) if total_resolved_promises > 0 else None

        # 3. Collected this month
        collected_this_month = Money.zero(default_curr)
        for inv in all_invoices:
            for p in inv.payments:
                if p.payment_date.year == today.year and p.payment_date.month == today.month:
                    collected_this_month = collected_this_month.add(p.amount)

        # 4. Status counts (all 6 statuses initialized to 0)
        status_counts = {s.name: 0 for s in InvoiceStatus}
        for inv in all_invoices:
            status_counts[inv.status.name] += 1

        # 5. Open blockers by type (all 7 blocker types initialized to 0)
        open_blockers_by_type = {bt.name: 0 for bt in BlockerType}
        for inv in active_invoices:
            for b in inv.open_blockers():
                open_blockers_by_type[b.type.name] += 1

        # 6. Top debtors (top 5 by outstanding desc)
        debtor_totals: dict[str, Money] = {}
        for inv in active_invoices:
            cid = inv.client_id
            if cid not in debtor_totals:
                debtor_totals[cid] = inv.outstanding()
            else:
                debtor_totals[cid] = debtor_totals[cid].add(inv.outstanding())

        client_map = {c.id: c.name for c in clients}
        debtor_rows: list[DebtorRow] = []
        for cid, amt in debtor_totals.items():
            if amt.is_positive():
                cname = client_map.get(cid, "Unknown")
                debtor_rows.append(DebtorRow(client_id=cid, name=cname, outstanding=amt))
        debtor_rows.sort(key=lambda d: d.outstanding.amount, reverse=True)
        top_debtors = debtor_rows[:5]

        # 7. Collection trend (last 6 calendar months including current, zero-filled, oldest to newest)
        def get_prior_month(year: int, month: int, delta: int) -> tuple[int, int]:
            m = month - 1 - delta
            return year + (m // 12), (m % 12) + 1

        target_months = []
        for i in range(5, -1, -1):
            y, m = get_prior_month(today.year, today.month, i)
            target_months.append(f"{y:04d}-{m:02d}")

        trend_sums = {m_str: Money.zero(default_curr) for m_str in target_months}
        for inv in all_invoices:
            for p in inv.payments:
                m_str = f"{p.payment_date.year:04d}-{p.payment_date.month:02d}"
                if m_str in trend_sums:
                    trend_sums[m_str] = trend_sums[m_str].add(p.amount)

        collection_trend = [TrendPoint(month=m, collected=trend_sums[m]) for m in target_months]

        # 8. Aging buckets (all 5 buckets, zero-filled)
        bucket_order = [
            AgingBucket.CURRENT,
            AgingBucket.DAYS_1_30,
            AgingBucket.DAYS_31_60,
            AgingBucket.DAYS_61_90,
            AgingBucket.DAYS_90_PLUS,
        ]
        aging_counts = {b: 0 for b in bucket_order}
        aging_amounts = {b: Money.zero(default_curr) for b in bucket_order}

        for inv in active_invoices:
            days = inv.days_overdue(today)
            bucket = AgingBucket.for_days(days)
            aging_counts[bucket] += 1
            aging_amounts[bucket] = aging_amounts[bucket].add(inv.outstanding())

        aging = [
            AgingRow(
                bucket=b,
                label=b.label,
                count=aging_counts[b],
                amount=aging_amounts[b],
            )
            for b in bucket_order
        ]

        return CollectionReport(
            generated_at=now,
            total_outstanding=total_outstanding,
            total_overdue=total_overdue,
            overdue_count=overdue_count,
            active_count=active_count,
            broken_promises=broken_promises,
            kept_promises=kept_promises,
            promise_keep_rate=keep_rate,
            collected_this_month=collected_this_month,
            status_counts=status_counts,
            open_blockers_by_type=open_blockers_by_type,
            top_debtors=top_debtors,
            collection_trend=collection_trend,
            aging=aging,
        )
