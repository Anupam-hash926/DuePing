# DuePing v2 — OOAD Design & Technical Report Notes

This document provides report-ready technical prose, structural tables, pattern justifications, SOLID mappings, and design decisions for DuePing v2, referencing the concrete codebase classes and architecture.

---

## 1. Problem and Objectives

### 1.1 The Business Problem
Small agencies, consultancies, and independent contractors frequently struggle with cash flow not because clients refuse to pay, but because invoices become stalled by operational friction:
1. **Missing prerequisite information** (e.g., missing purchase order numbers, unapproved timesheets).
2. **Administrative gridlock** (e.g., awaiting internal VP approval, incorrect billing address or tax IDs).
3. **Unresolved commercial disputes** (e.g., disputed line items or deliverable milestones).
4. **Broken commitments** (e.g., verbal promises to pay that expire without follow-up).

Traditional accounting tools (e.g., QuickBooks, Zoho Books, FreshBooks) send linear, time-based reminders (e.g., "+7 days overdue", "+14 days overdue"). When an invoice is unpaid due to a missing PO, repetitive automated reminders irritate client contacts without resolving the underlying blocker.

### 1.2 Core Objectives
DuePing implements a **resolution-first follow-up system**:
- Treat late payment as a **symptom** and model the **cause** explicitly through structured `PaymentBlocker`s.
- Provide a **Resolution Playbook** translating blockers into concrete, actionable `NextAction`s.
- Track client payment commitments as first-class `PaymentPromise` objects, maintaining a dynamic client `reliability_score` (0–100%) and risk rating (`LOW`, `MEDIUM`, `HIGH`).
- Provide an **Action Centre** with swappable prioritisation strategies (`risk_weighted`, `amount_first`, `oldest_first`).
- Maintain an immutable, append-only domain event trail for complete collections auditability.

---

## 2. Flaws in the Original Class Design and How DuePing Fixes Them

| # | Flaw in Naive / Original Design | Architectural Hazard | DuePing v2 Resolution & Concrete Classes |
|---|---|---|---|
| **(a)** | Relational ID fields instead of object associations (`Invoice.paymentId`, `FollowUp.invoiceId`) | Weak encapsulation; child entities manipulated independently without aggregate consistency checks. | **Composition under Aggregate Root:** `Invoice` owns `Payment`, `PaymentBlocker`, `PaymentPromise`, `FollowUp`, `SupportingDocument`, and `NextAction` collections in memory (`Invoice._payments`, etc.). |
| **(b)** | Missing relationships & multiplicities | Ambiguous data ownership and orphaned records. | Strictly defined multiplicities: `Invoice 1 ──* Payment`, `Invoice 1 ──* PaymentBlocker`, `Invoice 1 ──* PaymentPromise`, `Client 1 ──* Project`. |
| **(c)** | Stringly-typed fields (`status="paid"`, `amount=1200.50`, `priority="high"`) | Silent typos, currency mixing, IEEE-754 floating-point rounding errors. | Strongly-typed Python enums (`InvoiceStatus`, `BlockerType`, `Priority`, `Channel`, `FollowUpOutcome`) and an immutable `Money` value object backed by `Decimal` (quantised to 2 decimal places). |
| **(d)** | Derived data stored as mutable database fields (`amountPaid`, `isOverdue`) | Synchronization drift; stale cache bugs when payments or system dates change. | **Pure Computed Properties:** `invoice.amount_paid()` sums payments; `invoice.outstanding()` subtracts paid from total; `invoice.is_overdue(today)` dynamically evaluates date and status. |
| **(e)** | Duplicated `recordPayment` on both `Invoice` and `CollectionService` | Split responsibility; logic diverged depending on which entry point was called. | **Single Aggregate Owner:** `Invoice.record_payment(...)` is the sole mutator. Application services and facade load the aggregate, invoke `invoice.record_payment`, and persist via repository. |
| **(f)** | Misplaced methods (`FollowUp.getFollowUpHistory()`, `getPaymentReference()`) | Entities acting as data stores / queries; violates Information Expert. | Repository pattern handles queries (`InvoiceRepository.find_by_id`, `list_active`); entities only encapsulate intrinsic behavior. |
| **(g)** | Persistence code inside entities (`SupportingDocument.upload()`, `delete()`) | Couples business domain to filesystem/database I/O; untestable in isolation. | **Clean Layering:** `SupportingDocument` is a pure metadata domain entity. Storage and I/O are handled by repository adapters. |
| **(h)** | `FollowUp` mixing communication logs with financial promises | Communication logs were coupled with promise deadlines and fulfillment states. | **Split Entity Roles:** `FollowUp` represents immutable contact history (`Channel`, `notes`, `outcome`). `PaymentPromise` is a dedicated lifecycle entity (`PENDING`, `KEPT`, `MISSED`). |
| **(i)** | `CollectionService` god-class with meaningless `serviceId` | Low cohesion; bloated class mixing scheduling, reporting, SMS/Email, and CRUD. | **Decomposed Architecture:** `CollectionFacade` acts as a unified coordinator delegating to `ActionCenter`, `ResolutionPlaybook`, `ReminderFactory`, `ReportService`, and `DailyCheckService`. |
| **(j)** | Stored report totals and hardcoded aging buckets | Discrepancies between historical ledgers and summary dashboards. | **On-Demand Computed Reports:** `ReportService.get_collection_report()` dynamically computes aging buckets, debtor concentration, and monthly collection trends from aggregates. |
| **(k)** | Features without classes (reminders, action centre, dashboard) | Scattered procedural scripts. | Dedicated domain & application classes: `ReminderFactory`, `ReminderMessage` hierarchy, `ActionCenter`, `ActionCenterView`, `CollectionReport`. |

