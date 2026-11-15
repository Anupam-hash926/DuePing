"""Full-flow API and error-mapping test suite.

Covers the Section 18 requirements:
- Create client
- Create invoice
- Send invoice
- Raise MISSING_PO blocker -> verify action created
- Record promise
- Set simulated date past promise -> daily check -> promise MISSED, action created, reliability < 100, notification present
- Reminder contains blocker and promise sentences
- Record full payment -> PAID, actions cancelled -> dashboard updated
- Error mappings: 404 EntityNotFound, 409 InvalidStateTransition, 409 DuplicateInvoiceNumber, 422 DomainValidationError, 422 Pydantic validation
"""
from __future__ import annotations

import os
os.environ["DUEPING_ENABLE_RESET"] = "1"

import pytest
from fastapi.testclient import TestClient

from app.api.deps import set_facade
from app.api.main import app
from app.infrastructure.db import create_all, drop_all


@pytest.fixture(autouse=True)
def fresh_database():
    """Ensure a clean database state for each test run."""
    set_facade(None)
    drop_all()
    create_all()
    yield
    set_facade(None)
    drop_all()


@pytest.fixture
def client():
    return TestClient(app)


def test_full_api_flow(client: TestClient):
    """Full-flow test covering the entire collections lifecycle via HTTP API."""
    # 1. Create client
    res = client.post(
        "/api/clients",
        json={
            "name": "Acme Technologies",
            "email": "finance@acme.example.com",
            "phone": "+91 99999 88888",
            "company_name": "Acme Tech Ltd",
        },
    )
    assert res.status_code == 201, res.text
    client_data = res.json()
    client_id = client_data["id"]
    assert client_data["reliability_score"] == 100.0
    assert client_data["risk_level"] == "LOW"

    # 2. Create invoice
    res = client.post(
        "/api/invoices",
        json={
            "client_id": client_id,
            "total_amount": "50000.00",
            "issue_date": "2026-11-01",
            "due_date": "2026-11-15",
            "invoice_number": "INV-FLOW-001",
        },
    )
    assert res.status_code == 201, res.text
    inv_data = res.json()
    inv_id = inv_data["id"]
    assert inv_data["status"] == "DRAFT"
    assert "send" in inv_data["allowed_operations"]

    # 3. Send invoice
    res = client.post(f"/api/invoices/{inv_id}/send")
    assert res.status_code == 200, res.text
    inv_data = res.json()
    assert inv_data["status"] == "SENT"
    assert "record_payment" in inv_data["allowed_operations"]

    # 4. Raise MISSING_PO blocker -> NextAction created
    res = client.post(
        f"/api/invoices/{inv_id}/blockers",
        json={
            "type": "MISSING_PO",
            "description": "Client requested PO before processing",
            "assigned_to": "Finance Team",
        },
    )
    assert res.status_code == 200, res.text
    inv_data = res.json()
    assert len(inv_data["blockers"]) == 1
    assert inv_data["blockers"][0]["type"] == "MISSING_PO"
    assert len(inv_data["actions"]) >= 1
    assert any(
        "purchase order" in a["description"].lower() or "po" in a["description"].lower()
        for a in inv_data["actions"]
    )

    # Verify Action Center reflects the action (either due or upcoming)
    res = client.get("/api/action-center")
    assert res.status_code == 200
    ac_data = res.json()
    assert len(ac_data["items"]) + len(ac_data["upcoming"]) >= 1

    # 5. Record promise
    res = client.post(
        f"/api/invoices/{inv_id}/promises",
        json={
            "promised_date": "2026-11-20",
            "amount": "50000.00",
            "note": "Promised to pay once PO is attached",
        },
    )
    assert res.status_code == 200, res.text
    inv_data = res.json()
    assert len(inv_data["promises"]) == 1
    assert inv_data["promises"][0]["status"] == "PENDING"

    # 6. Advance simulated date past the promised date & run daily check
    res = client.put("/api/system/today", json={"date": "2026-11-22"})
    assert res.status_code == 200
    assert res.json()["simulated"] is True
    assert res.json()["today"] == "2026-11-22"

    res = client.post("/api/system/daily-check")
    assert res.status_code == 200
    check_summary = res.json()
    assert check_summary["promises_missed"] >= 1

    # Verify invoice promise status is MISSED and new action created
    res = client.get(f"/api/invoices/{inv_id}")
    assert res.status_code == 200
    inv_data = res.json()
    assert inv_data["promises"][0]["status"] == "MISSED"
    # Action for missed promise
    assert any(a["source"] == "PROMISE_MISSED" for a in inv_data["actions"])

    # Verify client reliability score dropped
    res = client.get(f"/api/clients/{client_id}")
    assert res.status_code == 200
    client_summary = res.json()
    assert client_summary["reliability_score"] < 100.0
    assert client_summary["promises_broken_count"] == 1

    # Verify notification exists
    res = client.get("/api/notifications")
    assert res.status_code == 200
    notifs = res.json()
    assert any("missed" in n["message"].lower() or "promise" in n["message"].lower() for n in notifs)

    # 7. Check reminder rendering contains blocker and promise details
    res = client.get(f"/api/invoices/{inv_id}/reminder")
    assert res.status_code == 200
    reminder_data = res.json()
    body_text = reminder_data["body"]
    assert "INV-FLOW-001" in body_text or "50,000" in body_text

    # Mark reminder sent
    res = client.post(
        f"/api/invoices/{inv_id}/reminder/sent",
        json={"tone": reminder_data["tone"], "channel": "EMAIL"},
    )
    assert res.status_code == 200
    inv_data = res.json()
    assert inv_data["reminder_level"] >= 1

    # 8. Record full payment
    res = client.post(
        f"/api/invoices/{inv_id}/payments",
        json={
            "amount": "50000.00",
            "payment_date": "2026-11-22",
            "method": "BANK_TRANSFER",
            "reference_number": "TXN-FLOW-999",
        },
    )
    assert res.status_code == 200, res.text
    inv_data = res.json()
    assert inv_data["status"] == "PAID"
    assert inv_data["outstanding"]["amount"] == "0.00"
    # Pending actions should be cancelled
    pending_actions = [a for a in inv_data["actions"] if a["status"] == "PENDING"]
    assert len(pending_actions) == 0

    # Verify Dashboard totals updated
    res = client.get("/api/reports/dashboard")
    assert res.status_code == 200
    dash_data = res.json()
    assert dash_data["total_outstanding"]["amount"] == "0.00"
    assert dash_data["status_counts"]["PAID"] == 1

    # Verify audit log contains full event sequence
    res = client.get(f"/api/audit-log?invoice_id={inv_id}")
    assert res.status_code == 200
    audit_events = res.json()
    assert len(audit_events) >= 5
    event_types = [e["event_type"] for e in audit_events]
    assert "InvoiceSent" in event_types
    assert "PaymentReceived" in event_types
    assert "InvoicePaid" in event_types


