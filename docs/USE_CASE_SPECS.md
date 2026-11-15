# Use Case Detailed Specifications

---

## Use Case 1: Raise Blocker

- **Primary Actor:** Account Owner
- **Scope:** DuePing Collections Subsystem
- **Level:** User Goal
- **Stakeholders & Interests:**
  - *Account Owner:* Needs to accurately record why an invoice is unpaid to pause generic nagging and trigger targeted resolution steps.
  - *Debtor Client:* Needs commercial disputes or administrative hurdles acknowledged rather than receiving inappropriate payment demands.

### Preconditions
1. An invoice exists in the system with an active status (`SENT` or `PARTIALLY_PAID`).
2. The user identifies a specific operational impediment (`BlockerType`).

### Main Success Flow
1. User submits blocker details (`invoice_id`, `blocker_type`, `description`, optional `owner`).
2. System loads the `Invoice` aggregate root.
3. System validates that the invoice status permits raising a blocker via `InvoiceState.allowed_operations`.
4. System instantiates a `PaymentBlocker` entity with status `OPEN`.
5. If `blocker_type == DISPUTED_AMOUNT`:
   - System transitions the invoice state to `DisputedState`.
   - System stages an `InvoiceDisputed` domain event.
6. System stages a `BlockerRaised` domain event.
7. System persists the updated invoice aggregate via `InvoiceRepository.save`.
8. System pulls and publishes staged domain events via `EventBus.publish_all`.
9. `AuditLogListener` records an `AuditEvent` entry in `AuditRepository`.
10. `NotificationListener` generates an alert notification for the account owner.
11. `ActionGenerationListener` intercepts `BlockerRaised`:
    - Constructs a `PlaybookContext` containing client, invoice, and blocker data.
    - Queries `ResolutionPlaybook.suggest_action` to determine the appropriate `NextAction`.
    - Creates and appends the `NextAction` to the invoice and saves the aggregate.
12. System returns the newly created blocker details to the user.

### Extensions (Alternate Flows)
- **3a. Invalid State Transition:**
  - If the invoice is in `DRAFT`, `PAID`, or `WRITTEN_OFF` status, the system raises `InvalidStateTransition`.
  - HTTP layer converts the error to HTTP 409 Conflict with a descriptive error message. Main flow terminates.
- **11a. Unknown Blocker Type / Missing Specific Strategy:**
  - `ResolutionPlaybook` falls back to `OtherResolution`, generating a general review task with `Priority.MEDIUM` due within 2 business days.

### Postconditions
- Blocker is attached to the invoice with status `OPEN`.
- If disputed, invoice status is `DISPUTED`.
- A targeted `NextAction` is created on the invoice and prioritized in the Action Centre.
- An immutable audit log entry is recorded.

---

## Use Case 2: Record Payment

- **Primary Actor:** Account Owner
- **Scope:** DuePing Collections Subsystem
- **Level:** User Goal
- **Stakeholders & Interests:**
  - *Account Owner:* Needs accurate, real-time balances, ledger tracking, and automatic task clearing upon invoice settlement.
  - *Debtor Client:* Needs credit for payments made and their reliability score preserved or improved.

### Preconditions
1. An invoice exists in the system with status `SENT`, `PARTIALLY_PAID`, or `DISPUTED`.
2. A valid payment has been received via a recognized `PaymentMethod`.

### Main Success Flow
1. User submits payment details (`invoice_id`, `amount`, `payment_date`, `payment_method`, optional `reference`, `notes`).
2. System loads the `Invoice` aggregate root.
3. System verifies invoice state permits payment via `InvoiceState.allowed_operations`.
4. System validates payment invariants:
   - `amount.amount > 0` (non-zero positive).
   - `amount.currency == invoice.currency` (matching currencies).
   - `amount <= invoice.outstanding()` (cannot overpay).
5. System creates a `Payment` entity and appends it to the invoice payments collection.
6. System evaluates remaining outstanding balance:
   - If `outstanding == 0`: `InvoiceState` transitions to `PaidState`.
   - If `outstanding > 0` and previous state was `SENT`: `InvoiceState` transitions to `PartiallyPaidState`.
   - If previous state was `DISPUTED`: state remains `DISPUTED` if `outstanding > 0`, or transitions to `PaidState` if fully settled.
