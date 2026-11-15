# UML Diagram 08 — Layered Architecture & Dependency Rule

Strict Clean / Onion Architecture dependency direction:
$$\text{API} \longrightarrow \text{Application} \longrightarrow \text{Domain} \longleftarrow \text{Infrastructure}$$

- **Domain Layer (`backend/app/domain/`)**: Pure Python standard library with zero external dependencies. Defines aggregates, entities, value objects, domain events, domain exceptions, and business rules.
- **Application Layer (`backend/app/application/`)**: Coordinates use cases, domain events, and workflows via ports (interfaces). Depends only on the Domain Layer.
- **Infrastructure Layer (`backend/app/infrastructure/`)**: Implements application ports using SQLAlchemy, SQLite, and in-memory stores. Depends on Application and Domain layers.
- **API Layer (`backend/app/api/`)**: FastAPI routers, Pydantic DTOs, HTTP presenters, and error handlers. Depends on Application and Domain layers.
- **Composition Root (`backend/app/api/deps.py`)**: Wires infrastructure implementations into the `CollectionFacade` singleton during application startup.

```mermaid
flowchart TD
    subgraph APILayer["API Layer (backend/app/api)"]
        Routers["FastAPI Routers\n(invoices, clients, actions,\nreports, importing, system)"]
        Schemas["Pydantic Schemas (DTOs)"]
        Presenters["Presenters (Pure DTO mappers)"]
        Errors["Error Mappings (404, 409, 422)"]
    end

    subgraph CompositionRoot["Composition Root (backend/app/api/deps.py)"]
        Wiring["Container & Facade Factory\n(Wires ports to adapters)"]
    end

    subgraph AppLayer["Application Layer (backend/app/application)"]
        Facade["CollectionFacade"]
        AppServices["Application Services\n(ActionCenter, DailyCheckService,\nReportService, InvoiceImporter)"]
        Patterns["Pattern Implementations\n(ResolutionPlaybook, PrioritizationRegistry,\nReminderFactory, InvoiceFactory)"]
        EventBusModule["EventBus & Listeners\n(AuditLog, ActionGeneration,\nReliability, Notification)"]
        Ports["Ports / Interfaces\n(InvoiceRepository, ClientRepository,\nProjectRepository, AuditRepository,\nNotificationRepository, SettingsRepository, Clock)"]
    end

    subgraph DomainLayer["Domain Layer (backend/app/domain) [Zero External Deps]"]
        Aggregates["Aggregate Root: Invoice"]
        Entities["Entities: Client, Project, Payment,\nPaymentBlocker, PaymentPromise,\nFollowUp, SupportingDocument, NextAction"]
        VO["Value Object: Money"]
        State["State Pattern: InvoiceState & Concrete States"]
        Events["Domain Events (InvoiceSent, PaymentReceived...)"]
        Enums["Domain Enums (InvoiceStatus, BlockerType...)"]
    end

    subgraph InfraLayer["Infrastructure Layer (backend/app/infrastructure)"]
        SQLAlchemyRepos["SQLAlchemy Repositories\n(SqlAlchemyInvoiceRepository, ...)"]
        InMemoryRepos["In-Memory Repositories\n(InMemoryInvoiceRepository, ...)"]
        ORM["SQLAlchemy ORM Models\n(InvoiceModel, ClientModel, ...)"]
        Mappers["Mappers (Domain ↔ ORM)"]
        DB["SQLite Database Engine"]
        Seed["Demo Seed Script"]
    end

    APILayer --> AppLayer
    APILayer --> DomainLayer
    CompositionRoot --> APILayer
    CompositionRoot --> InfraLayer
    CompositionRoot --> AppLayer
    InfraLayer --> Ports
    InfraLayer --> DomainLayer
    AppLayer --> DomainLayer
```
