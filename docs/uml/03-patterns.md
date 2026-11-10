# UML Diagram 03 — Design Patterns

## Pattern 1: State (Invoice Lifecycle)

```mermaid
classDiagram
    class InvoiceState {
        <<abstract>>
        +label() str
        +can_issue() bool
        +can_record_payment() bool
        +can_flag_overdue() bool
        +can_write_off() bool
        +can_dispute() bool
    }

    class DraftState { +label() str }
    class IssuedState { +label() str }
    class PartialState { +label() str }
    class OverdueState { +label() str }
    class PaidState { +label() str }
    class WrittenOffState { +label() str }
    class DisputedState { +label() str }

    class Invoice {
        -InvoiceState _state
        +issue() void
        +record_payment() void
        +flag_overdue() void
    }

    InvoiceState <|-- DraftState
    InvoiceState <|-- IssuedState
    InvoiceState <|-- PartialState
    InvoiceState <|-- OverdueState
    InvoiceState <|-- PaidState
    InvoiceState <|-- WrittenOffState
    InvoiceState <|-- DisputedState
    Invoice --> InvoiceState : delegates to
```

---

## Pattern 2: Strategy — Prioritization

```mermaid
classDiagram
    class PrioritizationStrategy {
        <<abstract>>
        +score(invoice) int
    }

    class OverdueFirstStrategy {
        +score(invoice) int
    }

    class AmountDescStrategy {
        +score(invoice) int
    }

    class BrokenPromiseStrategy {
        +score(invoice) int
    }

    class CompositePrioritizationStrategy {
        -List~PrioritizationStrategy~ strategies
        +score(invoice) int
    }

    class ActionCenterService {
        -PrioritizationStrategy strategy
        +get_actions() List
    }

    PrioritizationStrategy <|-- OverdueFirstStrategy
    PrioritizationStrategy <|-- AmountDescStrategy
    PrioritizationStrategy <|-- BrokenPromiseStrategy
    PrioritizationStrategy <|-- CompositePrioritizationStrategy
    CompositePrioritizationStrategy o-- PrioritizationStrategy
    ActionCenterService --> PrioritizationStrategy : uses
```

---

## Pattern 3: Strategy — Resolution Playbook

```mermaid
classDiagram
    class ResolutionStrategy {
        <<abstract>>
        +plan(blocker, invoice) List~NextAction~
    }

    class DisputeResolutionStrategy {
        +plan(blocker, invoice) List~NextAction~
    }

    class AwaitingPOResolutionStrategy {
        +plan(blocker, invoice) List~NextAction~
    }

    class BudgetFreezeResolutionStrategy {
        +plan(blocker, invoice) List~NextAction~
    }

    class WrongDetailsResolutionStrategy {
        +plan(blocker, invoice) List~NextAction~
    }

    class DefaultResolutionStrategy {
        +plan(blocker, invoice) List~NextAction~
    }

    class ResolutionPlaybook {
        -Dict strategies
        +plan_for(blocker, invoice) List~NextAction~
    }

    ResolutionStrategy <|-- DisputeResolutionStrategy
    ResolutionStrategy <|-- AwaitingPOResolutionStrategy
    ResolutionStrategy <|-- BudgetFreezeResolutionStrategy
    ResolutionStrategy <|-- WrongDetailsResolutionStrategy
    ResolutionStrategy <|-- DefaultResolutionStrategy
    ResolutionPlaybook --> ResolutionStrategy : selects & delegates
```

---

## Pattern 4: Template Method + Factory (Reminders)

```mermaid
classDiagram
    class ReminderTemplate {
        <<abstract>>
        +send_reminder(invoice) void
        +compose_message(invoice) str*
        +select_channel(invoice) str*
        +dispatch(invoice, channel, msg) void
        +post_send_hook(invoice) void
    }

    class PoliteFirstReminderTemplate {
        +compose_message(invoice) str
        +select_channel(invoice) str
    }

    class FirmSecondReminderTemplate {
        +compose_message(invoice) str
        +select_channel(invoice) str
    }

    class FinalNoticeReminderTemplate {
        +compose_message(invoice) str
        +select_channel(invoice) str
    }

    class ReminderFactory {
        +for_invoice(invoice) ReminderTemplate
    }

    ReminderTemplate <|-- PoliteFirstReminderTemplate
    ReminderTemplate <|-- FirmSecondReminderTemplate
    ReminderTemplate <|-- FinalNoticeReminderTemplate
    ReminderFactory ..> ReminderTemplate : creates
```

