"""Reminder generation application service."""
from __future__ import annotations
from typing import Optional

from app.application.ports import ClientRepository, Clock, InvoiceRepository, SettingsRepository
from app.application.reminders import GeneratedReminder, ReminderFactory
from app.domain.enums import ReminderTone


class ReminderService:
    """Selects escalation tones and generates templated reminder drafts."""

    def __init__(
        self,
        reminder_factory: ReminderFactory,
        invoice_repo: InvoiceRepository,
        client_repo: ClientRepository,
        settings_repo: SettingsRepository,
        clock: Clock,
    ) -> None:
        self.reminder_factory = reminder_factory
        self.invoice_repo = invoice_repo
        self.client_repo = client_repo
        self.settings_repo = settings_repo
        self.clock = clock

    def generate_reminder(
        self, invoice_id: str, tone: Optional[ReminderTone] = None
    ) -> GeneratedReminder:
        today = self.clock.today()
        invoice = self.invoice_repo.get(invoice_id)
        client = self.client_repo.get(invoice.client_id)
        sender_name = self.settings_repo.get("sender_name", "DuePing User") or "DuePing User"
        return self.reminder_factory.generate(invoice, client, sender_name, today, tone=tone)
