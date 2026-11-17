# Deviations, Additions and Assumptions

## Deviations from the Original Spec

| # | Spec section | What changed | Why | Impact |
|---|---|---|---|---|
| **DEV-1** | Section 12 (Facade) | `CollectionFacade` decomposed into cohesive delegate services (`InvoiceCommands`, `ClientService`, `ReminderService`, `SystemService`), reducing facade to <!-- metric:facade_lines=135 -->135 lines with 8 constructor dependencies. | Avoids God Object anti-pattern while maintaining 100% backwards compatibility for API callers and tests. | Clean separation of concerns; mutations protected by optimistic locking retry loops. |
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
| **ADD-7** | Optimistic locking on Invoices | Added `version: int = 0` to `Invoice`, checked on save in repositories, mapped to 409 `ConcurrencyConflict`, with `mutate_invoice` retry helper. |
| **ADD-8** | Thread-safe `EventBus` | Thread-safe subscription registry with `threading.RLock`, reentrancy queue and dispatch state in `threading.local()`, and failure buffer in `collections.deque(maxlen=100)`. |
| **ADD-9** | Visible listener failures | Port `FailureLogRepository` and endpoint `GET /api/system/failures` to track listener exceptions without failing unrelated handlers or silently swallowing errors. |
| **ADD-10**| Pagination and cheap query filtering | Added `limit`/`offset` and `X-Total-Count` headers to `/api/invoices`, `/api/audit-log`, `/api/notifications`, and added `list_active_with_pending_actions()` to avoid loading unnecessary aggregates in ActionCenter. |
| **ADD-11**| React Query data layer | Replaced `window.dispatchEvent('dueping:refresh')` and manual `useEffect` fetchers with `@tanstack/react-query` and declarative invalidation hooks. |
| **ADD-12**| Strict $\le$ 250-line component architecture | Decomposed large monolithic pages (`InvoiceDetailPage` from 1,261 lines into 10 modular panels; `NewInvoicePage` with extracted client sheet) with max component size $\le$ 238 lines. |
| **ADD-13**| iOS 7 / Apple Design System & Tokens | Standardized on tokens CSS variables (`--tint: #007AFF`, `--bg-grouped`, hairlines, squircle radiuses), eliminating hardcoded `slate-*`/`indigo-*` utility classes. |
| **ADD-14**| Route-level code splitting | Implemented `React.lazy` across all application and landing routes, reducing initial core bundle to 160 kB gzipped and landing page to 11 kB gzipped. |
| **ADD-15**| Stale-free Action Descriptions & `suggested_tone` | Replaced baked day count and tone strings in stored action descriptions with static formats; added dynamic `suggested_tone` on `ActionCenterItem` evaluated by `ReminderFactory`. |
| **ADD-16**| UI Labels Dictionary & Dynamic Currency Hook | Introduced `src/lib/labels.ts` (human-readable event types and enums with pluralization) and `src/lib/useCurrency.ts` (retrieves default currency from user settings) across all UI screens. |
| **ADD-17**| Disambiguated `ProgressRing` & `PingMark` | Separated radar pulse mark (`PingMark`) from circular SVG reliability indicator (`ProgressRing`) with backwards-compatible aliases, accessible image semantics, and reduced-motion fallback. |
| **ADD-18**| Non-linear Stepper Branching | Updated `StatusStepper` so `DISPUTED` and `WRITTEN_OFF` do not appear as steps on the linear progression track; instead freezes on prior state (`SENT` or `PARTIALLY_PAID`) and renders dedicated status branch banner. |
| **ADD-19**| Strict Draft Invoice Validation | Enforced client selection, positive amounts, and chronological date boundaries (`dueDate >= issueDate`) with disabled submit and inline error indicator on `NewInvoicePage`. |
| **ADD-20**| Automated Axe A11y Suite | Integrated `@axe-core/playwright` WCAG 2.1 AA checks across 5 core routes with 0 serious/critical violations, fixing missing progressbar labels and nested interactive controls. |
| **ADD-21**| Theme Override Controls | Added System / Light / Dark appearance switcher in Demo popover backed by `localStorage` and WCAG AA contrast compliant color tokens across light and dark modes. |
| **ADD-22**| 0 Skipped Tests Guarantee | Isolated SQLite constraint tests from generic repository contract suite to achieve 100% test execution (0 skipped tests). |
| **ADD-23**| Disputed / Overdue List Row Accents | Added thin danger (`border-l-danger`) and warning (`border-l-warning`) left accents on overdue and disputed invoices in `InvoicesPage`. |
| **ADD-24**| Action Reopen Lifecycle & Event | Implemented `NextAction.reopen()`, `Invoice.reopen_action()`, `ActionReopened` domain event, and `POST /invoices/{id}/actions/{aid}/reopen` allowing completed actions to revert to `PENDING`. |
| **ADD-25**| Undo Toast on Today | Integrated interactive "Marked done · Undo" toast with a 5-second window on Today, allowing immediate rollback of completed actions. |
| **ADD-26**| Empty-Database Onboarding Card | Added 3-step guide (Add client → Create invoice → Send and track) and 1-click "Load demo data" shortcut when zero invoices exist in the workspace. |
| **ADD-27**| Command Palette Action Shortcuts | Added direct `⌘K` command items for "Open invoice {number}" and "Record payment on {number}". |
| **ADD-28**| Debtor Reliability in Dashboard | Added a nullable reliability score to each dashboard debtor row so its ring shows the client's real score and threshold color instead of a synthetic full ring. The report field is additive and omitted from the visual only when the client record is unavailable. |
| **ADD-29**| Cross-platform E2E and CI | Added a temporary-database backend launcher for Playwright, strict demo reset/payment/notification assertions, configurable API/web/screenshot paths, landing interaction and theme-capture checks (including New Invoice), and a CI E2E job with Chromium and HTML report upload. E2E API requests now follow the configured API port, and the demo flow waits for the simulated-date update before running checks. Theme screenshot assertions exposed undefined fill colors; shared token aliases and Tailwind mappings now restore the dashboard reliability arc and severity colors. The newly visible dashboard colors also exposed low-contrast fractional amounts, so their unnecessary opacity was removed. `pytest -rs` found 0 skipped tests (309 passed), so no skipped tests required removal or environment changes. |

---

## Assumptions Made for Ambiguities

| # | Ambiguity | Assumption chosen (simplest consistent) |
|---|---|---|
| **ASM-1** | Multi-currency transactions | Invoices and payments enforce matching currencies; cross-currency payments reject with `DomainValidationError`. |
| **ASM-2** | Sequential invoice numbering | `InvoiceFactory` partitions sequence numbering per calendar year (`DP-{year}-{sequence:04d}`). |
| **ASM-3** | Default communication channel | When an action or follow-up does not specify a channel, `Channel.EMAIL` is used as the system default. |
| **ASM-4** | Document storage | `SupportingDocument` records metadata (type, filename, path) in the domain; binary file upload is handled via external storage. |
