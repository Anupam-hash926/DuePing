# UML Diagram 03 — Design Patterns

### 1. State Pattern (Invoice Lifecycle)

Encapsulates invoice behavior and allowed operations across its lifecycle stages. Note that *Overdue* is a temporal projection (`is_overdue(today)`), not a separate state class.

```mermaid
classDiagram
    class Invoice {
        +InvoiceState _state
        +allowed_operations() set~str~
        +send(sent_at: date)
        +record_payment(payment: Payment, today: date)
        +raise_blocker(type, description, assigned_to)
        +resolve_blocker(blocker_id, resolved_at)
        +write_off(reason, now)
    }

    class InvoiceState {
        <<abstract>>
        +status: InvoiceStatus*
        +allowed_operations(invoice: Invoice)* set~str~
        +send(invoice: Invoice, sent_at: date)
        +record_payment(invoice: Invoice, payment: Payment, today: date)
        +raise_blocker(invoice: Invoice, blocker: PaymentBlocker)
        +resolve_blocker(invoice: Invoice, blocker_id: str, resolved_at: date)
        +write_off(invoice: Invoice, reason: str, written_off_at: date)
    }

    class DraftState { +allowed_operations() set~str~ }
    class SentState { +allowed_operations() set~str~ }
    class PartiallyPaidState { +allowed_operations() set~str~ }
    class DisputedState { +allowed_operations() set~str~ }
    class PaidState { +allowed_operations() set~str~ }
    class WrittenOffState { +allowed_operations() set~str~ }

    InvoiceState <|-- DraftState
    InvoiceState <|-- SentState
    InvoiceState <|-- PartiallyPaidState
    InvoiceState <|-- DisputedState
    InvoiceState <|-- PaidState
    InvoiceState <|-- WrittenOffState

    Invoice --> InvoiceState : _state
```

---

### 2. Strategy Pattern (Action Prioritization)

Allows hot-swapping ranking algorithms for sorting high-priority tasks in the Action Centre.

```mermaid
classDiagram
    class ActionContext {
        +NextAction action
        +Invoice invoice
        +Client client
        +date today
    }

    class PrioritizationStrategy {
        <<abstract>>
        +key: str*
        +label: str*
        +score(ctx: ActionContext)* float
        +explain(ctx: ActionContext)* str
    }

    class AmountFirstStrategy {
        +key: str = "amount_first"
        +label: str = "Largest amount first"
        +score(ctx: ActionContext) float
        +explain(ctx: ActionContext) str
    }

    class OldestFirstStrategy {
        +key: str = "oldest_first"
        +label: str = "Oldest overdue first"
        +score(ctx: ActionContext) float
        +explain(ctx: ActionContext) str
    }

    class RiskWeightedStrategy {
        +key: str = "risk_weighted"
        +label: str = "Risk-weighted"
        +score(ctx: ActionContext) float
        +explain(ctx: ActionContext) str
    }

    class PrioritizationRegistry {
        -dict _strategies
        +register(strategy: PrioritizationStrategy)
        +get(key: str) PrioritizationStrategy
        +list_all() list~PrioritizationStrategy~
    }

    PrioritizationStrategy <|-- AmountFirstStrategy
    PrioritizationStrategy <|-- OldestFirstStrategy
    PrioritizationStrategy <|-- RiskWeightedStrategy
    PrioritizationRegistry o-- PrioritizationStrategy
```

---

### 3. Strategy Pattern (Resolution Playbook)

Maps the root cause of an unpaid invoice (the `PaymentBlocker`) to an optimal next recovery action.

```mermaid
classDiagram
    class PlaybookContext {
        +PaymentBlocker blocker
        +str invoice_number
        +str client_name
        +str company_name
        +date today
    }

    class ResolutionStrategy {
        <<abstract>>
        +blocker_type: BlockerType*
        +plan(ctx: PlaybookContext)* NextAction
    }

    class MissingPOResolution { +plan(ctx: PlaybookContext) NextAction }
    class ApprovalResolution { +plan(ctx: PlaybookContext) NextAction }
    class DisputeResolution { +plan(ctx: PlaybookContext) NextAction }
    class WrongDetailsResolution { +plan(ctx: PlaybookContext) NextAction }
    class MissingDocumentsResolution { +plan(ctx: PlaybookContext) NextAction }
    class NoResponseResolution { +plan(ctx: PlaybookContext) NextAction }
    class OtherResolution { +plan(ctx: PlaybookContext) NextAction }

    class ResolutionPlaybook {
        -dict _strategies
        +register(strategy: ResolutionStrategy)
        +plan_for(blocker, invoice, client, today) NextAction
    }

    ResolutionStrategy <|-- MissingPOResolution
    ResolutionStrategy <|-- ApprovalResolution
    ResolutionStrategy <|-- DisputeResolution
    ResolutionStrategy <|-- WrongDetailsResolution
    ResolutionStrategy <|-- MissingDocumentsResolution
    ResolutionStrategy <|-- NoResponseResolution
    ResolutionStrategy <|-- OtherResolution

    ResolutionPlaybook o-- ResolutionStrategy
```

