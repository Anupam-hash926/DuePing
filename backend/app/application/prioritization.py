"""Action Centre prioritisation strategies.

# PATTERN: Strategy — Prioritization Strategy Interface, Concrete Strategies, and Registry
Ranks pending collection actions according to swappable business goals
(e.g., maximizing cash flow vs. aging vs. client default risk).
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Dict, List

from app.domain.client import Client
from app.domain.enums import Priority
from app.domain.exceptions import DomainValidationError
from app.domain.invoice import Invoice
from app.domain.next_action import NextAction


@dataclass(frozen=True)
class ActionContext:
    action: NextAction
    invoice: Invoice
    client: Client
    today: date


PRIORITY_WEIGHT = {
    Priority.LOW: 10.0,
    Priority.MEDIUM: 25.0,
    Priority.HIGH: 50.0,
    Priority.CRITICAL: 80.0,
}


class PrioritizationStrategy(ABC):
    """Abstract prioritisation strategy for Action Centre items.

    # PATTERN: Strategy — Strategy
    """

    key: str
    label: str

    @abstractmethod
    def score(self, ctx: ActionContext) -> float:
        """Calculate a numerical score for ranking (higher = higher rank)."""
        ...

    @abstractmethod
    def explain(self, ctx: ActionContext) -> str:
        """Provide human-readable explanation of why this item is ranked."""
        ...


class AmountFirstStrategy(PrioritizationStrategy):
    """Ranks by largest outstanding invoice amount first.

    # PATTERN: Strategy — ConcreteStrategy
    """

    key = "amount_first"
    label = "Largest amount first"

    def score(self, ctx: ActionContext) -> float:
        return float(ctx.invoice.outstanding().amount)

    def explain(self, ctx: ActionContext) -> str:
        return f"{ctx.invoice.outstanding().format()} outstanding"


class OldestFirstStrategy(PrioritizationStrategy):
    """Ranks by most overdue invoices and actions first.

    # PATTERN: Strategy — ConcreteStrategy
    """

    key = "oldest_first"
    label = "Most overdue first"

    def score(self, ctx: ActionContext) -> float:
        action_overdue_days = (ctx.today - ctx.action.due_date).days if ctx.action.is_overdue(ctx.today) else 0
        return float(ctx.invoice.days_overdue(ctx.today) + action_overdue_days)

    def explain(self, ctx: ActionContext) -> str:
        days = ctx.invoice.days_overdue(ctx.today)
        parts = []
        if days > 0:
            parts.append(f"{days} days overdue")
        else:
            parts.append("current invoice")
        if ctx.action.is_overdue(ctx.today):
            act_days = (ctx.today - ctx.action.due_date).days
            parts.append(f"action overdue {act_days}d")
        return " · ".join(parts)


class RiskWeightedStrategy(PrioritizationStrategy):
    """Ranks by composite risk: priority weight + overdue days + reliability + outstanding amount.

    # PATTERN: Strategy — ConcreteStrategy (Default)
    """

    key = "risk_weighted"
    label = "Risk-weighted (recommended)"

    def score(self, ctx: ActionContext) -> float:
        p_weight = PRIORITY_WEIGHT.get(ctx.action.priority, 10.0)
        days_ovd = ctx.invoice.days_overdue(ctx.today)
        ovd_factor = 0.5 * min(days_ovd, 90)
        rel_factor = 0.3 * (100 - ctx.client.reliability_score())
        out_amt = float(ctx.invoice.outstanding().amount)
        amt_factor = 20.0 * min(out_amt / 10000.0, 1.0)
        return p_weight + ovd_factor + rel_factor + amt_factor

    def explain(self, ctx: ActionContext) -> str:
        parts = [f"{ctx.action.priority.name} priority"]
        days = ctx.invoice.days_overdue(ctx.today)
        if days > 0:
            parts.append(f"{days} days overdue")
        parts.append(f"{ctx.invoice.outstanding().format()} outstanding")
        rel = ctx.client.reliability_score()
        parts.append(f"client reliability {rel}%")
        return " · ".join(parts)


class PrioritizationRegistry:
    """Registry for available prioritization strategies."""

    default_key = "risk_weighted"

    def __init__(self) -> None:
        self._strategies: Dict[str, PrioritizationStrategy] = {}
        self.register(RiskWeightedStrategy())
        self.register(AmountFirstStrategy())
        self.register(OldestFirstStrategy())

    def register(self, strategy: PrioritizationStrategy) -> None:
        self._strategies[strategy.key] = strategy

    def get(self, key: str) -> PrioritizationStrategy:
        if key not in self._strategies:
            raise DomainValidationError(f"Unknown prioritization strategy: {key}")
        return self._strategies[key]

    def all(self) -> List[PrioritizationStrategy]:
        return list(self._strategies.values())
