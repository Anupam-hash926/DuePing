# UML Diagram 02 — Domain Class Diagram

```mermaid
classDiagram
    class Money {
        +Decimal amount
        +str currency
        +__add__(other: Money) Money
        +__sub__(other: Money) Money
        +__eq__(other: Money) bool
        +__lt__(other: Money) bool
        +is_zero() bool
    }

    class InvoiceStatus {
        <<enumeration>>
        DRAFT
        ISSUED
        PARTIAL
        OVERDUE
        PAID
        WRITTEN_OFF
        DISPUTED
    }

    class FollowUpChannel {
        <<enumeration>>
        EMAIL
        PHONE
        MEETING
        LETTER
    }

    class BlockerKind {
        <<enumeration>>
        DISPUTE
        AWAITING_PO
        BUDGET_FREEZE
        WRONG_DETAILS
        OTHER
    }

    class ActionKind {
        <<enumeration>>
        SEND_REMINDER
        ESCALATE
        CALL_CLIENT
        SEND_STATEMENT
        LEGAL_NOTICE
        WRITE_OFF
        RESOLVE_BLOCKER
    }

    class ImportFormat {
        <<enumeration>>
        CSV
        JSON
    }

    class Client {
        +UUID id
        +str name
        +str email
        +str phone
        +str notes
    }

    class Project {
        +UUID id
        +UUID client_id
        +str name
        +str description
    }

    class Payment {
        +UUID id
        +Money amount
        +datetime recorded_at
        +str reference
        +str notes
    }

    class PaymentBlocker {
        +UUID id
        +UUID invoice_id
        +BlockerKind kind
        +str description
        +datetime raised_at
        +datetime resolved_at
        +bool is_resolved()
    }

    class PaymentPromise {
        +UUID id
        +UUID invoice_id
        +date promised_date
        +Money amount
        +datetime made_at
        +bool kept
    }

    class FollowUp {
        +UUID id
        +UUID invoice_id
        +FollowUpChannel channel
        +datetime scheduled_for
        +datetime completed_at
        +str notes
        +str outcome
    }

    class SupportingDocument {
        +UUID id
        +UUID invoice_id
        +str name
        +str url
        +str file_path
        +datetime uploaded_at
    }

    class NextAction {
        +UUID id
        +UUID invoice_id
        +ActionKind kind
        +str description
        +datetime due_by
        +datetime created_at
        +datetime completed_at
        +int priority
    }

    class InvoiceState {
        <<abstract>>
        +label() str
        +can_issue() bool
        +can_record_payment() bool
        +can_flag_overdue() bool
        +can_write_off() bool
        +can_dispute() bool
        +can_resolve_dispute() bool
    }

    class DraftState {
        +label() str
    }

    class IssuedState {
        +label() str
    }

    class PartialState {
        +label() str
    }

    class OverdueState {
        +label() str
    }

    class PaidState {
        +label() str
    }

    class WrittenOffState {
        +label() str
    }

    class DisputedState {
        +label() str
    }

    class Invoice {
        +UUID id
        +UUID project_id
        +UUID client_id
        +str invoice_number
        +Money amount
        +Money paid_so_far
        +date issued_date
        +date due_date
        +datetime created_at
        +datetime updated_at
        +str notes
        +InvoiceState _state
        +List~Payment~ payments
        +List~PaymentBlocker~ blockers
        +List~PaymentPromise~ promises
        +List~FollowUp~ follow_ups
        +List~SupportingDocument~ documents
        +List~NextAction~ next_actions
        +balance_due() Money
        +status() InvoiceStatus
        +issue() void
        +record_payment(amount: Money) void
        +flag_overdue() void
        +write_off() void
        +dispute() void
        +resolve_dispute() void
        +raise_blocker(kind, description) PaymentBlocker
        +resolve_blocker(blocker_id) void
        +log_promise(promised_date, amount) PaymentPromise
        +check_promises(today: date) void
        +add_action(action: NextAction) void
        +pull_events() List~DomainEvent~
    }

    class DomainEvent {
        <<abstract>>
        +UUID event_id
        +datetime occurred_at
    }

    class InvoiceIssued {
        +UUID invoice_id
    }

    class PaymentRecorded {
        +UUID invoice_id
        +Money amount
    }

    class InvoicePaid {
        +UUID invoice_id
    }

    class InvoiceOverdue {
        +UUID invoice_id
    }

    class BlockerRaised {
        +UUID invoice_id
        +UUID blocker_id
        +BlockerKind kind
    }

    class BlockerResolved {
        +UUID invoice_id
        +UUID blocker_id
    }

    class PromiseMade {
        +UUID invoice_id
        +date promised_date
    }

    class PromiseKept {
        +UUID invoice_id
        +UUID promise_id
    }

    class PromiseBroken {
        +UUID invoice_id
        +UUID promise_id
    }

    class InvoiceWrittenOff {
        +UUID invoice_id
    }

    class InvoiceDisputed {
        +UUID invoice_id
    }

    class AuditEntry {
        +UUID id
        +str entity_type
        +UUID entity_id
        +str action
        +str performed_by
        +datetime occurred_at
        +dict metadata
    }

    %% Inheritance
    InvoiceState <|-- DraftState
    InvoiceState <|-- IssuedState
    InvoiceState <|-- PartialState
    InvoiceState <|-- OverdueState
    InvoiceState <|-- PaidState
    InvoiceState <|-- WrittenOffState
    InvoiceState <|-- DisputedState

    DomainEvent <|-- InvoiceIssued
    DomainEvent <|-- PaymentRecorded
    DomainEvent <|-- InvoicePaid
    DomainEvent <|-- InvoiceOverdue
    DomainEvent <|-- BlockerRaised
    DomainEvent <|-- BlockerResolved
    DomainEvent <|-- PromiseMade
    DomainEvent <|-- PromiseKept
    DomainEvent <|-- PromiseBroken
    DomainEvent <|-- InvoiceWrittenOff
    DomainEvent <|-- InvoiceDisputed

    %% Composition (Invoice owns its children)
    Invoice *-- Payment : payments
    Invoice *-- PaymentBlocker : blockers
    Invoice *-- PaymentPromise : promises
    Invoice *-- FollowUp : follow_ups
    Invoice *-- SupportingDocument : documents
    Invoice *-- NextAction : next_actions

    %% State association
    Invoice --> InvoiceState : _state

    %% Value objects
    Invoice --> Money : amount
    Invoice --> Money : paid_so_far
    Payment --> Money : amount

    %% ID-based associations (not direct references)
    Project ..> Client : client_id
    Invoice ..> Project : project_id
    Invoice ..> Client : client_id
```
