"""Reminder generation with blocker and missed-promise context.

# PATTERNS: Template Method (ReminderMessage) + Simple Factory / Factory Method (ReminderFactory)
Templates produce blocker-aware follow-up messages across 3 progressive tones.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, timedelta

from app.domain.client import Client
from app.domain.enums import BlockerType, PromiseStatus, ReminderTone
from app.domain.invoice import Invoice
from app.domain.money import Money

BLOCKER_LINES: dict[BlockerType, str] = {
    BlockerType.MISSING_PO: (
        "I understand the purchase order for this invoice is still pending. "
        "Could you share it so the payment can be released?"
    ),
    BlockerType.AWAITING_APPROVAL: (
        "I understand the invoice is still awaiting internal approval. "
        "Could you tell me who is approving it and by when?"
    ),
    BlockerType.DISPUTED_AMOUNT: (
        "I'm aware there is a question about the invoiced amount. "
        "I'm happy to walk through the details on a quick call to settle it."
    ),
    BlockerType.WRONG_DETAILS: (
        "I understand some details on the invoice need correcting. "
        "Please tell me what to change and I'll reissue it right away."
    ),
    BlockerType.MISSING_DOCUMENTS: (
        "I understand some supporting documents are still missing. "
        "Please tell me which ones and I'll send them right away."
    ),
    BlockerType.NO_RESPONSE: (
        "I haven't been able to reach the right person yet. "
        "Could you point me to the right contact for payments?"
    ),
    BlockerType.OTHER: (
        "Please let me know if anything is holding up this payment."
    ),
}


@dataclass(frozen=True)
class ReminderContext:
    client_name: str
    company_name: str | None
    invoice_number: str
    outstanding: Money
    due_date: date
    days_overdue: int
    today: date
    sender_name: str
    open_blocker_types: list[BlockerType]
    missed_promise_date: date | None


@dataclass(frozen=True)
class GeneratedReminder:
    tone: ReminderTone
    subject: str
    body: str


class ReminderMessage(ABC):
    """Abstract base class using the Template Method pattern to render reminders.

    # PATTERN: Template Method — AbstractClass
    """

    tone: ReminderTone
    response_days: int

    @abstractmethod
    def subject(self, ctx: ReminderContext) -> str: ...

    @abstractmethod
    def greeting(self, ctx: ReminderContext) -> str: ...

    @abstractmethod
    def opening(self, ctx: ReminderContext) -> str: ...

    @abstractmethod
    def request(self, ctx: ReminderContext) -> str: ...

    @abstractmethod
    def closing(self, ctx: ReminderContext) -> str: ...

    # ── Template Method ───────────────────────────────────────────────────────

    def render(self, ctx: ReminderContext) -> str:
        """Template method defining the skeleton of reminder message generation.

        Do NOT override in subclasses.
        """
        parts = [
            self.greeting(ctx),
            self.opening(ctx),
            self.blocker_section(ctx),
            self.promise_section(ctx),
            self.request(ctx),
            self.closing(ctx),
        ]
        non_empty = [p.strip() for p in parts if p and p.strip()]
        return "\n\n".join(non_empty)

    # ── Shared steps implemented in base ──────────────────────────────────────

    def blocker_section(self, ctx: ReminderContext) -> str:
        """Up to first two open blockers, one sentence each."""
        lines = []
        for b_type in ctx.open_blocker_types[:2]:
            line = BLOCKER_LINES.get(b_type)
            if line:
                lines.append(line)
        return " ".join(lines)

    def promise_section(self, ctx: ReminderContext) -> str:
        """Mention missed promise date if applicable."""
        if ctx.missed_promise_date:
            d = ctx.missed_promise_date.strftime("%d %b %Y")
            return f"You had mentioned that payment would arrive by {d}. Could you confirm a revised date?"
        return ""

    def first_name(self, ctx: ReminderContext) -> str:
        return ctx.client_name.strip().split()[0] if ctx.client_name else "there"

    def due_clause(self, ctx: ReminderContext) -> str:
        if ctx.days_overdue > 0:
            return f"was due on {ctx.due_date.strftime('%d %b %Y')} and is now {ctx.days_overdue} day(s) overdue"
        return f"is due on {ctx.due_date.strftime('%d %b %Y')}"

    def reply_by(self, ctx: ReminderContext) -> date:
        return ctx.today + timedelta(days=self.response_days)


class PoliteReminder(ReminderMessage):
    """Polite reminder for current or newly overdue invoices.

    # PATTERN: Template Method — ConcreteClass
    """

    tone = ReminderTone.POLITE
    response_days = 5

    def subject(self, ctx: ReminderContext) -> str:
        return f"Friendly reminder: invoice {ctx.invoice_number}"

    def greeting(self, ctx: ReminderContext) -> str:
        return f"Hi {self.first_name(ctx)},"

    def opening(self, ctx: ReminderContext) -> str:
        return (
            f"I hope you're doing well. This is a friendly reminder that invoice "
            f"{ctx.invoice_number} for {ctx.outstanding.format()} {self.due_clause(ctx)}."
        )

    def request(self, ctx: ReminderContext) -> str:
        return "Please let me know if you need anything from my side to process the payment."

    def closing(self, ctx: ReminderContext) -> str:
        return f"Thanks,\n{ctx.sender_name}"


class FirmReminder(ReminderMessage):
    """Firm reminder for moderately overdue invoices or unfulfilled promises.

    # PATTERN: Template Method — ConcreteClass
    """

    tone = ReminderTone.FIRM
    response_days = 2

    def subject(self, ctx: ReminderContext) -> str:
        return f"Payment overdue: invoice {ctx.invoice_number}"

    def greeting(self, ctx: ReminderContext) -> str:
        return f"Dear {ctx.client_name},"

    def opening(self, ctx: ReminderContext) -> str:
        return (
            f"Invoice {ctx.invoice_number} for {ctx.outstanding.format()} was due on "
            f"{ctx.due_date.strftime('%d %b %Y')} and is now {ctx.days_overdue} days overdue."
        )

    def request(self, ctx: ReminderContext) -> str:
        r_date = self.reply_by(ctx).strftime("%d %b %Y")
        return f"Please confirm a payment date by {r_date}."

    def closing(self, ctx: ReminderContext) -> str:
        return f"Regards,\n{ctx.sender_name}"


class FinalNoticeReminder(ReminderMessage):
    """Final notice for seriously delinquent invoices.

    # PATTERN: Template Method — ConcreteClass
    """

    tone = ReminderTone.FINAL
    response_days = 3

    def subject(self, ctx: ReminderContext) -> str:
        return f"Final notice: invoice {ctx.invoice_number}"

    def greeting(self, ctx: ReminderContext) -> str:
        return f"Dear {ctx.client_name},"

    def opening(self, ctx: ReminderContext) -> str:
        return (
            f"This is a final reminder regarding invoice {ctx.invoice_number} for "
            f"{ctx.outstanding.format()}, which is {ctx.days_overdue} days overdue."
        )

    def request(self, ctx: ReminderContext) -> str:
        r_date = self.reply_by(ctx).strftime("%d %b %Y")
        return (
            f"If payment, or a confirmed payment date, is not received by {r_date}, "
            f"I will have to pause further work and escalate this for recovery."
        )

    def closing(self, ctx: ReminderContext) -> str:
        return f"Regards,\n{ctx.sender_name}"


class ReminderFactory:
    """Factory for selecting tones and generating rendered reminder messages.

    # PATTERN: Simple Factory / Factory Method
    """

    def create(self, tone: ReminderTone) -> ReminderMessage:
        if tone == ReminderTone.POLITE:
            return PoliteReminder()
        elif tone == ReminderTone.FIRM:
            return FirmReminder()
        elif tone == ReminderTone.FINAL:
            return FinalNoticeReminder()
        raise ValueError(f"Unknown tone: {tone}")

    def tone_for(self, invoice: Invoice, today: date) -> ReminderTone:
        """Determine tone as more severe of: days overdue vs reminder_level."""
        if not invoice.is_overdue(today):
            return ReminderTone.POLITE

        days = invoice.days_overdue(today)
        if days <= 7:
            days_tone = ReminderTone.POLITE
        elif days <= 21:
            days_tone = ReminderTone.FIRM
        else:
            days_tone = ReminderTone.FINAL

        level = invoice.reminder_level
        if level == 0:
            level_tone = ReminderTone.POLITE
        elif level == 1:
            level_tone = ReminderTone.FIRM
        else:
            level_tone = ReminderTone.FINAL

        order = {ReminderTone.POLITE: 1, ReminderTone.FIRM: 2, ReminderTone.FINAL: 3}
        if order[days_tone] >= order[level_tone]:
            return days_tone
        return level_tone

    def build_context(
        self,
        invoice: Invoice,
        client: Client,
        sender_name: str,
        today: date,
    ) -> ReminderContext:
        """Assemble ReminderContext from invoice and client data."""
        # Open blockers sorted oldest first
        open_blockers = sorted(invoice.open_blockers(), key=lambda b: b.created_at)
        open_types = [b.type for b in open_blockers]

        # Most recent missed promise if any
        missed_promises = [
            p for p in invoice.promises if p.status == PromiseStatus.MISSED
        ]
        most_recent_missed = None
        if missed_promises:
            most_recent_missed = max(missed_promises, key=lambda p: p.created_at).promised_date

        return ReminderContext(
            client_name=client.name,
            company_name=client.company_name,
            invoice_number=invoice.invoice_number,
            outstanding=invoice.outstanding(),
            due_date=invoice.due_date,
            days_overdue=invoice.days_overdue(today),
            today=today,
            sender_name=sender_name,
            open_blocker_types=open_types,
            missed_promise_date=most_recent_missed,
        )

    def generate(
        self,
        invoice: Invoice,
        client: Client,
        sender_name: str,
        today: date,
        tone: ReminderTone | None = None,
    ) -> GeneratedReminder:
        """Generate a complete subject + body reminder."""
        effective_tone = tone if tone is not None else self.tone_for(invoice, today)
        msg_template = self.create(effective_tone)
        ctx = self.build_context(invoice, client, sender_name, today)
        subject = msg_template.subject(ctx)
        body = msg_template.render(ctx)
        return GeneratedReminder(tone=effective_tone, subject=subject, body=body)
