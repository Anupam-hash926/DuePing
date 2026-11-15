"""Client and Project application service."""
from __future__ import annotations

from datetime import date

from app.application.ports import ClientRepository, Clock, InvoiceRepository, ProjectRepository
from app.domain.client import Client
from app.domain.exceptions import DuplicateClient
from app.domain.invoice import Invoice
from app.domain.money import Money
from app.domain.project import Project


class ClientService:
    """Manages client profiles, reliability scoring summaries, and project groupings."""

    def __init__(
        self,
        client_repo: ClientRepository,
        project_repo: ProjectRepository,
        invoice_repo: InvoiceRepository,
        clock: Clock,
    ) -> None:
        self.client_repo = client_repo
        self.project_repo = project_repo
        self.invoice_repo = invoice_repo
        self.clock = clock

    def create_client(
        self,
        name: str,
        email: str,
        phone: str | None = None,
        company_name: str | None = None,
    ) -> Client:
        norm_email = email.strip().lower()
        if self.client_repo.find_by_email(norm_email) is not None:
            raise DuplicateClient(f"Client with email {norm_email} already exists")

        client = Client(
            name=name,
            email=norm_email,
            phone=phone,
            company_name=company_name,
            created_at=self.clock.now(),
        )
        self.client_repo.save(client)
        return client

    def update_client(
        self,
        id: str,
        name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        company_name: str | None = None,
    ) -> Client:
        client = self.client_repo.get(id)
        if email is not None:
            norm_email = email.strip().lower()
            existing = self.client_repo.find_by_email(norm_email)
            if existing is not None and existing.id != id:
                raise DuplicateClient(f"Client with email {norm_email} already exists")
        client.update_contact_details(name=name, email=email, phone=phone, company_name=company_name)
        self.client_repo.save(client)
        return client

    def get_client(self, id: str) -> Client:
        return self.client_repo.get(id)

    def list_clients(self) -> list[Client]:
        return self.client_repo.list_all()

    def get_client_summary(self, id: str) -> tuple[Client, Money, list[Invoice]]:
        client = self.client_repo.get(id)
        invoices = self.invoice_repo.list_by_client(id)
        outstanding = client.outstanding_balance(invoices)
        return client, outstanding, invoices

    def create_project(
        self,
        client_id: str,
        project_name: str,
        description: str = "",
        start_date: date | None = None,
    ) -> Project:
        self.client_repo.get(client_id)  # verify existence
        s_date = start_date or self.clock.today()
        proj = Project(
            client_id=client_id,
            project_name=project_name,
            start_date=s_date,
            description=description,
        )
        self.project_repo.save(proj)
        return proj

    def get_project(self, id: str) -> Project:
        return self.project_repo.get(id)

    def list_projects(self, client_id: str | None = None) -> list[Project]:
        if client_id is not None:
            return self.project_repo.list_by_client(client_id)
        return self.project_repo.list_all()

    def update_project_status(self, id: str, status: str) -> Project:
        proj = self.project_repo.get(id)
        proj.update_status(status)
        self.project_repo.save(proj)
        return proj
