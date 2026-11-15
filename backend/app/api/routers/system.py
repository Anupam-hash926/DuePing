"""System, clock, audit, notifications, settings, and reset API endpoints."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import get_facade
from app.api.presenters import audit_event_to_dto, notification_to_dto
from app.api.schemas import (
    AuditEventRead,
    DailyCheckSummaryRead,
    HandlerFailureRead,
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
    response: Response,
    invoice_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    facade: CollectionFacade = Depends(get_facade),
) -> List[AuditEventRead]:
    total = facade.count_audit(invoice_id=invoice_id)
    response.headers["X-Total-Count"] = str(total)
    events = facade.list_audit(invoice_id=invoice_id, limit=limit, offset=offset)
    return [audit_event_to_dto(ev) for ev in events]


@router.get("/notifications", response_model=List[NotificationRead])
def list_notifications(
    response: Response,
    unread: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    facade: CollectionFacade = Depends(get_facade),
) -> List[NotificationRead]:
    total = facade.count_notifications(unread_only=unread)
    response.headers["X-Total-Count"] = str(total)
    notifications = facade.list_notifications(unread_only=unread, limit=limit, offset=offset)
    return [notification_to_dto(n) for n in notifications]


@router.get("/system/failures", response_model=List[HandlerFailureRead])
def list_failures(
    limit: int = Query(50, ge=1, le=500),
    facade: CollectionFacade = Depends(get_facade),
) -> List[HandlerFailureRead]:
    failures = facade.list_failures(limit=limit)
    return [
        HandlerFailureRead(
            id=f.id,
            occurred_at=f.occurred_at,
            event_type=f.event_type,
            handler=f.handler,
            error=f.error,
        )
        for f in failures
    ]


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