7. System checks for open `PaymentPromise`:
   - If a promise is pending and `payment_date <= promise.promised_date`, the promise is marked `KEPT` and stages `PromiseKept`.
8. System stages `PaymentReceived` domain event.
9. If invoice is fully paid, system stages `InvoicePaid` and cancels all pending `NextAction` tasks.
10. System persists aggregate via `InvoiceRepository.save`.
11. System publishes domain events via `EventBus.publish_all`.
12. `ReliabilityListener` catches `PaymentReceived` and `PromiseKept`:
    - Increments `paid_on_time_count` on `Client` (or `paid_late_count` if overdue).
    - Recalculates `Client.reliability_score()` and updates risk level.
13. `AuditLogListener` appends payment details to the audit ledger.
14. System returns the created payment record.

### Extensions (Alternate Flows)
- **4a. Payment Amount Exceeds Outstanding Balance:**
  - System raises `DomainValidationError("Payment amount exceeds outstanding balance")`.
  - HTTP layer maps to HTTP 422 Unprocessable Entity. Main flow terminates.
- **4b. Currency Mismatch:**
  - System raises `DomainValidationError("Payment currency does not match invoice currency")`.
  - HTTP layer maps to HTTP 422. Main flow terminates.

### Postconditions
- Payment record is permanently appended to the invoice payment ledger.
- Invoice balance and status are updated.
- Client reliability metrics and risk tier are updated.
- If fully settled, invoice status is `PAID` and open actions are cancelled.

---

## Use Case 3: Run Daily Check

- **Primary Actor:** Scheduler (simulated) or Account Owner
- **Scope:** DuePing Collections Subsystem
- **Level:** System Automated Process
- **Stakeholders & Interests:**
  - *Account Owner:* Needs automated early warning of overdue invoices and broken promises without manual monitoring.

### Preconditions
1. System clock or simulated clock provides the current evaluation date `today`.

### Main Success Flow
1. Scheduler or user triggers `POST /api/system/daily-check`.
2. System invokes `DailyCheckService.run()`.
3. System obtains current date `today` from injected `Clock` port.
4. System queries `InvoiceRepository.list_active()` to retrieve all invoices in `SENT`, `PARTIALLY_PAID`, or `DISPUTED` status.
5. For each active invoice:
   a. **Overdue Evaluation:**
      - Calls `invoice.flag_overdue_if_needed(today)`.
      - If `today > due_date` and `overdue_notified == False`:
        - Flags `overdue_notified = True`.
        - Stages `InvoiceBecameOverdue` domain event.
   b. **Promise Commitment Check:**
      - Calls `invoice.check_promises(today)`.
      - For each pending promise where `promised_date < today`:
        - Marks promise as `MISSED`.
        - Stages `PromiseMissed` domain event.
   c. **Aging Blocker Check:**
      - Inspects unresolved blockers open for $\ge 7$ days to generate escalation alerts.
   d. **Persistence & Event Dispatch:**
      - If any domain events were staged, system saves invoice aggregate and publishes events via `EventBus`.
6. `NotificationListener` creates system notifications for missed promises and newly overdue invoices.
7. `ReliabilityListener` handles `PromiseMissed`, incrementing `broken_promises_count` and degrading client reliability score.
8. `ActionGenerationListener` generates urgent follow-up tasks for broken commitments and overdue accounts.
9. System compiles and returns `DailyCheckSummary` containing counts of evaluated invoices, newly overdue accounts, and breached promises.

### Extensions (Alternate Flows)
- **4a. No Active Invoices:**
  - System returns `DailyCheckSummary` with zeros for all counts. Process completes successfully.

### Postconditions
- Newly overdue invoices are flagged and notified.
- Expired promises are marked `MISSED` and client reliability is degraded.
- High-priority follow-up actions are injected into the Action Centre.
- A summary report of the check run is returned.