---

## Pattern 5: Adapter + Chain of Responsibility (Import)

```mermaid
classDiagram
    class ImportAdapter {
        <<abstract>>
        +can_handle(format: str) bool
        +parse(raw_data: bytes) List~dict~
    }

    class CsvImportAdapter {
        +can_handle(format: str) bool
        +parse(raw_data: bytes) List~dict~
    }

    class JsonImportAdapter {
        +can_handle(format: str) bool
        +parse(raw_data: bytes) List~dict~
    }

    class ImportChain {
        -List~ImportAdapter~ adapters
        +handle(raw_data, format_hint) List~dict~
    }

    ImportAdapter <|-- CsvImportAdapter
    ImportAdapter <|-- JsonImportAdapter
    ImportChain o-- ImportAdapter : chain of
```

---

## Pattern 6: Observer (EventBus + Listeners)

```mermaid
classDiagram
    class EventBus {
        -Dict listeners
        +subscribe(event_type, handler) void
        +publish(event) void
        +publish_all(events) void
    }

    class DomainEvent {
        <<abstract>>
    }

    class on_invoice_issued {
        <<listener>>
        +handle(event: InvoiceIssued) void
    }

    class on_blocker_raised {
        <<listener>>
        +handle(event: BlockerRaised) void
    }

    class on_promise_broken {
        <<listener>>
        +handle(event: PromiseBroken) void
    }

    class on_invoice_overdue {
        <<listener>>
        +handle(event: InvoiceOverdue) void
    }

    EventBus --> DomainEvent : publishes
    EventBus --> on_invoice_issued : notifies
    EventBus --> on_blocker_raised : notifies
    EventBus --> on_promise_broken : notifies
    EventBus --> on_invoice_overdue : notifies
```

---

## Pattern 7: Facade (CollectionFacade)

```mermaid
classDiagram
    class CollectionFacade {
        +create_client(data) Client
        +get_invoice(id) Invoice
        +issue_invoice(id) void
        +record_payment(id, amount) void
        +raise_blocker(id, kind, desc) void
        +log_promise(id, date) void
        +get_action_center() List
        +run_daily_check() dict
        +aging_report() dict
        +import_data(raw, format) dict
    }

    class ClientRepository
    class InvoiceRepository
    class ActionCenterService
    class DailyCheckService
    class ReportsService
    class ImportChain
    class EventBus
    class InvoiceFactory

    CollectionFacade --> ClientRepository
    CollectionFacade --> InvoiceRepository
    CollectionFacade --> ActionCenterService
    CollectionFacade --> DailyCheckService
    CollectionFacade --> ReportsService
    CollectionFacade --> ImportChain
    CollectionFacade --> EventBus
    CollectionFacade --> InvoiceFactory
```

---

## Pattern 8: Repository (Ports + Adapters)

```mermaid
classDiagram
    class InvoiceRepository {
        <<abstract>>
        +get(id: UUID) Invoice
        +save(invoice: Invoice) void
        +list_all() List~Invoice~
    }

    class ClientRepository {
        <<abstract>>
        +get(id: UUID) Client
        +save(client: Client) void
        +list_all() List~Client~
    }

    class SqlAlchemyInvoiceRepository {
        -Session session
        +get(id: UUID) Invoice
        +save(invoice: Invoice) void
        +list_all() List~Invoice~
    }

    class InMemoryInvoiceRepository {
        -Dict store
        +get(id: UUID) Invoice
        +save(invoice: Invoice) void
        +list_all() List~Invoice~
    }

    class SqlAlchemyClientRepository {
        -Session session
        +get(id: UUID) Client
        +save(client: Client) void
        +list_all() List~Client~
    }

    class InMemoryClientRepository {
        -Dict store
        +get(id: UUID) Client
        +save(client: Client) void
        +list_all() List~Client~
    }

    InvoiceRepository <|-- SqlAlchemyInvoiceRepository
    InvoiceRepository <|-- InMemoryInvoiceRepository
    ClientRepository <|-- SqlAlchemyClientRepository
    ClientRepository <|-- InMemoryClientRepository
```