---

### 4. Template Method + Factory (Adaptive Reminders)

Defines a rigid communication structure with polymorphic variation across tones. `ReminderFactory` acts as a Simple Factory.

```mermaid
classDiagram
    class ReminderContext {
        +str client_name
        +str company_name
        +str invoice_number
        +Money outstanding
        +date due_date
        +int days_overdue
        +date today
        +str sender_name
        +list open_blocker_types
        +date missed_promise_date
    }

    class GeneratedReminder {
        +ReminderTone tone
        +str subject
        +str body
    }

    class ReminderMessage {
        <<abstract>>
        +tone: ReminderTone*
        +response_days: int
        +subject(ctx: ReminderContext)* str
        +greeting(ctx: ReminderContext)* str
        +opening(ctx: ReminderContext)* str
        +blocker_section(ctx: ReminderContext) str
        +promise_section(ctx: ReminderContext) str
        +request(ctx: ReminderContext)* str
        +closing(ctx: ReminderContext)* str
        +render(ctx: ReminderContext) str
    }

    class PoliteReminder {
        +tone: ReminderTone = POLITE
        +subject(ctx: ReminderContext) str
        +greeting(ctx: ReminderContext) str
        +opening(ctx: ReminderContext) str
        +request(ctx: ReminderContext) str
        +closing(ctx: ReminderContext) str
    }

    class FirmReminder {
        +tone: ReminderTone = FIRM
        +subject(ctx: ReminderContext) str
        +greeting(ctx: ReminderContext) str
        +opening(ctx: ReminderContext) str
        +request(ctx: ReminderContext) str
        +closing(ctx: ReminderContext) str
    }

    class FinalNoticeReminder {
        +tone: ReminderTone = FINAL
        +subject(ctx: ReminderContext) str
        +greeting(ctx: ReminderContext) str
        +opening(ctx: ReminderContext) str
        +request(ctx: ReminderContext) str
        +closing(ctx: ReminderContext) str
    }

    class ReminderFactory {
        +create(tone: ReminderTone) ReminderMessage
        +select_tone(days_overdue: int, reminder_level: int) ReminderTone
        +build_context(...) ReminderContext
    }

    ReminderMessage <|-- PoliteReminder
    ReminderMessage <|-- FirmReminder
    ReminderMessage <|-- FinalNoticeReminder
    ReminderFactory ..> ReminderMessage : instantiates
```

---

### 5. Adapter + Chain of Responsibility (CSV Import)

Adapts external raw files into structured domain inputs and pipes each row through an extensible chain of validators.

```mermaid
classDiagram
    class RawInvoiceRow {
        +int row_number
        +dict data
    }

    class InvoiceSource {
        <<interface>>
        +read_rows()* list~RawInvoiceRow~
    }

    class CsvInvoiceSource {
        -str content
        +read_rows() list~RawInvoiceRow~
    }

    class InvoiceSourceFactory {
        +create_csv_source(content: str) InvoiceSource
    }

    class ValidationContext {
        +ClientRepository client_repo
        +InvoiceRepository invoice_repo
        +date today
    }

    class RowValidator {
        <<abstract>>
        -RowValidator _next
        +set_next(validator: RowValidator) RowValidator
        +validate(row: RawInvoiceRow, context: ValidationContext) list~str~
    }

    class RequiredFieldsValidator
    class ClientDataValidator
    class DateValidator
    class AmountValidator
    class StatusValidator
    class DuplicateInvoiceNumberValidator

    class InvoiceImporter {
        -InvoiceSourceFactory source_factory
        -RowValidator validator_chain
        +import_from_csv(csv_content: str, context: ValidationContext) ImportResult
    }

    InvoiceSource <|.. CsvInvoiceSource
    InvoiceSourceFactory ..> CsvInvoiceSource : creates

    RowValidator <|-- RequiredFieldsValidator
    RowValidator <|-- ClientDataValidator
    RowValidator <|-- DateValidator
    RowValidator <|-- AmountValidator
    RowValidator <|-- StatusValidator
    RowValidator <|-- DuplicateInvoiceNumberValidator

    InvoiceImporter o-- InvoiceSource
    InvoiceImporter o-- RowValidator
```

