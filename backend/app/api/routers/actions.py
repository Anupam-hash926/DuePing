"""Action Centre API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_facade
from app.api.presenters import action_center_to_dto
from app.api.schemas import ActionCenterRead
from app.application.facade import CollectionFacade

router = APIRouter(tags=["action-center"])


@router.get("/action-center", response_model=ActionCenterRead)
def get_action_center(
    strategy: str | None = Query(None),
    facade: CollectionFacade = Depends(get_facade),
) -> ActionCenterRead:
    view = facade.get_action_center(strategy_key=strategy)
    strategies = facade.list_strategies()
    return action_center_to_dto(view, strategies)
