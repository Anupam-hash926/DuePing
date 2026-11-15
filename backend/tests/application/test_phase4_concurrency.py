"""Phase 4 tests: Concurrency, Thread-safe EventBus, Failure Visibility, Pagination."""
from __future__ import annotations

import concurrent.futures
from dataclasses import dataclass
from datetime import date, datetime
import os
os.environ["DUEPING_ENABLE_RESET"] = "1"
import threading
from typing import List
import pytest
from starlette.testclient import TestClient

from app.api.deps import get_facade, set_facade
from app.api.main import app
from app.application.event_bus import EventBus, mutate_invoice, save_and_publish
from app.application.facade import CollectionFacade
from app.application.ports import FailureLogRepository, HandlerFailure
from app.domain.audit import AuditEvent, Notification
from app.domain.client import Client
from app.domain.enums import ActionSource, Priority
from app.domain.events import DomainEvent
from app.domain.exceptions import ConcurrencyConflict
from app.domain.invoice import Invoice
from app.domain.money import Money
from app.domain.next_action import NextAction
from app.infrastructure.db import create_all, drop_all
from app.infrastructure.in_memory_repositories import (
    InMemoryAuditRepository,
    InMemoryClientRepository,
    InMemoryFailureLogRepository,
    InMemoryInvoiceRepository,
    InMemoryNotificationRepository,
    InMemoryProjectRepository,
    InMemorySettingsRepository,
)

NOW = datetime(2026, 3, 1, 12, 0, 0)
TODAY = date(2026, 3, 1)


@pytest.fixture(autouse=True)
def fresh_database():
    """Ensure clean database tables for each test."""
    set_facade(None)
    create_all()
    yield
    drop_all()


@dataclass
class DummyEvent(DomainEvent):
    seq: int = 0


# ── C2: Thread-Safe EventBus ──────────────────────────────────────────────────

def test_event_bus_thread_safety():
    """8 threads x 50 events each -> every subscribed handler is called exactly 400 times."""
    bus = EventBus()
    lock = threading.Lock()
    call_counts = {"h1": 0, "h2": 0}

    def handler_1(event: DummyEvent):
        with lock:
            call_counts["h1"] += 1

    def handler_2(event: DummyEvent):
        with lock:
            call_counts["h2"] += 1

    bus.subscribe(DummyEvent, handler_1)
    bus.subscribe(DummyEvent, handler_2)

    def publish_worker(thread_id: int):
        for i in range(50):
            bus.publish(DummyEvent(occurred_at=NOW, seq=thread_id * 100 + i))

    threads = 8
    with concurrent.futures.ThreadPoolExecutor(max_workers=threads) as executor:
        futures = [executor.submit(publish_worker, t) for t in range(threads)]
        for f in concurrent.futures.as_completed(futures):
            f.result()

    assert call_counts["h1"] == 400
    assert call_counts["h2"] == 400
    assert len(bus.failures) == 0


# ── C3: Listener Failure Visibility ───────────────────────────────────────────

def test_listener_failure_recorded_and_other_handlers_still_run():
    failure_repo = InMemoryFailureLogRepository()
    bus = EventBus(failure_log=failure_repo)
    executed = []

    def failing_handler(event: DummyEvent):
        raise RuntimeError("Something blew up in listener")

    def successful_handler(event: DummyEvent):
        executed.append(event.seq)

    bus.subscribe(DummyEvent, failing_handler)
    bus.subscribe(DummyEvent, successful_handler)

    ev = DummyEvent(occurred_at=NOW, seq=42)
    bus.publish(ev)

    # Successful handler still ran
    assert executed == [42]

    # Failure was recorded in failure_repo and bus.failures deque
    failures = failure_repo.list()
    assert len(failures) == 1
    assert failures[0].event_type == "DummyEvent"
    assert "failing_handler" in failures[0].handler
    assert "Something blew up" in failures[0].error

    assert len(bus.failures) == 1


# ── C1: mutate_invoice and Optimistic Locking ──────────────────────────────────

def test_mutate_invoice_retries_and_succeeds_after_concurrency_conflict():
    repo = InMemoryInvoiceRepository()
    bus = EventBus()
    client_id = "c1"

    inv = Invoice("DP-2026-0001", client_id, Money.of(10_000), TODAY, TODAY, NOW)
    repo.save(inv)
    assert inv.version == 0

    attempts = 0

    def mutating_fn(invoice: Invoice):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            # Simulate a concurrent modification by bumping version in repo behind the scenes
            concurrent_copy = repo.get(invoice.id)
            concurrent_copy.add_action(NextAction("Concurrent action", Priority.LOW, TODAY, ActionSource.MANUAL, NOW))
            repo.save(concurrent_copy)  # increments version to 1 in repo
        invoice.add_action(NextAction(f"Attempt {attempts} action", Priority.LOW, TODAY, ActionSource.MANUAL, NOW))

    result = mutate_invoice(repo, bus, inv.id, mutating_fn, retries=2)
    assert attempts == 2
    assert result.version == 2