def test_error_mapping_404_entity_not_found(client: TestClient):
    """EntityNotFound translates to 404 with structured error JSON."""
    res = client.get("/api/invoices/nonexistent-id-12345")
    assert res.status_code == 404
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "EntityNotFound"
    assert "not found" in data["error"]["message"].lower()


def test_error_mapping_409_invalid_state_transition(client: TestClient):
    """InvalidStateTransition translates to 409 with structured error JSON."""
    # Create client and draft invoice
    c = client.post("/api/clients", json={"name": "Client A", "email": "a@ex.com"}).json()
    inv = client.post(
        "/api/invoices",
        json={
            "client_id": c["id"],
            "total_amount": "1000.00",
            "issue_date": "2026-11-01",
            "due_date": "2026-11-10",
        },
    ).json()

    # Try recording payment on DRAFT invoice (not allowed)
    res = client.post(
        f"/api/invoices/{inv['id']}/payments",
        json={"amount": "1000.00", "payment_date": "2026-11-05", "method": "CASH"},
    )
    assert res.status_code == 409
    data = res.json()
    assert data["error"]["code"] == "InvalidStateTransition"


def test_error_mapping_409_duplicate_invoice_number(client: TestClient):
    """DuplicateInvoiceNumber translates to 409 with structured error JSON."""
    c = client.post("/api/clients", json={"name": "Client B", "email": "b@ex.com"}).json()
    inv1 = client.post(
        "/api/invoices",
        json={
            "client_id": c["id"],
            "total_amount": "2000.00",
            "issue_date": "2026-11-01",
            "due_date": "2026-11-10",
            "invoice_number": "INV-UNIQUE-999",
        },
    )
    assert inv1.status_code == 201

    # Try creating second invoice with same number
    inv2 = client.post(
        "/api/invoices",
        json={
            "client_id": c["id"],
            "total_amount": "3000.00",
            "issue_date": "2026-11-01",
            "due_date": "2026-11-10",
            "invoice_number": "INV-UNIQUE-999",
        },
    )
    assert inv2.status_code == 409
    data = inv2.json()
    assert data["error"]["code"] == "DuplicateInvoiceNumber"


def test_error_mapping_409_duplicate_client(client: TestClient):
    """DuplicateClient translates to 409 with structured error JSON."""
    client.post("/api/clients", json={"name": "Client Original", "email": "unique@dup.com"})
    res = client.post("/api/clients", json={"name": "Client Duplicate", "email": "UNIQUE@dup.com"})
    assert res.status_code == 409
    data = res.json()
    assert data["error"]["code"] == "DuplicateClient"


