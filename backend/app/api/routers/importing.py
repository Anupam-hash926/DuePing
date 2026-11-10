"""Invoice import API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_facade
from app.api.presenters import import_result_to_dto
from app.api.schemas import ImportRequest, ImportResultRead
from app.application.facade import CollectionFacade

router = APIRouter(tags=["importing"])


@router.post("/import/invoices", response_model=ImportResultRead)
def import_invoices(
    body: ImportRequest,
    facade: CollectionFacade = Depends(get_facade),
) -> ImportResultRead:
    res = facade.import_invoices(format=body.format, content=body.content)
    return import_result_to_dto(res)
