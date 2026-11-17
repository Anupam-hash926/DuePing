# DuePing v2 — Resolution-First Payment Follow-up & Collections System

> **OOAD Design & Implementation Specification Implementation**  
> An opinionated, domain-driven architecture modeling *why* invoices remain unpaid through structured blockers and playbooks, rather than relying on linear time-based reminders.

---

## Table of Contents

1. [System Overview & Architecture](#system-overview--architecture)  
2. [Design Patterns Applied](#design-patterns-applied)  
3. [Setup & Installation](#setup--installation)  
   - [Backend Setup (FastAPI & SQLite)](#backend-setup)  
   - [Frontend Setup (React + Vite + Tailwind)](#frontend-setup)  
4. [Running the Test Suite & Verification](#running-the-test-suite--verification)  
5. [End-to-End Scripted Demo Walkthrough](#end-to-end-scripted-demo-walkthrough)  
6. [Project Phases & Status](#project-phases--status)  

---

## System Overview & Architecture

DuePing replaces generic calendar-based nagging with a resolution-first collections process:
- **Root Cause Modeling:** Invoices track structured `PaymentBlocker`s (`MISSING_PO`, `AWAITING_APPROVAL`, `DISPUTED_AMOUNT`, `WRONG_DETAILS`, `MISSING_DOCUMENTS`, `NO_RESPONSE`, `OTHER`).
- **Resolution Playbook:** Automatically maps blockers to concrete, actionable `NextAction`s.
- **Commitment Tracking:** Manages first-class `PaymentPromise` lifecycles (`PENDING`, `KEPT`, `MISSED`), empirically deriving client `reliability_score` (0–100%) and risk ratings (`LOW`, `MEDIUM`, `HIGH`).
- **Action Centre:** Ranks follow-up tasks using swappable prioritization strategies (`risk_weighted`, `amount_first`, `oldest_first`).
- **Tone-Escalated Reminders:** Automatically selects and renders reminders (`POLITE`, `FIRM`, `FINAL`) mentioning blockers and broken promises.

### Clean / Hexagonal Layer Architecture
The project strictly enforces the dependency rule: `api → application → domain` and `infrastructure → application + domain`. The domain layer is pure Python with **zero external dependencies** (no FastAPI, SQLAlchemy, or Pydantic).

```
API (FastAPI) ─────────► Application (Facade, Use-cases, EventBus) ─────────► Domain (Pure Python Entities, Value Objects)
                             ▲                                                      ▲
                             │                                                      │
                       Infrastructure (SQLAlchemy 2.x, SQLite, Repositories, Mappers, Seed)
```

- **Domain:** [`backend/app/domain/`](backend/app/domain/)
- **Application:** [`backend/app/application/`](backend/app/application/)
- **Infrastructure:** [`backend/app/infrastructure/`](backend/app/infrastructure/)
- **API:** [`backend/app/api/`](backend/app/api/)
- **Frontend:** [`frontend/`](frontend/)
- **UML & Docs:** [`docs/uml/`](docs/uml/), [`docs/REPORT_NOTES.md`](docs/REPORT_NOTES.md), [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md)

---

## Design Patterns Applied

| Pattern | Role in System | Key Classes | Location |
|---|---|---|---|
| **State** | Manages invoice state transitions (`DRAFT`, `SENT`, `PARTIALLY_PAID`, `DISPUTED`, `PAID`, `WRITTEN_OFF`) and state-gated operations. | `InvoiceState`, `DraftState`, `SentState`, `PartiallyPaidState`, `DisputedState`, `PaidState`, `WrittenOffState` | `domain/invoice_state.py` |
| **Strategy (Prioritization)** | Swappable Action Centre ranking algorithms. | `PrioritizationStrategy`, `AmountFirstStrategy`, `OldestFirstStrategy`, `RiskWeightedStrategy`, `PrioritizationRegistry` | `application/prioritization.py` |
| **Strategy (Playbook)** | Maps structured blocker reasons to recommended next actions. | `ResolutionStrategy`, `MissingPOResolution`, `ApprovalResolution`, `DisputeResolution`, `WrongDetailsResolution`, `MissingDocumentsResolution`, `NoResponseResolution`, `OtherResolution`, `ResolutionPlaybook` | `application/playbook.py` |
| **Template Method** | Consistent reminder structure with tone-specific copy. | `ReminderMessage`, `PoliteReminder`, `FirmReminder`, `FinalNoticeReminder` | `application/reminders.py` |
| **Factory (Invoice)** | Aggregate instantiation, unique sequential numbering (`DP-YYYY-NNNN`). | `InvoiceFactory` | `application/invoice_factory.py` |
| **Factory (Reminder)** | Selects reminder tone (`POLITE`, `FIRM`, `FINAL`) based on days overdue and escalation level. | `ReminderFactory` | `application/reminders.py` |
| **Adapter** | Normalizes heterogeneous CSV source schemas into domain row format. | `InvoiceSource`, `CsvInvoiceSource`, `InvoiceSourceFactory` | `application/importing.py` |
| **Chain of Responsibility** | Composable validation pipeline for batch imported rows. | `RowValidator`, `RequiredFieldsValidator`, `ClientDataValidator`, `DateValidator`, `AmountValidator`, `StatusValidator`, `DuplicateInvoiceNumberValidator` | `application/importing.py` |
| **Observer** | Decouples aggregate mutations from audit, actions, reliability, and notifications. | `EventBus`, `AuditLogListener`, `ActionGenerationListener`, `ReliabilityListener`, `NotificationListener` | `application/event_bus.py`, `application/listeners.py` |
| **Facade** | Single entry point simplifying application subsystem coordination. | `CollectionFacade` | `application/facade.py` |
| **Repository** | Pure domain ports implemented with transactional SQLAlchemy 2.0 ORM. | `InvoiceRepository`, `ClientRepository`, `ProjectRepository`, `AuditRepository`, `NotificationRepository`, `SettingsRepository`, `SqlAlchemyInvoiceRepository` | `application/ports.py`, `infrastructure/sqlalchemy_repositories.py` |

---

## Setup & Installation

### Backend Setup
**Requirements:** Python 3.11+ (Python 3.12/3.13 recommended)

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy example environment configuration
cp .env.example .env

# Seed the historical demo database (seeds 13 invoices and 5 clients)
PYTHONPATH=. .venv/bin/python -m app.infrastructure.seed

# Start the FastAPI backend server (with demo reset enabled)
DUEPING_ENABLE_RESET=1 PYTHONPATH=. .venv/bin/uvicorn app.api.main:app --reload --host 0.0.0.0 --port 8000
```
- API root: `http://localhost:8000`
- Interactive OpenAPI / Swagger docs: `http://localhost:8000/docs`

### Frontend Setup
**Requirements:** Node.js 18+ and npm 9+

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server (proxies /api to http://localhost:8000)
npm run dev

# Run Playwright E2E & Accessibility Tests (auto-starts backend & frontend)
npm run e2e
```
- Access the web application at: `http://localhost:5173`

---

## Running the Test Suite & Verification

The project includes domain unit tests, forbidden-import architectural boundary verifications, repository contract suites, full-flow API integration tests, and Playwright end-to-end / accessibility suites:

```bash
# Using the Makefile
make test  # runs both backend pytest with coverage and frontend vitest
make lint  # runs ruff, mypy, tsc, and eslint

# Playwright End-to-End & Axe A11y tests
cd frontend && npm run e2e

# Or directly in backend:
cd backend
PYTHONPATH=. .venv/bin/pytest tests/ --cov=app --cov-report=term-missing

# And in frontend:
cd frontend
npm test -- --run
npm run lint
```

**Test Coverage Benchmark:** **<!-- metric:backend_tests=308 -->308 backend tests passed** in ~1.4s with **<!-- metric:coverage_pct=96 -->96% line coverage** (0 skipped), **<!-- metric:frontend_tests=36 -->36 frontend unit tests passed**, and **13 Playwright E2E and Axe WCAG 2.1 AA accessibility tests passed**.

### Database Reset Note (Schema Hardening)
The application database includes hardened schemas:
1. `version` column on invoices enforcing optimistic locking against concurrent edits.
2. `unique` email constraint on clients preventing duplicates.
3. `handler_failures` ledger recording asynchronous event delivery errors.

To reset the database cleanly from scratch:
```bash
make seed
# Or: rm -f backend/dueping.db && PYTHONPATH=. backend/.venv/bin/python -m app.infrastructure.seed
```

---

## End-to-End Scripted Demo Walkthrough

Follow this scripted 9-step demo directly in the browser UI at `http://localhost:5173`:

1. **Step 1 — Action Centre & Ranking (`/app`):**
   - Open `/` (landing page) and click **Open the app** to reach `/app`. Notice the ranked items due today and count-up stake summary.
   - Use the strategy **Segmented Control** to switch between *"Risk-Weighted"*, *"Largest Amount"*, and *"Most Overdue"*. Observe how the FocusCard and Up Next list reorder based on the active strategy.
2. **Step 2 — Inspect Orbit Labs (Invoice 7):**
   - Click on `INV-OL-07` (or navigate via Invoices).
   - Observe the open `WRONG_DETAILS` blocker and its generated NextAction connected by a tint line. Note the `PENDING` promise scheduled for date *T+3*.
3. **Step 3 — Advance Simulated Date & Run Daily Check:**
   - In the topbar Demo popover (lightning icon), set the date to *T+4* and click **Set Date** (activating the `SIMULATED` badge).
   - Click **Run Daily Check**.
   - Notice the toast summary reporting missed promises. The promise is now marked `MISSED`, a `CRITICAL` priority action appears, a notification bell item is created, and Orbit Labs' reliability score drops.
4. **Step 4 — Tone-Escalated Reminder:**
   - On `INV-OL-07`, switch to the **Reminder** tab.
   - The tone automatically defaults to `FIRM` (or `FINAL`). Observe that the rendered message explicitly mentions the blocker and any missed promise commitment.
   - Click **Copy Text**, then click **Mark as Sent**.
5. **Step 5 — Record Partial Payment on Disputed Invoice & Resolve Dispute:**
   - Open invoice `INV-GL-05` (Greenleaf Foods, status: `DISPUTED`).
   - Click **Record payment**, enter `20000.00`, and save. Notice the status remains `DISPUTED` while under investigation.
   - Click **Resolve** on the `DISPUTED_AMOUNT` blocker. Observe the invoice status transition automatically back to `PARTIALLY_PAID` and the dispute action cancelled.
6. **Step 6 — Settle Invoice 11 (Sunrise Retail):**
   - Open invoice `INV-SR-11` (overdue 100 days).
   - Click **Record payment**, enter the remaining balance (`22000.00`), and submit.
   - The invoice transitions to `PAID`, all pending actions are automatically cancelled, and a payment notification fires.
7. **Step 7 — Inspect Collection Dashboard:**
   - Navigate to `/app/dashboard`.
   - Observe the updated 3 big count-up numerals, 5-bucket aging bar with soft teal-to-red gradient, 6-month SVG collection trend sparkline, and top debtors list.
8. **Step 8 — Batch CSV Import:**
   - Navigate to `/app/import`. Click **Download sample CSV** (or upload `frontend/public/sample_invoices.csv`).
   - Click **Start Import**.
   - Review the result: exactly **2 rows imported** and **2 rows rejected** with descriptive validation error rows displayed.
9. **Step 9 — Verify Immutable Audit Ledger:**
   - Navigate to `/app/audit`.
   - Review the append-only event ledger grouped by day with sticky headers capturing every event triggered during the demo (`InvoiceSent`, `BlockerRaised`, `PromiseMissed`, `PaymentReceived`, `InvoicePaid`, etc.).

---

## Project Phases & Status

| Phase | Description | Deliverables | Status |
|---|---|---|---|
| **Phase 0** | Scaffold & UML | Clean architecture layout, 9 UML diagrams (`docs/uml/`), `pytest.ini`, `requirements.txt`, Vite project | ✅ Complete |
| **Phase 1** | Domain Layer | 15 domain modules, `Money` value object, `InvoiceState` machine, zero external imports | ✅ Complete |
| **Phase 2** | Ports & Patterns | Repository ports, `SimulatedClock`, `ResolutionPlaybook`, `PrioritizationRegistry`, `ReminderFactory`, `InvoiceImporter` | ✅ Complete |
| **Phase 3** | Events & Facade | `EventBus`, 4 concrete listeners, `ActionCenter`, `ReportService`, `DailyCheckService`, `CollectionFacade` | ✅ Complete |
| **Phase 4** | Persistence | SQLAlchemy 2.x ORM models, mappers, full-aggregate repositories, parameterized contract tests | ✅ Complete |
| **Phase 5** | API & Seed | 31 REST endpoints, error mapping (404/409/422), historical time-travel seed script, API flow tests | ✅ Complete |
| **Phase 6** | Frontend | React 18, TypeScript, Tailwind CSS, Recharts dashboard, 6 interactive pages, zero `any` types | ✅ Complete |
| **Phase 7** | Polish & Docs | Technical report notes ([`docs/REPORT_NOTES.md`](docs/REPORT_NOTES.md)), deviation tracking ([`docs/DEVIATIONS.md`](docs/DEVIATIONS.md)), README | ✅ Complete |
| **Phase 11**| Hardening & Polish | Stale-free actions, dynamic currencies, WCAG 2.1 AA a11y, 12 Playwright E2E tests, theme switcher, zero skipped tests | ✅ Complete |

---

## Known Limitations

1. **Single-User Architecture:** Designed for single-tenant small business / finance operations without multi-tenant RBAC or authentication tokens.
2. **Synchronous In-Process Event Pipeline:** The thread-safe `EventBus` dispatches events synchronously to registered listeners with eventual consistency and bounded in-memory failure logging (`GET /api/system/failures`), rather than through an external distributed queue (such as Celery or RabbitMQ).
3. **SQLite Concurrency Model:** Uses SQLite in WAL mode with connection-level foreign keys enabled (`PRAGMA foreign_keys=ON`) and optimistic concurrency locking (`version` column). While suitable for demonstration and small operational teams, enterprise multi-writer scale would migrate to PostgreSQL using the existing SQLAlchemy ORM mapping.