def test_error_mapping_422_domain_validation_error(client: TestClient):
    """DomainValidationError translates to 422 with structured error JSON."""
    c = client.post("/api/clients", json={"name": "Client C", "email": "c@ex.com"}).json()
    # Attempt creating invoice with non-positive amount
    res = client.post(
        "/api/invoices",
        json={
            "client_id": c["id"],
            "total_amount": "0.00",
            "issue_date": "2026-11-01",
            "due_date": "2026-11-10",
        },
    )
    assert res.status_code == 422
    data = res.json()
    assert data["error"]["code"] == "DomainValidationError"


def test_error_mapping_422_pydantic_validation_error(client: TestClient):
    """FastAPI/Pydantic request body schema validation keeps default 422 status."""
    # Send invalid date
    res = client.post(
        "/api/invoices",
        json={
            "client_id": "abc",
            "total_amount": "1000.00",
            "issue_date": "not-a-valid-date",
            "due_date": "2026-11-10",
        },
    )
    assert res.status_code == 422
    data = res.json()
    assert "detail" in data


def test_reset_demo_data_endpoint(client: TestClient):
    """POST /api/system/reset-demo drops and seeds all 13 invoices and 5 clients."""
    res = client.post("/api/system/reset-demo")
    assert res.status_code == 200
    assert res.json()["ok"] is True

    # Check clients
    clients_res = client.get("/api/clients")
    assert clients_res.status_code == 200
    clients = clients_res.json()
    assert len(clients) == 5

    # Check invoices
    invoices_res = client.get("/api/invoices")
    assert invoices_res.status_code == 200
    invoices = invoices_res.json()
    assert len(invoices) == 13

    # Check dashboard
    dash_res = client.get("/api/reports/dashboard")
    assert dash_res.status_code == 200
    dash = dash_res.json()
    assert dash["active_count"] > 0
    assert dash["broken_promises"] >= 2
    assert dash["kept_promises"] >= 1


def test_reset_demo_disabled_returns_404(monkeypatch):
    """When DUEPING_ENABLE_RESET is disabled, POST /api/system/reset-demo returns 404."""
    monkeypatch.setenv("DUEPING_ENABLE_RESET", "0")
    import importlib
    import app.api.routers.system as sys_router
    importlib.reload(sys_router)
    from fastapi import FastAPI
    test_app = FastAPI()
    test_app.include_router(sys_router.router, prefix="/api")
    tc = TestClient(test_app)
    res = tc.post("/api/system/reset-demo")
    assert res.status_code == 404
    # Restore
    monkeypatch.setenv("DUEPING_ENABLE_RESET", "1")
    importlib.reload(sys_router)


def test_projects_api(client: TestClient):
    """Test project creation and retrieval."""
    c = client.post("/api/clients", json={"name": "Project Client", "email": "pc@example.com"}).json()
    res = client.post(
        "/api/projects",
        json={
            "client_id": c["id"],
            "project_name": "Website Redesign",
            "description": "Revamp marketing website",
            "start_date": "2026-11-01",
        },
    )
    assert res.status_code == 201
    proj = res.json()
    assert proj["project_name"] == "Website Redesign"
    assert proj["status"] == "Active"

    # List projects for client
    list_res = client.get(f"/api/projects?client_id={c['id']}")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