---

### 6. Observer Pattern (Domain Event Bus)

Decouples domain aggregate changes from side effects (audit logging, action generation, reliability updates, and notifications).

```mermaid
classDiagram
    class DomainEvent {
        <<abstract>>
        +str event_id
        +datetime occurred_at
        +describe()* str
    }

    class EventBus {
        -dict _subscribers
        -list _global_subscribers
        -list _queue
        -bool _is_dispatching
        +subscribe(event_type: type, handler: callable)
        +subscribe_all(handler: callable)
        +publish(event: DomainEvent)
        +publish_all(events: list~DomainEvent~)
    }

    class AuditLogListener {
        -AuditRepository audit_repo
        +on_event(event: DomainEvent)
    }

    class ActionGenerationListener {
        -InvoiceRepository invoice_repo
        -ResolutionPlaybook playbook
        +on_blocker_raised(event: BlockerRaised)
        +on_blocker_resolved(event: BlockerResolved)
        +on_promise_missed(event: PromiseMissed)
        +on_invoice_became_overdue(event: InvoiceBecameOverdue)
    }

    class ReliabilityListener {
        -ClientRepository client_repo
        -InvoiceRepository invoice_repo
        +on_payment_received(event: PaymentReceived)
        +on_promise_kept(event: PromiseKept)
        +on_promise_missed(event: PromiseMissed)
    }

    class NotificationListener {
        -NotificationRepository notification_repo
        +on_promise_missed(event: PromiseMissed)
        +on_invoice_became_overdue(event: InvoiceBecameOverdue)
        +on_blocker_raised(event: BlockerRaised)
    }

    EventBus o-- DomainEvent
    EventBus ..> AuditLogListener : notifies
    EventBus ..> ActionGenerationListener : notifies
    EventBus ..> ReliabilityListener : notifies
    EventBus ..> NotificationListener : notifies
```

---

### 7. Facade Pattern

Unifies application operations behind a cohesive, single-point entry for API routers and external clients.

```mermaid
classDiagram
    class CollectionFacade {
        -InvoiceRepository invoice_repo
        -ClientRepository client_repo
        -ProjectRepository project_repo
        -AuditRepository audit_repo
        -NotificationRepository notification_repo
        -SettingsRepository settings_repo
        -Clock clock
        -EventBus event_bus
        -ResolutionPlaybook playbook
        -PrioritizationRegistry registry
        -ReminderFactory reminder_factory
        -InvoiceImporter importer
        -ReportService report_service
        -ActionCenter action_center
        -DailyCheckService daily_check_service
        +create_invoice(...)
        +send_invoice(...)
        +record_payment(...)
        +raise_blocker(...)
        +resolve_blocker(...)
        +record_promise(...)
        +run_daily_check(...)
        +get_action_center(...)
        +get_dashboard(...)
        +import_invoices(...)
    }
```

---

### 8. Repository Pattern

Decouples business domain logic from database engines and storage mechanisms.

```mermaid
classDiagram
    class InvoiceRepository {
        <<interface>>
        +save(invoice: Invoice)*
        +find_by_id(id: str)* Invoice
        +find_by_number(number: str)* Invoice
        +list_all()* list~Invoice~
        +list_active()* list~Invoice~
        +list_by_client(client_id: str)* list~Invoice~
        +next_invoice_sequence(year: int)* int
    }

    class InMemoryInvoiceRepository {
        -dict _invoices
        +save(invoice: Invoice)
        +find_by_id(id: str) Invoice
        +find_by_number(number: str) Invoice
        +list_all() list~Invoice~
        +list_active() list~Invoice~
        +list_by_client(client_id: str) list~Invoice~
        +next_invoice_sequence(year: int) int
    }

    class SqlAlchemyInvoiceRepository {
        -Session session
        +save(invoice: Invoice)
        +find_by_id(id: str) Invoice
        +find_by_number(number: str) Invoice
        +list_all() list~Invoice~
        +list_active() list~Invoice~
        +list_by_client(client_id: str) list~Invoice~
        +next_invoice_sequence(year: int) int
    }

    InvoiceRepository <|.. InMemoryInvoiceRepository
    InvoiceRepository <|.. SqlAlchemyInvoiceRepository
```
