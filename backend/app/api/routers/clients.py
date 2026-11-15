"""Client and Project API endpoints."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_facade
from app.api.presenters import (
    client_summary_to_dto,
    client_to_dto,
    invoice_to_summary_dto,
    project_to_dto,
)
from app.api.schemas import (
    ClientCreate,
    ClientRead,
    ClientSummaryRead,
    ClientUpdate,
    ProjectCreate,
    ProjectRead,
)
from app.application.facade import CollectionFacade

router = APIRouter(tags=["clients"])


@router.get("/clients", response_model=List[ClientRead])
def list_clients(facade: CollectionFacade = Depends(get_facade)) -> List[ClientRead]:
    clients = facade.list_clients()
    return [client_to_dto(c) for c in clients]


@router.post("/clients", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
def create_client(
    body: ClientCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> ClientRead:
    client = facade.create_client(
        name=body.name,
        email=body.email,
        phone=body.phone,
        company_name=body.company_name,
    )
    return client_to_dto(client)


@router.get("/clients/{id}", response_model=ClientSummaryRead)
def get_client_summary(
    id: str,
    facade: CollectionFacade = Depends(get_facade),
) -> ClientSummaryRead:
    client, total_out, invoices = facade.get_client_summary(id)
    today = facade.clock.today()

    # Pre-cache projects
    projects = {p.id: p for p in facade.list_projects(client_id=id)}
    invoice_dtos = [
        invoice_to_summary_dto(
            invoice=inv,
            client=client,
            project=projects.get(inv.project_id) if inv.project_id else None,
            today=today,
        )
        for inv in invoices
    ]
    return client_summary_to_dto(client, total_out, invoice_dtos)


@router.put("/clients/{id}", response_model=ClientRead)
def update_client(
    id: str,
    body: ClientUpdate,
    facade: CollectionFacade = Depends(get_facade),
) -> ClientRead:
    client = facade.update_client(
        id=id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        company_name=body.company_name,
    )
    return client_to_dto(client)


@router.get("/projects", response_model=List[ProjectRead])
def list_projects(
    client_id: Optional[str] = Query(None),
    facade: CollectionFacade = Depends(get_facade),
) -> List[ProjectRead]:
    projects = facade.list_projects(client_id=client_id)
    return [project_to_dto(p) for p in projects]


@router.post("/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate,
    facade: CollectionFacade = Depends(get_facade),
) -> ProjectRead:
    project = facade.create_project(
        client_id=body.client_id,
        project_name=body.project_name,
        description=body.description or "",
        start_date=body.start_date,
    )
    return project_to_dto(project)
