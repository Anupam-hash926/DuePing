"""System, clock, audit, notifications, settings, and reset API endpoints."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_facade
from app.api.presenters import audit_event_to_dto, notification_to_dto
from app.api.schemas import (
    AuditEventRead,
    DailyCheckSummaryRead,
    NotificationRead,
    SettingsRead,
    SettingsUpdate,
    SimulatedDateRead,
    SimulatedDateUpdate,
    SuccessResponse,
)
from app.application.facade import CollectionFacade

router = APIRouter(tags=["system"])


@router.post("/system/daily-check", response_model=DailyCheckSummaryRead)
def run_daily_check(
    facade: CollectionFacade = Depends(get_facade),
) -> DailyCheckSummaryRead:
    summary = facade.run_daily_check()
    return DailyCheckSummaryRead(
        date=summary.date,
        invoices_checked=summary.invoices_checked,
        promises_missed=summary.promises_missed,
        newly_overdue=summary.newly_overdue,
    )


@router.get("/system/today", response_model=SimulatedDateRead)
def get_today(
    facade: CollectionFacade = Depends(get_facade),
) -> SimulatedDateRead:
    info = facade.get_today()
    return SimulatedDateRead(
        today=info["today"],  # type: ignore[arg-type]
        simulated=bool(info["simulated"]),
    )


@router.put("/system/today", response_model=SimulatedDateRead)
def update_today(
    body: SimulatedDateUpdate,
    facade: CollectionFacade = Depends(get_facade),
) -> SimulatedDateRead:
    facade.set_simulated_date(body.date)
    info = facade.get_today()
    return SimulatedDateRead(
        today=info["today"],  # type: ignore[arg-type]
        simulated=bool(info["simulated"]),
    )


@router.get("/system/settings", response_model=SettingsRead)
def get_settings(
    facade: CollectionFacade = Depends(get_facade),
) -> SettingsRead:
    settings = facade.get_settings()
    return SettingsRead(
        sender_name=settings.get("sender_name", ""),
        default_currency=settings.get("default_currency", "INR"),
    )


@router.put("/system/settings", response_model=SettingsRead)
def update_settings(
    body: SettingsUpdate,
    facade: CollectionFacade = Depends(get_facade),
) -> SettingsRead:
    settings = facade.update_settings(
        sender_name=body.sender_name,
        default_currency=body.default_currency,
    )
    return SettingsRead(
        sender_name=settings.get("sender_name", ""),
        default_currency=settings.get("default_currency", "INR"),
    )


@router.get("/audit-log", response_model=List[AuditEventRead])
def list_audit(
    invoice_id: Optional[str] = Query(None),
    facade: CollectionFacade = Depends(get_facade),
) -> List[AuditEventRead]:
    events = facade.list_audit(invoice_id=invoice_id)
    return [audit_event_to_dto(ev) for ev in events]


@router.get("/notifications", response_model=List[NotificationRead])
def list_notifications(
    unread: bool = Query(False),
    facade: CollectionFacade = Depends(get_facade),
) -> List[NotificationRead]:
    notifications = facade.list_notifications(unread_only=unread)
    return [notification_to_dto(n) for n in notifications]


@router.post("/notifications/read", response_model=SuccessResponse)
def mark_notifications_read(
    facade: CollectionFacade = Depends(get_facade),
) -> SuccessResponse:
    facade.mark_notifications_read()
    return SuccessResponse(ok=True)


import os

if os.getenv("DUEPING_ENABLE_RESET", "0").lower() in ("1", "true"):
    @router.post("/system/reset-demo", response_model=SuccessResponse)
    def reset_demo(
        facade: CollectionFacade = Depends(get_facade),
    ) -> SuccessResponse:
        facade.reset_demo_data()
        return SuccessResponse(ok=True)