---

## 3. Aggregate and Boundary Decisions

### 3.1 The Aggregate Root: `Invoice`
`Invoice` is the sole Aggregate Root in the collection subsystem:
- **Consistency Boundary:** Invariants such as *“Payments cannot exceed invoice total”*, *“Payments cannot be made on DRAFT or WRITTEN_OFF invoices”*, and *“Resolving a blocker cancels its generated action”* can only be enforced if the `Invoice` controls all child mutations.
- **Children:** `Payment`, `PaymentBlocker`, `PaymentPromise`, `FollowUp`, `SupportingDocument`, `NextAction`.
- **References Outside Boundary:** References to `Client` and `Project` are stored strictly as scalar string IDs (`client_id`, `project_id`). This avoids loading entire client graph hierarchies into memory and maintains clear aggregate isolation.

### 3.2 Domain-Generated Identity
Entities generate their UUID identifiers (`uuid.uuid4().hex`) inside their Python `__init__` constructors rather than delegating identity generation to database auto-increment columns:
1. **Repository Independence:** Entities can be instantiated, tested, and linked in unit tests with in-memory repositories without touching SQLite or PostgreSQL.
2. **Event Correlation:** Domain events (e.g. `BlockerRaised(invoice_id, blocker_id)`) can be constructed and published immediately inside domain methods before saving to disk.
3. **Idempotent Persistence:** Repositories can inspect child IDs to perform accurate set-difference synchronisation (inserts, updates, deletes) in a single transactional unit.

---

## 4. Design Pattern Justification Table

