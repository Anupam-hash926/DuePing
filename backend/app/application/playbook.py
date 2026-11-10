"""Resolution Playbook — maps structured PaymentBlocker types to recommended NextActions.

# PATTERN: Strategy — Strategy Interface, Concrete Strategies, and Playbook Registry
Adding a new BlockerType requires only adding the enum member, a new ResolutionStrategy
implementation, and registering it on the ResolutionPlaybook without modifying existing code (OCP).
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, Optional, Type

from app.domain.blocker import PaymentBlocker
from app.domain.client import Client
from app.domain.enums import ActionSource, BlockerType, Priority
from app.domain.invoice import Invoice
from app.domain.next_action import NextAction


@dataclass(frozen=True)
class PlaybookContext:
    blocker: PaymentBlocker
    invoice_number: str
    client_name: str
    company_name: Optional[str]
    today: date


class ResolutionStrategy(ABC):
    """Abstract resolution strategy for a specific blocker type.

    # PATTERN: Strategy — Strategy
    """

    blocker_type: BlockerType

    @abstractmethod
    def plan(self, ctx: PlaybookContext) -> NextAction:
        """Create and return a recommended NextAction for the blocker."""
        ...


class MissingPOResolution(ResolutionStrategy):
    """Resolution strategy for missing purchase orders.

    # PATTERN: Strategy — ConcreteStrategy
    """

    blocker_type = BlockerType.MISSING_PO

    def plan(self, ctx: PlaybookContext) -> NextAction:
        desc = f"Ask {ctx.client_name} to send the missing purchase order for invoice {ctx.invoice_number}"
        return NextAction(
            description=desc,
            priority=Priority.HIGH,
            due_date=ctx.today + timedelta(days=1),
            source=ActionSource.BLOCKER,
            created_at=ctx.blocker.created_at,
            source_ref=ctx.blocker.id,
        )


class ApprovalResolution(ResolutionStrategy):
    """Resolution strategy for invoices awaiting internal client approval.

    # PATTERN: Strategy — ConcreteStrategy
    """

    blocker_type = BlockerType.AWAITING_APPROVAL

    def plan(self, ctx: PlaybookContext) -> NextAction:
        target = ctx.company_name if ctx.company_name else ctx.client_name
        desc = f"Find out who approves invoice {ctx.invoice_number} at {target} and get an approval date"
        return NextAction(
            description=desc,
            priority=Priority.MEDIUM,
            due_date=ctx.today + timedelta(days=2),
            source=ActionSource.BLOCKER,
            created_at=ctx.blocker.created_at,
            source_ref=ctx.blocker.id,
        )


class DisputeResolution(ResolutionStrategy):
    """Resolution strategy for disputed invoice amounts.

    # PATTERN: Strategy — ConcreteStrategy
    """

    blocker_type = BlockerType.DISPUTED_AMOUNT

    def plan(self, ctx: PlaybookContext) -> NextAction:
        desc = (
            f"Schedule a call with {ctx.client_name} to resolve the dispute on "
            f"invoice {ctx.invoice_number}; prepare supporting evidence"
        )
        return NextAction(
            description=desc,
            priority=Priority.CRITICAL,
            due_date=ctx.today + timedelta(days=1),
            source=ActionSource.BLOCKER,
            created_at=ctx.blocker.created_at,
            source_ref=ctx.blocker.id,
        )


class WrongDetailsResolution(ResolutionStrategy):
    """Resolution strategy for invoices with incorrect details.

    # PATTERN: Strategy — ConcreteStrategy
    """

    blocker_type = BlockerType.WRONG_DETAILS

    def plan(self, ctx: PlaybookContext) -> NextAction:
        desc = f"Correct the details on invoice {ctx.invoice_number} and reissue it to {ctx.client_name}"
        return NextAction(
            description=desc,
            priority=Priority.HIGH,
            due_date=ctx.today + timedelta(days=1),
            source=ActionSource.BLOCKER,
            created_at=ctx.blocker.created_at,
            source_ref=ctx.blocker.id,
        )


class MissingDocumentsResolution(ResolutionStrategy):
    """Resolution strategy for missing supporting documentation.

    # PATTERN: Strategy — ConcreteStrategy
    """

    blocker_type = BlockerType.MISSING_DOCUMENTS

    def plan(self, ctx: PlaybookContext) -> NextAction:
        desc = f"Send the missing supporting documents for invoice {ctx.invoice_number} to {ctx.client_name}"
        return NextAction(
            description=desc,
            priority=Priority.MEDIUM,
            due_date=ctx.today + timedelta(days=2),
            source=ActionSource.BLOCKER,
            created_at=ctx.blocker.created_at,
            source_ref=ctx.blocker.id,
        )


class NoResponseResolution(ResolutionStrategy):
    """Resolution strategy when the client is unresponsive.

    # PATTERN: Strategy — ConcreteStrategy
    """

    blocker_type = BlockerType.NO_RESPONSE

    def plan(self, ctx: PlaybookContext) -> NextAction:
        desc = (
            f"Try another channel or contact for {ctx.client_name} and send a "
            f"FIRM reminder for invoice {ctx.invoice_number}"
        )
        return NextAction(
            description=desc,
            priority=Priority.HIGH,
            due_date=ctx.today + timedelta(days=1),
            source=ActionSource.BLOCKER,
            created_at=ctx.blocker.created_at,
            source_ref=ctx.blocker.id,
        )


class OtherResolution(ResolutionStrategy):
    """Fallback resolution strategy for other or unspecified blocker reasons.

    # PATTERN: Strategy — ConcreteStrategy
    """

    blocker_type = BlockerType.OTHER

    def plan(self, ctx: PlaybookContext) -> NextAction:
        desc = f"Review the blocker on invoice {ctx.invoice_number} and decide the next step"
        return NextAction(
            description=desc,
            priority=Priority.LOW,
            due_date=ctx.today + timedelta(days=3),
            source=ActionSource.BLOCKER,
            created_at=ctx.blocker.created_at,
            source_ref=ctx.blocker.id,
        )


class ResolutionPlaybook:
    """Registry and context for blocker resolution strategies.

    # PATTERN: Strategy — Context
    """

    def __init__(self) -> None:
        self._strategies: Dict[BlockerType, ResolutionStrategy] = {}
        # Register default 7 strategies
        self.register(MissingPOResolution())
        self.register(ApprovalResolution())
        self.register(DisputeResolution())
        self.register(WrongDetailsResolution())
        self.register(MissingDocumentsResolution())
        self.register(NoResponseResolution())
        self.register(OtherResolution())

    def register(self, strategy: ResolutionStrategy) -> None:
        """Register or replace a resolution strategy for its blocker type."""
        self._strategies[strategy.blocker_type] = strategy

    def plan_for(
        self,
        blocker: PaymentBlocker,
        invoice: Invoice,
        client: Client,
        today: date,
    ) -> NextAction:
        """Resolve a next action for given blocker, falling back to OtherResolution."""
        ctx = PlaybookContext(
            blocker=blocker,
            invoice_number=invoice.invoice_number,
            client_name=client.name,
            company_name=client.company_name,
            today=today,
        )
        strategy = self._strategies.get(blocker.type)
        if strategy is None:
            strategy = self._strategies.get(BlockerType.OTHER, OtherResolution())
        return strategy.plan(ctx)
