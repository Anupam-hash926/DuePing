# Deviations, Additions and Assumptions

## Deviations from the Original Spec

| # | Spec section | What changed | Why | Impact |
|---|---|---|---|---|
| **DEV-1** | Section 12 (Facade) | `CollectionFacade` currently implements coordination directly (~497 lines) prior to the Phase 4 modular service extraction. | Kept early phases consolidated until concurrency and transaction boundaries were hardened. | Planned for decomposition into sub-services in Phase 4 while maintaining facade interface stability. |
| **DEV-2** | Section 15.6 (Seed Data) | Historical seed invoices use mnemonic human-readable numbers (`INV-OL-07`, `INV-GL-05`, `INV-SR-11`) instead of strictly `DP-YYYY-NNNN`. | Facilitates unambiguous visual verification during the 9-step interactive demo script. | New invoices created via `InvoiceFactory` strictly follow `DP-YYYY-NNNN`. |
| **DEV-3** | Section 10.3 (Reminders) | `ReminderTone` implements 3 explicit escalation tones: `POLITE`, `FIRM`, `FINAL` (omitted `GENTLE`). | Three distinct tones provide clear operational differentiation without confusing overlapping templates. | Reminders progress from `POLITE` (early overdue) to `FIRM` (aging/blockers) to `FINAL` (breached promises/legal). |
| **DEV-4** | Section 6.2 (State Machine) | `OVERDUE` is modeled as a dynamic temporal query (`is_overdue(today)`), not a concrete `InvoiceState` subclass. | Modeling clock changes as state machine transitions requires constant background polling and risks state desynchronization. | State classes stay pure and command-driven; daily check evaluates `is_overdue` and fires events. |

---

## Additions not in the Original Spec (Hardening & Quality Assurance)

| # | What was added | Why it was necessary |
|---|---|---|
| **ADD-1** | `test_forbidden_imports.py` | AST-based automated test to guarantee `backend/app/domain/` imports exclusively from Python standard library. |
| **ADD-2** | `test_docs_match_code.py` | AST and regex-based documentation drift test to prevent class, method, or enum drift between code and docs. |
| **ADD-3** | `POST /api/system/reset-demo` guarded by `DUEPING_ENABLE_RESET` | Programmatic reset endpoint allowing automated integration tests and browser demos to reseed test state; returns 404 in production mode unless explicitly enabled. |
| **ADD-4** | `TRACEABILITY.md`, `CRC_CARDS.md`, `USE_CASE_SPECS.md` | Formal OOAD documentation artifacts linking use cases, classes, patterns, and test suites. |
| **ADD-5** | `_ActiveState` hierarchy base class | Extracted shared transitions (`mark_disputed`, `write_off`) and operations set for active states (`SentState`, `PartiallyPaidState`, `DisputedState`). |
| **ADD-6** | Complete event audit trail | Added `ActionRescheduled`, `DocumentRemoved`, and `ActionsCancelled` domain events to provide complete traceability for all lifecycle mutations. |

---

## Assumptions Made for Ambiguities

| # | Ambiguity | Assumption chosen (simplest consistent) |
|---|---|---|
| **ASM-1** | Multi-currency transactions | Invoices and payments enforce matching currencies; cross-currency payments reject with `DomainValidationError`. |
| **ASM-2** | Sequential invoice numbering | `InvoiceFactory` partitions sequence numbering per calendar year (`DP-{year}-{sequence:04d}`). |
| **ASM-3** | Default communication channel | When an action or follow-up does not specify a channel, `Channel.EMAIL` is used as the system default. |
| **ASM-4** | Document storage | `SupportingDocument` records metadata (type, filename, path) in the domain; binary file upload is handled via external storage. |