| Pattern | Problem It Solved | Participating Classes | Source File | Design Principle |
|---|---|---|---|---|
| **State** | Eliminate complex nested `if/elif` conditionals for invoice lifecycle transitions; enforce valid state operations. | `InvoiceState` (Context/State), `DraftState`, `SentState`, `PartiallyPaidState`, `DisputedState`, `PaidState`, `WrittenOffState` | `backend/app/domain/invoice_state.py` | **SRP & OCP:** Each state encapsulates its own allowed operations and transitions. |
| **Strategy (Prioritization)** | Allow users to re-order Action Centre tasks based on different business contexts without changing task models. | `PrioritizationStrategy` (Strategy), `AmountFirstStrategy`, `OldestFirstStrategy`, `RiskWeightedStrategy`, `PrioritizationRegistry` (Context) | `backend/app/application/prioritization.py` | **OCP & DIP:** Adding a new ranking formula requires only implementing `score()` and registering. |
| **Strategy (Playbook)** | Map domain blocker types to recommended resolution actions with custom priority and deadlines. | `ResolutionStrategy` (Strategy), `MissingPOResolution`, `ApprovalResolution`, `DisputeResolution`, `WrongDetailsResolution`, `MissingDocumentsResolution`, `NoResponseResolution`, `OtherResolution`, `ResolutionPlaybook` (Context) | `backend/app/application/playbook.py` | **OCP:** Adding a blocker type requires adding a resolution strategy without modifying existing strategies. |
| **Template Method** | Ensure all reminder communications follow a rigid professional structure while varying tone and phrasing. | `ReminderMessage` (AbstractClass), `PoliteReminder`, `FirmReminder`, `FinalNoticeReminder` | `backend/app/application/reminders.py` | **DIP & OCP:** Template defines skeleton (`subject()`, `greeting()`, `opening()`, `blocker_sentence()`, `promise_sentence()`, `request()`, `closing()`); subclasses override steps. |
| **Factory (Invoice)** | Centralize creation of valid invoices in DRAFT status, format sequential numbers (`DP-YYYY-NNNN`), and enforce uniqueness. | `InvoiceFactory` | `backend/app/application/invoice_factory.py` | **SRP & DRY:** Shields callers from number formatting and sequence querying. |
| **Factory (Reminder)** | Select appropriate reminder tone based on days overdue and client risk rating. | `ReminderFactory` | `backend/app/application/reminders.py` | **SRP:** Decouples tone selection policy from message rendering. |
| **Adapter** | Translate external CSV tabular input into domain-expected data structures with normalized headers. | `InvoiceSource` (Target), `CsvInvoiceSource` (Adapter), `InvoiceSourceFactory` | `backend/app/application/importing.py` | **DIP:** Importer coordinates against `InvoiceSource` interface; underlying format details are hidden. |
| **Chain of Responsibility** | Execute ordered validation rules on imported rows, collecting all error reasons without aborting. | `RowValidator` (Handler), `RequiredFieldsValidator`, `ClientDataValidator`, `DateValidator`, `AmountValidator`, `StatusValidator`, `DuplicateInvoiceNumberValidator` | `backend/app/application/importing.py` | **OCP & SRP:** Each validator checks exactly one invariant; validators can be reordered or extended. |
| **Observer** | Decouple domain aggregate operations from side effects (audit logging, action generation, reliability score tracking, notifications). | `EventBus` (Subject), `DomainEvent`, `AuditLogListener`, `ActionGenerationListener`, `ReliabilityListener`, `NotificationListener` (Observers) | `backend/app/application/event_bus.py`, `backend/app/application/listeners.py` | **OCP & DIP:** New listeners can be plugged in without changing the domain aggregate or existing listeners. |
| **Facade** | Provide a unified, clean interface for API routers and scripts, shielding callers from subsystem complexities. | `CollectionFacade` | `backend/app/application/facade.py` | **Facade Pattern & High Cohesion:** Coordinates repositories, event bus, clock, factories, and services behind cohesive operations. |
| **Repository** | Decouple domain and application logic from SQLAlchemy ORM and database technology. | `InvoiceRepository`, `ClientRepository`, `ProjectRepository`, `AuditRepository`, `NotificationRepository`, `SettingsRepository`, `SqlAlchemyInvoiceRepository`, `InMemoryInvoiceRepository` | `backend/app/application/ports.py`, `backend/app/infrastructure/sqlalchemy_repositories.py` | **DIP & ISP:** Clean domain ports; database engines can be swapped without touching business rules. |

---

## 5. SOLID Mapping with Concrete Examples

### 5.1 Single Responsibility Principle (SRP)
- **Reminder Generation vs Ranking:** `ReminderFactory` selects reminder tone; `ReminderMessage` formats the text; `PrioritizationRegistry` calculates Action Centre ranking. Neither class knows about the other.
- **Import Parsing vs Validation:** `CsvInvoiceSource` handles CSV dialect parsing and header normalisation. The `RowValidator` chain validates business rules. `InvoiceImporter` coordinates entity saving.

