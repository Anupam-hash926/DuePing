"""Reporting and Dashboard API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_facade
from app.api.presenters import report_to_dto
from app.api.schemas import CollectionReportRead
from app.application.facade import CollectionFacade

router = APIRouter(tags=["reports"])


@router.get("/reports/dashboard", response_model=CollectionReportRead)
def get_dashboard(
    facade: CollectionFacade = Depends(get_facade),
) -> CollectionReportRead:
    report = facade.get_dashboard()
    return report_to_dto(report)
