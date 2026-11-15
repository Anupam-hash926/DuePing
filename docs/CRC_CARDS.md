# Class–Responsibility–Collaborator (CRC) Cards

### 1. `Invoice` (Aggregate Root)
- **Package:** `app.domain.invoice`
- **Responsibilities:**
  - Maintain invoice core attributes (number, total amount, issue date, due date).
  - Enforce aggregate boundary consistency and invariants.
  - Delegate allowed operations and transitions to `InvoiceState`.
  - Calculate derived financial metrics (`amount_paid`, `outstanding`, `is_overdue`, `days_overdue`).
  - Manage collections of `Payment`, `PaymentBlocker`, `PaymentPromise`, `FollowUp`, `SupportingDocument`, and `NextAction`.
  - Stage and emit domain events (`PaymentReceived`, `BlockerRaised`, `PromiseRecorded`, etc.).
- **Collaborators:**
  - `InvoiceState`, `Money`, `Payment`, `PaymentBlocker`, `PaymentPromise`, `FollowUp`, `SupportingDocument`, `NextAction`, `DomainEvent`.

---

### 2. `InvoiceState` (State Hierarchy)
- **Package:** `app.domain.invoice_state`
- **Responsibilities:**
  - Define state-specific allowed operations set (`allowed_operations`).
  - Guard and execute valid transitions between `DraftState`, `SentState`, `PartiallyPaidState`, `DisputedState`, `PaidState`, and `WrittenOffState`.
  - Reject invalid operations with `InvalidStateTransition`.
- **Collaborators:**
  - `Invoice`, `Payment`, `PaymentBlocker`, `InvoiceStatus`.

---

### 3. `Client` (Entity)
- **Package:** `app.domain.client`
- **Responsibilities:**
  - Store client contact details and agreed payment terms.
  - Track lifetime payment history counts (`paid_on_time_count`, `paid_late_count`, `broken_promises_count`).
  - Empirically calculate `reliability_score` (0–100%) and `risk_level` (`LOW`, `MEDIUM`, `HIGH`).
- **Collaborators:**
  - `Invoice` (referenced via `client_id`), `ReliabilityListener`.

---

### 4. `PaymentBlocker` (Child Entity)
- **Package:** `app.domain.blocker`
- **Responsibilities:**
  - Model operational impediment causing non-payment (`BlockerType`).
  - Track blocker lifecycle status (`OPEN`, `IN_PROGRESS`, `RESOLVED`).
  - Hold owner assignment and resolution notes.
- **Collaborators:**
  - `Invoice`, `BlockerType`, `BlockerStatus`.

---

### 5. `PaymentPromise` (Child Entity)
- **Package:** `app.domain.promise`
- **Responsibilities:**
  - Represent debtor's formal commitment to pay an amount by a specified date.
  - Maintain fulfillment status (`PENDING`, `KEPT`, `MISSED`).
  - Provide query helper `is_pending`.
- **Collaborators:**
  - `Invoice`, `Money`, `PromiseStatus`.

---

### 6. `NextAction` (Child Entity)
- **Package:** `app.domain.next_action`
- **Responsibilities:**
  - Represent an operational task assigned to the collections team.
  - Track action description, priority, deadline, and communication channel.
  - Track task state (`PENDING`, `COMPLETED`, `CANCELLED`).
  - Support completion, rescheduling, and cancellation.
- **Collaborators:**
  - `Invoice`, `Priority`, `Channel`, `ActionSource`, `ActionStatus`.

---

### 7. `CollectionFacade` (Application Facade)
- **Package:** `app.application.facade`
- **Responsibilities:**
  - Provide a single, cohesive API surface for all collections operations.
  - Coordinate repository loading, domain aggregate mutation, event publishing, and query aggregation.
  - Shield API routers and CLI scripts from subsystem complexity.
- **Collaborators:**
  - `InvoiceRepository`, `ClientRepository`, `ProjectRepository`, `AuditRepository`, `NotificationRepository`, `SettingsRepository`, `Clock`, `EventBus`, `ResolutionPlaybook`, `PrioritizationRegistry`, `ReminderFactory`, `InvoiceImporter`, `ReportService`, `ActionCenter`, `DailyCheckService`.

---

### 8. `EventBus` (Application Observer Subject)
- **Package:** `app.application.event_bus`
- **Responsibilities:**
  - Manage listener registrations per domain event type and global subscribers.
  - Buffer outgoing domain events in an internal dispatch queue.
  - Sequentially deliver events without reentrancy recursion.
- **Collaborators:**
  - `DomainEvent`, `AuditLogListener`, `ActionGenerationListener`, `ReliabilityListener`, `NotificationListener`.

---

### 9. `ResolutionPlaybook` (Strategy Context)
- **Package:** `app.application.playbook`
- **Responsibilities:**
  - Evaluate raised `PaymentBlocker`s against registered `ResolutionStrategy` instances.
  - Select appropriate resolution strategy and return concrete parameters (`action_text`, `priority`, `due_date`, `channel`).
  - Instantiate and attach a `NextAction` to the aggregate.
- **Collaborators:**
  - `ResolutionStrategy` implementations (`MissingPOResolution`, `ApprovalResolution`, `DisputeResolution`, etc.), `PlaybookContext`, `PaymentBlocker`, `NextAction`.

---

### 10. `ActionCenter` (Application Query Service)
- **Package:** `app.application.action_center`
- **Responsibilities:**
  - Query active invoices and collate pending `NextAction` items with client and financial context.
  - Retrieve selected `PrioritizationStrategy` from `PrioritizationRegistry`.
  - Sort actions according to strategy algorithm and package into an `ActionCenterView` (due today vs. upcoming).
- **Collaborators:**
  - `InvoiceRepository`, `ClientRepository`, `Clock`, `PrioritizationRegistry`, `PrioritizationStrategy`, `ActionCenterItem`, `ActionCenterView`.