### 5.2 Open/Closed Principle (OCP)
- **New Blocker Types:** Adding a `BANK_DETAILS_UPDATE` blocker requires adding the enum member and a `BankDetailsUpdateResolution(ResolutionStrategy)` class registered on `ResolutionPlaybook`. Existing resolution strategies and `Invoice` code remain completely untouched.
- **New Prioritisation Strategy:** Creating a `PromiseRiskStrategy` requires creating a class inheriting `PrioritizationStrategy` and registering it with `registry.register(PromiseRiskStrategy())`.

### 5.3 Liskov Substitution Principle (LSP)
- **State Substitutability:** Any concrete `InvoiceState` (`SentState`, `PartiallyPaidState`, `DisputedState`) can be substituted in `invoice.state` without breaking callers; `allowed_operations()` and transition guards conform to the contract.
- **Prioritization Substitutability:** `ActionCenter` invokes `strategy.score(ctx)` and `strategy.sort(contexts)` uniformly across all registered strategies.

### 5.4 Interface Segregation Principle (ISP)
- **Targeted Repository Ports:** Rather than one massive `PersistencePort`, repositories are split into focused interfaces in `application/ports.py`: `InvoiceRepository`, `ClientRepository`, `ProjectRepository`, `SettingsRepository`, `AuditRepository`, `NotificationRepository`. Services only declare dependencies on the exact ports they require.

### 5.5 Dependency Inversion Principle (DIP)
- **Strict Inward Dependency Rule:** The domain layer (`app/domain/`) imports only the Python standard library. Application services depend on abstract ports (`InvoiceRepository`, `Clock`).
- **Composition Root:** All concrete bindings (`SqlAlchemyInvoiceRepository`, `SimulatedClock`, `EventBus`, `SessionLocal`) are wired exclusively in `app/api/deps.py`.

---

## 6. Extensibility Demonstrations (Exact Files to Add)

### 6.1 Adding a New Blocker Type (`BANK_DETAILS_UPDATE`)
1. In `backend/app/domain/enums.py`: add `BANK_DETAILS_UPDATE = "BANK_DETAILS_UPDATE"` to `BlockerType`.
2. In `backend/app/application/playbook.py`:
   ```python
   class BankDetailsUpdateResolution(ResolutionStrategy):
       def applies_to(self, blocker_type: BlockerType) -> bool:
           return blocker_type == BlockerType.BANK_DETAILS_UPDATE

       def suggest_action(self, context: PlaybookContext) -> tuple[str, Priority, int, Channel]:
           return (
               f"Send verified bank letter and cancelled cheque to {context.client.name}",
               Priority.HIGH,
               1,
               Channel.EMAIL,
           )
   ```
   Add `self.strategies.append(BankDetailsUpdateResolution())` to `ResolutionPlaybook.__init__`.
3. In `frontend/src/pages/InvoiceDetailPage.tsx`: add `<option value="BANK_DETAILS_UPDATE">Bank Details Update</option>`.

### 6.2 Adding a New Prioritisation Strategy (`PromiseRiskStrategy`)
1. In `backend/app/application/prioritization.py`:
   ```python
   class PromiseRiskStrategy(PrioritizationStrategy):
       @property
       def key(self) -> str:
           return "promise_risk"

       @property
       def name(self) -> str:
           return "Promise Risk First"

       @property
       def description(self) -> str:
           return "Prioritize clients with low promise reliability scores"

       def score(self, context: ActionContext) -> float:
           return (100.0 - context.client.reliability_score()) * 10.0 + float(context.invoice.outstanding().amount) / 1000.0
   ```
   Register with `registry.register(PromiseRiskStrategy())` in `PrioritizationRegistry.__init__`.

### 6.3 Adding a New Reminder Tone (`FINAL_NOTICE`)
1. In `backend/app/domain/enums.py`: `ReminderTone` already defines `POLITE`, `FIRM`, `FINAL`. To add a new tone (e.g. `LEGAL_NOTICE`):
   add `LEGAL_NOTICE = "LEGAL_NOTICE"` to `ReminderTone`.