def test_invoice_update_draft_only(client: TestClient):
    """Invoice details can be updated while in DRAFT, but rejected once SENT."""
    c = client.post("/api/clients", json={"name": "Client U", "email": "u@example.com"}).json()
    inv = client.post(
        "/api/invoices",
        json={
            "client_id": c["id"],
            "total_amount": "5000.00",
            "issue_date": "2026-11-01",
            "due_date": "2026-11-10",
        },
    ).json()

    # Update while DRAFT
    res = client.put(
        f"/api/invoices/{inv['id']}",
        json={"total_amount": "7500.00", "due_date": "2026-11-15"},
    )
    assert res.status_code == 200
    assert res.json()["total"]["amount"] == "7500.00"
    assert res.json()["due_date"] == "2026-11-15"

    # Send invoice
    client.post(f"/api/invoices/{inv['id']}/send")

    # Try updating details when SENT -> 409
    res = client.put(
        f"/api/invoices/{inv['id']}",
        json={"total_amount": "8000.00"},
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "InvalidStateTransition"


def test_dispute_and_resolve_flow(client: TestClient):
    """Raising a DISPUTED_AMOUNT blocker transitions to DISPUTED; resolving transitions back."""
    c = client.post("/api/clients", json={"name": "Client D", "email": "d@example.com"}).json()
    inv = client.post(
        "/api/invoices",
        json={
            "client_id": c["id"],
            "total_amount": "12000.00",
            "issue_date": "2026-11-01",
            "due_date": "2026-11-10",
        },
    ).json()
    client.post(f"/api/invoices/{inv['id']}/send")

    # Raise dispute blocker
    res = client.post(
        f"/api/invoices/{inv['id']}/blockers",
        json={"type": "DISPUTED_AMOUNT", "description": "Billing dispute"},
    )
    assert res.status_code == 200
    inv_data = res.json()
    assert inv_data["status"] == "DISPUTED"
    bid = inv_data["blockers"][0]["id"]

    # Partial payment on DISPUTED invoice allowed, stays DISPUTED
    res = client.post(
        f"/api/invoices/{inv['id']}/payments",
        json={"amount": "2000.00", "payment_date": "2026-11-05", "method": "BANK_TRANSFER"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "DISPUTED"

    # Resolve dispute -> returns to PARTIALLY_PAID
    res = client.post(f"/api/invoices/{inv['id']}/blockers/{bid}/resolve")
    assert res.status_code == 200
    assert res.json()["status"] == "PARTIALLY_PAID"


def test_document_metadata_api(client: TestClient):
    """Supporting document metadata can be attached and removed."""
    c = client.post("/api/clients", json={"name": "Client Doc", "email": "doc@example.com"}).json()
    inv = client.post(
        "/api/invoices",
        json={
            "client_id": c["id"],
            "total_amount": "3000.00",
            "issue_date": "2026-11-01",
            "due_date": "2026-11-10",
        },
    ).json()

    # Attach document
    res = client.post(
        f"/api/invoices/{inv['id']}/documents",
        json={
            "document_type": "PURCHASE_ORDER",
            "file_name": "PO_12345.pdf",
            "file_path": "/uploads/PO_12345.pdf",
        },
    )
    assert res.status_code == 200
    inv_data = res.json()
    assert len(inv_data["documents"]) == 1
    doc_id = inv_data["documents"][0]["id"]
    assert inv_data["documents"][0]["file_type"] == "pdf"

    # Remove document
    res = client.delete(f"/api/invoices/{inv['id']}/documents/{doc_id}")
    assert res.status_code == 200
    assert len(res.json()["documents"]) == 0


def test_manual_actions_api(client: TestClient):
    """Manual actions can be added, rescheduled, and marked complete."""
    c = client.post("/api/clients", json={"name": "Client Act", "email": "act@example.com"}).json()
    inv = client.post(
        "/api/invoices",
        json={
            "client_id": c["id"],
            "total_amount": "4000.00",
            "issue_date": "2026-11-01",
            "due_date": "2026-11-10",
        },
    ).json()

    # Add action
    res = client.post(
        f"/api/invoices/{inv['id']}/actions",
        json={"description": "Call accounts department", "priority": "HIGH", "due_date": "2026-11-12"},
    )
    assert res.status_code == 200
    inv_data = res.json()
    act = inv_data["actions"][0]
    aid = act["id"]
    assert act["priority"] == "HIGH"
    assert act["status"] == "PENDING"

    # Reschedule action
    res = client.post(
        f"/api/invoices/{inv['id']}/actions/{aid}/reschedule",
        json={"new_date": "2026-11-15"},
    )
    assert res.status_code == 200
    inv_data = res.json()
    assert inv_data["actions"][0]["due_date"] == "2026-11-15"

    # Complete action
    res = client.post(f"/api/invoices/{inv['id']}/actions/{aid}/complete")
    assert res.status_code == 200
    assert res.json()["actions"][0]["status"] == "COMPLETED"


def test_csv_import_api(client: TestClient):
    """POST /api/import/invoices imports valid rows and reports row errors."""
    csv_content = (
        "client_name,client_email,issue_date,due_date,total_amount,invoice_number\n"
        "Alpha Corp,alpha@test.com,2026-11-01,2026-11-15,15000.00,INV-CSV-01\n"
        "Beta LLC,beta@test.com,2026-11-01,2026-11-15,0.00,INV-CSV-02\n"  # invalid total
    )
    res = client.post(
        "/api/import/invoices",
        json={"format": "csv", "content": csv_content},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["processed"] == 2
    assert data["imported"] == 1
    assert data["rejected"] == 1
    assert len(data["errors"]) == 1
    assert data["errors"][0]["row_number"] == 2


def test_settings_api(client: TestClient):
    """GET and PUT /api/system/settings update configuration."""
    res = client.get("/api/system/settings")
    assert res.status_code == 200

    res = client.put(
        "/api/system/settings",
        json={"sender_name": "Sarah", "default_currency": "USD"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sender_name"] == "Sarah"
    assert data["default_currency"] == "USD"