def test_mutate_invoice_raises_if_conflict_persists():
    repo = InMemoryInvoiceRepository()
    bus = EventBus()

    inv = Invoice("DP-2026-0002", "c1", Money.of(10_000), TODAY, TODAY, NOW)
    repo.save(inv)

    def always_conflicts(invoice: Invoice):
        # Always bump repo version before save
        concurrent_copy = repo.get(invoice.id)
        concurrent_copy.add_action(NextAction("Bump version", Priority.LOW, TODAY, ActionSource.MANUAL, NOW))
        repo.save(concurrent_copy)

    with pytest.raises(ConcurrencyConflict):
        mutate_invoice(repo, bus, inv.id, always_conflicts, retries=2)


# ── API Tests: C1 (409), C3 (Failures endpoint), C5 (Pagination headers) ──────

def test_api_concurrency_conflict_returns_409(monkeypatch):
    client = TestClient(app)

    # Create client and invoice
    c_res = client.post("/api/clients", json={"name": "API Lock Client", "email": "lock@test.com"})
    c_id = c_res.json()["id"]

    inv_res = client.post("/api/invoices", json={
        "client_id": c_id,
        "total_amount": "1000.00",
        "issue_date": "2026-03-01",
        "due_date": "2026-03-15",
    })
    assert inv_res.status_code == 201, inv_res.text
    inv_id = inv_res.json()["id"]

    # Monkeypatch repo.save to simulate a ConcurrencyConflict on mutate
    from app.infrastructure.sqlalchemy_repositories import SqlAlchemyInvoiceRepository
    def conflict_save(self, invoice):
        raise ConcurrencyConflict("Forced conflict")
    monkeypatch.setattr(SqlAlchemyInvoiceRepository, "save", conflict_save)

    res = client.post(f"/api/invoices/{inv_id}/send")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "ConcurrencyConflict"
    assert "conflict" in res.json()["error"]["message"].lower()


def test_api_system_failures_endpoint():
    client = TestClient(app)

    # Initially empty
    res = client.get("/api/system/failures")
    assert res.status_code == 200
    assert res.json() == []

    # Manually record a failure in system facade
    facade: CollectionFacade = get_facade()
    facade.system_service.failure_log_repo.add(
        HandlerFailure(
            occurred_at=NOW,
            event_type="TestEvent",
            handler="test_handler",
            error="Simulated network failure",
        )
    )

    res2 = client.get("/api/system/failures")
    assert res2.status_code == 200
    failures = res2.json()
    assert len(failures) == 1
    assert failures[0]["event_type"] == "TestEvent"
    assert failures[0]["handler"] == "test_handler"
    assert failures[0]["error"] == "Simulated network failure"


def test_api_pagination_headers_and_limits():
    client = TestClient(app)

    # Create client
    c_res = client.post("/api/clients", json={"name": "Pagination User", "email": "page_api@test.com"})
    assert c_res.status_code == 201, c_res.text
    c_id = c_res.json()["id"]

    # Create and send 3 invoices to generate audit events
    for i in range(3):
        create_res = client.post("/api/invoices", json={
            "client_id": c_id,
            "total_amount": str(100 * (i + 1)),
            "issue_date": "2026-03-01",
            "due_date": "2026-03-15",
        })
        assert create_res.status_code == 201, create_res.text
        inv_id = create_res.json()["id"]
        client.post(f"/api/invoices/{inv_id}/send")

    # Test /api/invoices pagination
    inv_page = client.get("/api/invoices?limit=2&offset=0")
    assert inv_page.status_code == 200
    assert len(inv_page.json()) == 2
    assert inv_page.headers.get("x-total-count") == "3"

    inv_page2 = client.get("/api/invoices?limit=2&offset=2")
    assert inv_page2.status_code == 200
    assert len(inv_page2.json()) == 1
    assert inv_page2.headers.get("x-total-count") == "3"

    # Test /api/audit-log pagination
    audit_res = client.get("/api/audit-log?limit=2&offset=0")
    assert audit_res.status_code == 200
    assert "x-total-count" in audit_res.headers
    total_audit = int(audit_res.headers["x-total-count"])
    assert total_audit >= 3

    # Test /api/notifications pagination
    notif_res = client.get("/api/notifications?limit=5&offset=0")
    assert notif_res.status_code == 200
    assert "x-total-count" in notif_res.headers
