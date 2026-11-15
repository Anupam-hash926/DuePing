"""Action Centre subsystem coordinating prioritized follow-up task lists."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Optional

from app.application.ports import ClientRepository, Clock, InvoiceRepository
from app.application.prioritization import ActionContext, PrioritizationRegistry
from app.domain.client import Client
from app.domain.enums import ActionStatus
from app.domain.money import Money
from app.domain.next_action import NextAction


@dataclass(frozen=True)
class ActionCenterItem:
    action: NextAction
    invoice_id: str
    invoice_number: str
    client_id: str
    client_name: str
    outstanding: Money
    days_overdue: int
    score: float
    reason: str


@dataclass(frozen=True)
class ActionCenterView:
    strategy_key: str
    today: date
    items: List[ActionCenterItem]
    upcoming: List[ActionCenterItem]


class ActionCenter:
    """Builds prioritized and upcoming Action Centre views."""

    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        client_repo: ClientRepository,
        registry: PrioritizationRegistry,
        clock: Clock,
    ) -> None:
        self.invoice_repo = invoice_repo
        self.client_repo = client_repo
        self.registry = registry
        self.clock = clock

    def build(self, strategy_key: Optional[str] = None) -> ActionCenterView:
        strat_key = strategy_key or self.registry.default_key
        strategy = self.registry.get(strat_key)
        today = self.clock.today()

        client_cache: Dict[str, Client] = {}

        def get_client(cid: str) -> Client:
            if cid not in client_cache:
                client_cache[cid] = self.client_repo.get(cid)
            return client_cache[cid]

        active_invoices = self.invoice_repo.list_active_with_pending_actions()
        items: List[ActionCenterItem] = []
        upcoming: List[ActionCenterItem] = []

        upcoming_cutoff = today + timedelta(days=7)

        for inv in active_invoices:
            out_amt = inv.outstanding()
            days_ovd = inv.days_overdue(today)
            client = get_client(inv.client_id)

            for act in inv.actions:
                if act.status != ActionStatus.PENDING:
                    continue

                ctx = ActionContext(action=act, invoice=inv, client=client, today=today)

                if act.is_actionable(today):
                    score = strategy.score(ctx)
                    reason = strategy.explain(ctx)
                    items.append(
                        ActionCenterItem(
                            action=act,
                            invoice_id=inv.id,
                            invoice_number=inv.invoice_number,
                            client_id=client.id,
                            client_name=client.name,
                            outstanding=out_amt,
                            days_overdue=days_ovd,
                            score=score,
                            reason=reason,
                        )
                    )
                elif today < act.due_date <= upcoming_cutoff:
                    reason = strategy.explain(ctx)
                    upcoming.append(
                        ActionCenterItem(
                            action=act,
                            invoice_id=inv.id,
                            invoice_number=inv.invoice_number,
                            client_id=client.id,
                            client_name=client.name,
                            outstanding=out_amt,
                            days_overdue=days_ovd,
                            score=0.0,
                            reason=reason,
                        )
                    )

        # Sort actionable items by (-score, due_date, invoice_number)
        items.sort(key=lambda item: (-item.score, item.action.due_date, item.invoice_number))

        # Sort upcoming by (due_date, invoice_number)
        upcoming.sort(key=lambda item: (item.action.due_date, item.invoice_number))

        return ActionCenterView(
            strategy_key=strat_key,
            today=today,
            items=items,
            upcoming=upcoming,
        )
