"""System, clock, settings, audit, notifications, and failure monitoring service."""
from __future__ import annotations
from datetime import date
from typing import Callable, Dict, List, Optional

from app.application.daily_check import DailyCheckService, DailyCheckSummary
from app.application.ports import (
    AuditRepository, Clock, FailureLogRepository, HandlerFailure,
    NotificationRepository, SettingsRepository,
)
from app.domain.audit import AuditEvent, Notification


class SystemService:
    """Coordinates system settings, simulated clock, daily batch check, audit logs, and failure logs."""

    def __init__(
        self,
        clock: Clock,
        settings_repo: SettingsRepository,
        audit_repo: AuditRepository,
        notification_repo: NotificationRepository,
        daily_check_service: DailyCheckService,
        failure_log_repo: Optional[FailureLogRepository] = None,
        reset_callable: Optional[Callable[[], None]] = None,
    ) -> None:
        self.clock = clock
        self.settings_repo = settings_repo
        self.audit_repo = audit_repo
        self.notification_repo = notification_repo
        self.daily_check_service = daily_check_service
        self.failure_log_repo = failure_log_repo
        self.reset_callable = reset_callable

    def run_daily_check(self) -> DailyCheckSummary:
        return self.daily_check_service.run()

    def get_today(self) -> Dict[str, object]:
        today = self.clock.today()
        sim_val = self.settings_repo.get("simulated_date")
        is_simulated = bool(sim_val and sim_val.strip())
        return {
            "today": today.isoformat(),
            "simulated": is_simulated,
        }

    def set_simulated_date(self, new_date: Optional[date]) -> None:
        if new_date is None:
            self.settings_repo.set("simulated_date", "")
        else:
            self.settings_repo.set("simulated_date", new_date.isoformat())

    def get_settings(self) -> Dict[str, str]:
        sender = self.settings_repo.get("sender_name", "DuePing User") or "DuePing User"
        curr = self.settings_repo.get("default_currency", "INR") or "INR"
        sim = self.settings_repo.get("simulated_date", "") or ""
        return {
            "sender_name": sender,
            "default_currency": curr,
            "simulated_date": sim,
        }

    def update_settings(
        self,
        sender_name: Optional[str] = None,
        default_currency: Optional[str] = None,
    ) -> Dict[str, str]:
        if sender_name is not None:
            self.settings_repo.set("sender_name", sender_name.strip())
        if default_currency is not None:
            self.settings_repo.set("default_currency", default_currency.strip().upper())
        return self.get_settings()

    def list_audit(
        self,
        invoice_id: Optional[str] = None,
        limit: int = 200,
        offset: int = 0,
    ) -> List[AuditEvent]:
        return self.audit_repo.list(invoice_id=invoice_id, limit=limit, offset=offset)

    def count_audit(self, invoice_id: Optional[str] = None) -> int:
        return self.audit_repo.count(invoice_id=invoice_id)

    def list_notifications(
        self,
        unread_only: bool = False,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Notification]:
        return self.notification_repo.list(unread_only=unread_only, limit=limit, offset=offset)

    def count_notifications(self, unread_only: bool = False) -> int:
        return self.notification_repo.count(unread_only=unread_only)

    def mark_notifications_read(self) -> None:
        self.notification_repo.mark_all_read()

    def list_failures(self, limit: int = 50) -> List[HandlerFailure]:
        if self.failure_log_repo is not None:
            return self.failure_log_repo.list(limit=limit)
        return []

    def reset_demo_data(self) -> None:
        if self.reset_callable is not None:
            self.reset_callable()
