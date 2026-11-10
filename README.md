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
- **Commitment Tracking:** Manages first-class `PaymentPromise` lifecycles (`PENDING`, `KEPT`, `MISSED`, `SUPERSEDED`), empirically deriving client `reliability_score` (0–100%) and risk ratings (`LOW`, `MEDIUM`, `HIGH`).
- **Action Centre:** Ranks follow-up tasks using swappable prioritization strategies (`risk_weighted`, `amount_first`, `oldest_first`).
- **Tone-Escalated Reminders:** Automatically selects and renders reminders (`GENTLE`, `POLITE`, `FIRM`, `FINAL`) mentioning blockers and broken promises.

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
| **State** | Manages invoice state transitions (`DRAFT`, `SENT`, `PARTIALLY_PAID`, `DISPUTED`, `PAID`, `WRITTEN_OFF`) and state-gated operations. | `InvoiceState`, `DraftState`, `SentState`, `DisputedState`, etc. | `domain/invoice_state.py` |
| **Strategy (Prioritization)** | Swappable Action Centre ranking algorithms. | `PrioritizationStrategy`, `RiskWeightedStrategy`, `LargestAmountStrategy`, `OldestFirstStrategy` | `application/prioritization.py` |
| **Strategy (Playbook)** | Maps structured blocker reasons to recommended next actions. | `ResolutionStrategy`, `MissingPOResolution`, `ApprovalResolution`, `DisputeResolution`, etc. | `application/playbook.py` |
| **Template Method** | Consistent reminder structure with tone-specific copy. | `ReminderMessage`, `GentleReminder`, `PoliteReminder`, `FirmReminder`, `FinalDemand` | `application/reminders.py` |
| **Factory (Invoice)** | Aggregate instantiation, unique sequential numbering (`DP-YYYY-NNNN`). | `InvoiceFactory` | `application/invoice_factory.py` |
| **Factory (Reminder)** | Selects reminder tone based on days overdue and escalation level. | `ReminderFactory` | `application/reminders.py` |
| **Adapter** | Normalizes heterogeneous CSV source schemas into domain row format. | `InvoiceSource`, `CsvInvoiceSource` | `application/importing.py` |
| **Chain of Responsibility** | Composable validation pipeline for batch imported rows. | `RowValidator`, `RequiredFieldsValidator`, `EmailValidator`, `AmountValidator`, etc. | `application/importing.py` |
| **Observer** | Decouples aggregate mutations from audit, actions, reliability, and notifications. | `EventBus`, `AuditLogListener`, `ActionGenerationListener`, `ReliabilityListener`, `NotificationListener` | `application/event_bus.py`, `application/listeners.py` |
| **Facade** | Single entry point simplifying application subsystem coordination. | `CollectionFacade` | `application/facade.py` |
| **Repository** | Pure domain ports implemented with transactional SQLAlchemy 2.0 ORM. | `InvoiceRepository`, `ClientRepository`, `SqlAlchemyInvoiceRepository` | `application/ports.py`, `infrastructure/sqlalchemy_repositories.py` |

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

# Seed the historical demo database (seeds 13 invoices and 5 clients)
PYTHONPATH=. .venv/bin/python -m app.infrastructure.seed

# Start the FastAPI backend server
uvicorn app.api.main:app --reload --host 0.0.0.0 --port 8000
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
```
- Access the web application at: `http://localhost:5173`

---

## Running the Test Suite & Verification

The project includes unit tests, forbidden-import boundary verifications, repository contract suites, and full-flow API integration tests:

```bash
cd backend
source .venv/bin/activate

# Run all 254 tests with code coverage report
PYTHONPATH=. .venv/bin/pytest tests/ --cov=app --cov-report=term-missing

# Run domain isolation / forbidden imports test
PYTHONPATH=. .venv/bin/pytest tests/domain/test_forbidden_imports.py

# Run repository contract tests (SQLite & In-Memory)
PYTHONPATH=. .venv/bin/pytest tests/infrastructure/test_repository_contracts.py

# Run full-flow API & error-mapping tests
PYTHONPATH=. .venv/bin/pytest tests/api/test_api_flow.py -v
```

**Test Coverage Benchmark:** 254 passed in ~1.65s with **96% line coverage**.

---

## End-to-End Scripted Demo Walkthrough

Follow this scripted 9-step demo (Section 17.2) directly in the browser UI at `http://localhost:5173`:

1. **Step 1 — Action Centre & Ranking:**
   - Open `/` (home page). Notice the ranked cards due today.
   - Use the **Rank by** dropdown to switch between *"Risk-weighted"* and *"Largest amount first"*. Observe how cards reorder based on the active strategy.
2. **Step 2 — Inspect Orbit Labs (Invoice 7):**
   - Click on `INV-OL-07` (or navigate via Invoices).
   - Observe the open `WRONG_DETAILS` blocker and its generated NextAction. Note the `PENDING` promise scheduled for date *T+3*.
3. **Step 3 — Advance Simulated Date & Run Daily Check:**
   - In the topbar date control, set the date to *T+4* and click **Set** (activating the `SIMULATED` badge).
   - Click **⚡ Run Daily Check**.
   - Notice the toast summary reporting missed promises. Refresh the page: the promise is now marked `MISSED`, a `HIGH` priority action appears, a notification bell item is created, and Orbit Labs' reliability score drops to `0%`.
4. **Step 4 — Tone-Escalated Reminder:**
   - On `INV-OL-07`, scroll to the **Reminder Generator** panel.
   - The tone automatically defaults to `FIRM` (or `FINAL`). Observe that the rendered message explicitly mentions the `WRONG_DETAILS` blocker and the missed promise commitment.
   - Click **📋 Copy to Clipboard**, then click **Mark as Sent**. Note that the reminder escalation level increments to Level 1.
5. **Step 5 — Record Partial Payment on Disputed Invoice & Resolve Dispute:**
   - Open invoice `INV-GL-05` (Greenleaf Foods, status: `DISPUTED`).
   - Click **+ Record Payment**, enter `20000.00`, and save. Notice the status remains `DISPUTED` while under investigation.
   - Click **Resolve** on the `DISPUTED_AMOUNT` blocker. Observe the invoice status transition automatically back to `PARTIALLY_PAID` and the dispute action cancelled.
6. **Step 6 — Settle Invoice 11 (Sunrise Retail):**
   - Open invoice `INV-SR-11` (overdue 100 days).
   - Click **+ Record Payment**, enter the remaining balance (`22000.00`), and submit.
   - The invoice transitions to `PAID`, all pending actions are automatically cancelled, and a payment notification fires.
7. **Step 7 — Inspect Collection Dashboard:**
   - Navigate to `/dashboard`.
   - Observe the updated total outstanding, 5-bucket aging bar chart, 6-month collection trend line, and top debtors table.
8. **Step 8 — Batch CSV Import:**
   - Navigate to `/import`. Click **📥 Download Sample CSV** (or upload `frontend/public/sample_invoices.csv`).
   - Click **Import Invoices**.
   - Review the result: exactly **2 rows imported** and **2 rows rejected** with descriptive validation error rows displayed.
9. **Step 9 — Verify Immutable Audit Ledger:**
   - Navigate to `/audit`.
   - Review the append-only event ledger capturing every event triggered during the demo (`InvoiceSent`, `BlockerRaised`, `PromiseMissed`, `PaymentReceived`, `InvoicePaid`, etc.).

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