2. In `backend/app/application/reminders.py`:
   ```python
   class LegalNoticeReminder(ReminderMessage):
       @property
       def tone(self) -> ReminderTone:
           return ReminderTone.LEGAL_NOTICE

       def greeting(self, ctx: ReminderContext) -> str:
           return f"Dear {ctx.client_name},"

       def opening(self, ctx: ReminderContext) -> str:
           return f"This constitutes formal notice of default regarding overdue invoice {ctx.invoice_number} ({ctx.currency} {ctx.amount_due})."

       def request(self, ctx: ReminderContext) -> str:
           return "Immediate settlement is required within 48 hours to avoid formal escalation."

       def closing(self, ctx: ReminderContext) -> str:
           return "Regards,\nCredit Control Team"
   ```
   Register in `ReminderFactory.create`:
   `if tone == ReminderTone.LEGAL_NOTICE: return LegalNoticeReminder()`.

### 6.4 Adding a New Invoice Source (`JsonInvoiceSource`)
1. In `backend/app/application/importing.py`:
   ```python
   import json

   class JsonInvoiceSource(InvoiceSource):
       def __init__(self, content: str) -> None:
           self.content = content

       def read_rows(self) -> list[RawInvoiceRow]:
           items = json.loads(self.content)
           rows: list[RawInvoiceRow] = []
           for idx, item in enumerate(items, start=1):
               rows.append(RawInvoiceRow(row_number=idx, data={k: str(v) for k, v in item.items()}))
           return rows
   ```
   Add a factory method `create_json_source(content: str)` on `InvoiceSourceFactory`.

---

## 7. Comparison with Existing Tools

| Feature | Standard Accounting Software (Zoho Books, QuickBooks) | DuePing v2 Resolution-First System |
|---|---|---|
| **Follow-up Trigger** | Linear time elapsed (e.g. 7 days past due date). | **Cause-driven:** Follow-up is governed by why the invoice is unpaid (`PaymentBlocker`). |
| **Action Generation** | Generic reminder emails sent to client AP address. | **Structured NextActions:** Operational tasks assigned to team members (e.g., "Request PO from Rahul"). |
| **Payment Commitments** | "Expected Payment Date" field overwritten on invoice. | **`PaymentPromise` History:** Tracks kept vs. missed commitments, computing an empirical `reliability_score`. |
| **Dispute Handling** | Invoice either left open or marked void. | Dedicated `DISPUTED` state; payments permitted while dispute is investigated; resolving restores state. |
| **Prioritisation** | Simple table sorting by due date or amount. | **Contextual Ranking Strategies:** Risk-weighted, amount-first, and oldest-first with dynamic scoring. |

*Note: DuePing is designed as a complementary intelligence and action layer on top of accounting software, not a replacement for full general ledger bookkeeping.*

---

## 8. Design Decisions and Trade-Offs

1. **Aggregate Boundaries and ID References Across Aggregates:**
   - `Invoice` is the primary aggregate root. Child entities (`Payment`, `PaymentBlocker`, `PaymentPromise`, `FollowUp`, `SupportingDocument`, `NextAction`) are fully owned by `Invoice` and accessed exclusively through it.
   - References across aggregates (e.g. between `Invoice` and `Client` or `Project`) use scalar identifier strings (`client_id`, `project_id`) rather than direct object references. This ensures each aggregate can be persisted, locked, and cached independently without traversing object graphs.

2. **Derived Overdue vs. Stored State:**
   - In traditional naive designs, "OVERDUE" is treated as an invoice state. This introduces temporal coupling and polling bugs: an invoice becomes overdue purely because the clock ticked past midnight, not because an actor executed a state command.
   - In DuePing, `InvoiceStatus` contains only command-driven lifecycle stages (`DRAFT`, `SENT`, `PARTIALLY_PAID`, `DISPUTED`, `PAID`, `WRITTEN_OFF`). Overdue is a derived temporal query: `invoice.is_overdue(today)`. The `DailyCheckService` uses `Clock` to evaluate this condition and stage `InvoiceBecameOverdue` domain events without mutating the state machine.

3. **Synchronous In-Process Domain Events:**
   - Domain events are dispatched in-process via `EventBus`. The bus maintains an internal FIFO queue (`_queue`) and a dispatch flag (`_is_dispatching`) to prevent recursive reentrancy when listener handlers emit secondary domain events.
   - Aggregate persistence and event listener effects are executed within the application service unit of work. While this provides synchronous guarantees for audit logging and task creation, listener side effects are designed to be eventually consistent: failures in secondary handlers do not rollback completed payments, and failed handler invocations are surfaced for monitoring (see Phase 4 C3).

4. **Simple Factory Pattern for `InvoiceFactory` and `ReminderFactory`:**
   - Rather than introducing heavyweight Abstract Factory hierarchies with unnecessary indirection, `InvoiceFactory` and `ReminderFactory` use the *Simple Factory* idiom. They encapsulate creation rules, ID/sequence formatting, and tone selection policy without exposing callers to concrete instantiation details.

---

## 9. Limitations and Future Work

1. **Late Fee Policy Engine:** Future implementation of a `LateFeePolicy` strategy (`FixedLateFee`, `PercentageLateFee`) applied during daily check.
2. **Channel Delivery Bridges:** Integration of concrete communication adapters (e.g., Twilio for WhatsApp, SendGrid for Email) via the Bridge/Adapter pattern.
3. **Command Pattern for Undo:** Wrapping facade mutations in `Command` objects (`RecordPaymentCommand`, `ResolveBlockerCommand`) supporting undo/redo.
4. **Multi-tenant Authentication & Authorization:** Role-based access control (RBAC) separating collections officers from account owners.
5. **Production Background Cron:** Celery / Redis queue running `run_daily_check` at 00:01 UTC daily.
6. **PostgreSQL Support:** Drop-in compatibility via existing SQLAlchemy repository implementations by switching engine connection strings.

---

## 10. Testing Summary and Screenshot Catalog

### 10.1 Testing Summary
- **Total Tests:** 254 test cases executed and passed.
- **Total Coverage:** **96% line coverage** across `app` package.
- **Layers Verified:**
  - `domain`: 98% coverage (Money math, all state transition table cells, entities, promises, blockers, domain events, forbidden imports check).
  - `application`: 94% coverage (Playbook, prioritization strategies, reminder template methods, CSV importer validator chain, event bus, listeners, facade, reports).
  - `infrastructure`: 95% coverage (SQLAlchemy and in-memory repository contract suite, mappers, seed).
  - `api`: 94% coverage (Full-flow test, error mappings 404/409/422, OpenAPI contract).

### 10.2 Screenshot Catalog for Documentation & Submission
Capture the following screenshots following the Section 17.2 demo script:
1. `docs/screenshots/01-action-centre.png`: Action Centre home view showing priority-ranked tasks with "Risk-weighted" strategy.
2. `docs/screenshots/02-action-centre-amount.png`: Action Centre switched to "Largest amount first" strategy showing re-ordered cards.
3. `docs/screenshots/03-invoice-7-orbit-details.png`: Invoice detail view for `INV-OL-07` showing `WRONG_DETAILS` blocker and PENDING promise.
4. `docs/screenshots/04-daily-check-promise-missed.png`: Simulated date advanced to T+4 and Daily Check triggered; summary toast displayed; Orbit Labs score dropped to 0%.
5. `docs/screenshots/05-reminder-preview.png`: Reminder panel on `INV-OL-07` showing FIRM tone with rendered subject, blocker sentence, and missed promise sentence.
6. `docs/screenshots/06-dispute-resolution.png`: Invoice `INV-GL-05` in DISPUTED state with partial payment recorded; resolve blocker modal.
7. `docs/screenshots/07-invoice-11-paid.png`: Full payment recorded on `INV-SR-11`, status badge showing green PAID with zero pending actions.
8. `docs/screenshots/08-dashboard-kpis-charts.png`: Dashboard view showing Recharts aging schedule, 6-month collection trend line, and KPI cards.
9. `docs/screenshots/09-csv-import-summary.png`: Import page showing `sample_invoices.csv` result: 2 imported, 2 rejected with row validation errors.
10. `docs/screenshots/10-audit-trail.png`: Audit log view showing immutable domain event ledger.
