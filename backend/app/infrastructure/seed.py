"""Database seed script populating demo data via CollectionFacade and SimulatedClock.

Follows Section 17.1 of the specification:
- Drops and recreates all database tables.
- Advances a SimulatedClock from T-130 to real today.
- Drives operations step-by-step through CollectionFacade so that audit logs,
  actions, promises, notifications, and client reliability scores are created
  by the authentic domain event pipeline.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from app.application.facade import CollectionFacade
from app.domain.enums import (
    BlockerStatus,
    BlockerType,
    Channel,
    DocumentType,
    FollowUpOutcome,
    PaymentMethod,
)
from app.domain.money import Money
from app.infrastructure.db import create_all, drop_all


def seed_demo_data(facade: CollectionFacade | None = None) -> dict:
    """Drop tables, recreate them, and seed historical demo data."""
    # 1. Reset database tables
    drop_all()
    create_all()

    if facade is None:
        # Build default facade if not injected
        from app.api.deps import create_app_facade
        facade = create_app_facade()

    # T = real today
    real_today = date.today()
    t = real_today

    def d(days_offset: int) -> date:
        return t + timedelta(days=days_offset)

    def dt(days_offset: int) -> datetime:
        day = d(days_offset)
        return datetime(day.year, day.month, day.day, 10, 0, 0)

    # Settings
    facade.update_settings(sender_name="Anupam", default_currency="INR")

    # Step: T - 130
    facade.set_simulated_date(d(-130))

    # Create Clients
    c_northwind = facade.create_client(
        name="Priya Menon",
        email="priya@northwind.example.com",
        phone="+91 98765 43210",
        company_name="Northwind Studios",
    )
    c_bluepeak = facade.create_client(
        name="Rahul Verma",
        email="rahul@bluepeak.example.com",
        phone="+91 98765 43211",
        company_name="Bluepeak Agency",
    )
    c_greenleaf = facade.create_client(
        name="Anita Desai",
        email="anita@greenleaf.example.com",
        phone="+91 98765 43212",
        company_name="Greenleaf Foods",
    )
    c_orbit = facade.create_client(
        name="Karan Shah",
        email="karan@orbitlabs.example.com",
        phone="+91 98765 43213",
        company_name="Orbit Labs",
    )
    c_sunrise = facade.create_client(
        name="Meera Iyer",
        email="meera@sunriseretail.example.com",
        phone="+91 98765 43214",
        company_name="Sunrise Retail",
    )

    # Invoices at T - 130:
    # #9 Sunrise, 70,000, issue T-130, due T-100
    inv9 = facade.create_invoice(
        client_id=c_sunrise.id,
        total=Money.of("70000.00", "INR"),
        issue_date=d(-130),
        due_date=d(-100),
        invoice_number="INV-SR-09",
    )
    facade.send_invoice(inv9.id)

    # #11 Sunrise, 22,000, issue T-130, due T-100
    inv11 = facade.create_invoice(
        client_id=c_sunrise.id,
        total=Money.of("22000.00", "INR"),
        issue_date=d(-130),
        due_date=d(-100),
        invoice_number="INV-SR-11",
    )
    facade.send_invoice(inv11.id)

    # Step: T - 100
    facade.set_simulated_date(d(-100))
    # Write off invoice 9
    facade.write_off(inv9.id, reason="Company entered liquidation")

    # #13 Greenleaf, 15,000, issue T-100, due T-70
    inv13 = facade.create_invoice(
        client_id=c_greenleaf.id,
        total=Money.of("15000.00", "INR"),
        issue_date=d(-100),
        due_date=d(-70),
        invoice_number="INV-GL-13",
    )
    facade.send_invoice(inv13.id)

    # Step: T - 70
    facade.set_simulated_date(d(-70))
    # #3 Bluepeak, 80,000, issue T-70, due T-40
    inv3 = facade.create_invoice(
        client_id=c_bluepeak.id,
        total=Money.of("80000.00", "INR"),
        issue_date=d(-70),
        due_date=d(-40),
        invoice_number="INV-BP-03",
    )
    facade.send_invoice(inv3.id)
    facade.raise_blocker(
        invoice_id=inv3.id,
        type=BlockerType.MISSING_PO,
        description="Missing Purchase Order number from finance",
        assigned_to="Rahul Verma",
    )
    facade.attach_document(
        invoice_id=inv3.id,
        document_type=DocumentType.PURCHASE_ORDER,
        file_name="po_request_email.pdf",
        file_path="/uploads/docs/po_request_email.pdf",
    )

    # Step: T - 60
    facade.set_simulated_date(d(-60))
    # #1 Northwind, 60,000, issue T-60, due T-30
    inv1 = facade.create_invoice(
        client_id=c_northwind.id,
        total=Money.of("60000.00", "INR"),
        issue_date=d(-60),
        due_date=d(-30),
        invoice_number="INV-NW-01",
    )
    facade.send_invoice(inv1.id)

    # Step: T - 50
    facade.set_simulated_date(d(-50))
    # #4 Bluepeak, 25,000, issue T-50, due T-20
    inv4 = facade.create_invoice(
        client_id=c_bluepeak.id,
        total=Money.of("25000.00", "INR"),
        issue_date=d(-50),
        due_date=d(-20),
        invoice_number="INV-BP-04",
    )
    facade.send_invoice(inv4.id)
    inv4 = facade.raise_blocker(
        invoice_id=inv4.id,
        type=BlockerType.AWAITING_APPROVAL,
        description="Waiting for VP finance approval",
        assigned_to="Rahul Verma",
    )
    blocker_id = inv4.blockers[0].id
    facade.update_blocker_status(inv4.id, blocker_id, BlockerStatus.IN_PROGRESS)

    # Step: T - 45
    facade.set_simulated_date(d(-45))
    # #5 Greenleaf, 120,000, issue T-45, due T-15
    inv5 = facade.create_invoice(
        client_id=c_greenleaf.id,
        total=Money.of("120000.00", "INR"),
        issue_date=d(-45),
        due_date=d(-15),
        invoice_number="INV-GL-05",
    )
    facade.send_invoice(inv5.id)
    facade.raise_blocker(
        invoice_id=inv5.id,
        type=BlockerType.DISPUTED_AMOUNT,
        description="Client claims billing rate was higher than agreed",
        assigned_to="Anita Desai",
    )
    facade.attach_document(
        invoice_id=inv5.id,
        document_type=DocumentType.CONTRACT,
        file_name="rate_card_signed.pdf",
        file_path="/uploads/docs/rate_card_signed.pdf",
    )
    facade.log_follow_up(
        invoice_id=inv5.id,
        channel=Channel.PHONE,
        notes="Spoke to Anita regarding the rate mismatch",
        outcome=FollowUpOutcome.DISPUTED,
        contact_date=dt(-45),
    )

    # Step: T - 40
    facade.set_simulated_date(d(-40))
    # Invoice 3: Promise 1 for T - 30
    facade.record_promise(
        invoice_id=inv3.id,
        promised_date=d(-30),
        amount=Money.of("80000.00", "INR"),
        note="Promised over phone to pay on 30 days before today",
    )
    # #12 Northwind, 35,000, issue T-40, due T-10
    inv12 = facade.create_invoice(
        client_id=c_northwind.id,
        total=Money.of("35000.00", "INR"),
        issue_date=d(-40),
        due_date=d(-10),
        invoice_number="INV-NW-12",
    )
    facade.send_invoice(inv12.id)

    # Step: T - 35
    facade.set_simulated_date(d(-35))
    # #7 Orbit Labs, 55,000, issue T-35, due T-5
    inv7 = facade.create_invoice(
        client_id=c_orbit.id,
        total=Money.of("55000.00", "INR"),
        issue_date=d(-35),
        due_date=d(-5),
        invoice_number="INV-OL-07",
    )
    facade.send_invoice(inv7.id)
    facade.raise_blocker(
        invoice_id=inv7.id,
        type=BlockerType.WRONG_DETAILS,
        description="Incorrect GSTIN listed on header",
        assigned_to="Karan Shah",
    )

    # Step: T - 29 (Promise 1 on inv 3 is now missed)
    facade.set_simulated_date(d(-29))
    facade.run_daily_check()

    # Step: T - 28
    facade.set_simulated_date(d(-28))
    # Invoice 1 paid on T - 28
    facade.record_payment(
        invoice_id=inv1.id,
        amount=Money.of("60000.00", "INR"),
        payment_date=d(-28),
        method=PaymentMethod.BANK_TRANSFER,
        reference_number="TXN-NW-01",
    )

    # Step: T - 25
    facade.set_simulated_date(d(-25))
    # #8 Orbit Labs, 18,000, issue T-25, due T-10
    inv8 = facade.create_invoice(
        client_id=c_orbit.id,
        total=Money.of("18000.00", "INR"),
        issue_date=d(-25),
        due_date=d(-10),
        invoice_number="INV-OL-08",
    )
    facade.send_invoice(inv8.id)
    inv8 = facade.raise_blocker(
        invoice_id=inv8.id,
        type=BlockerType.MISSING_DOCUMENTS,
        description="Missing timesheet attachment",
    )
    b_doc_id = inv8.blockers[0].id
    facade.resolve_blocker(inv8.id, b_doc_id)
    facade.raise_blocker(
        invoice_id=inv8.id,
        type=BlockerType.NO_RESPONSE,
        description="Client not answering emails or phone calls",
    )

    # Invoice 3: Promise 2 for T - 10
    facade.record_promise(
        invoice_id=inv3.id,
        promised_date=d(-10),
        amount=Money.of("80000.00", "INR"),
        note="Second promise after follow up",
    )

    # Step: T - 20
    facade.set_simulated_date(d(-20))
    # #2 Northwind, 45,000, issue T-20, due T+10
    inv2 = facade.create_invoice(
        client_id=c_northwind.id,
        total=Money.of("45000.00", "INR"),
        issue_date=d(-20),
        due_date=d(10),
        invoice_number="INV-NW-02",
    )
    facade.send_invoice(inv2.id)

    # Step: T - 15
    facade.set_simulated_date(d(-15))
    # Invoice 4: partial payment 10,000
    facade.record_payment(
        invoice_id=inv4.id,
        amount=Money.of("10000.00", "INR"),
        payment_date=d(-15),
        method=PaymentMethod.BANK_TRANSFER,
        reference_number="TXN-BP-04",
    )
    # Invoice 12: Promise for T - 2
    facade.record_promise(
        invoice_id=inv12.id,
        promised_date=d(-2),
        amount=Money.of("35000.00", "INR"),
        note="Promised to clear before end of week",
    )

    # Step: T - 10
    facade.set_simulated_date(d(-10))
    # #6 Greenleaf, 30,000, issue T-10, due T+20
    inv6 = facade.create_invoice(
        client_id=c_greenleaf.id,
        total=Money.of("30000.00", "INR"),
        issue_date=d(-10),
        due_date=d(20),
        invoice_number="INV-GL-06",
    )
    facade.send_invoice(inv6.id)

    # Invoice 8: 6,000 paid
    facade.record_payment(
        invoice_id=inv8.id,
        amount=Money.of("6000.00", "INR"),
        payment_date=d(-10),
        method=PaymentMethod.BANK_TRANSFER,
        reference_number="TXN-OL-08",
    )

    # Step: T - 9 (Promise 2 on inv 3 is now missed)
    facade.set_simulated_date(d(-9))
    facade.run_daily_check()

    # Step: T - 5
    facade.set_simulated_date(d(-5))
    # #10 Sunrise, 40,000, issue T-5, due T+25 (DRAFT - not sent)
    facade.create_invoice(
        client_id=c_sunrise.id,
        total=Money.of("40000.00", "INR"),
        issue_date=d(-5),
        due_date=d(25),
        invoice_number="INV-SR-10",
    )

    # Step: T - 2
    facade.set_simulated_date(d(-2))
    # Invoice 12 paid late on T - 2; promise kept
    facade.record_payment(
        invoice_id=inv12.id,
        amount=Money.of("35000.00", "INR"),
        payment_date=d(-2),
        method=PaymentMethod.BANK_TRANSFER,
        reference_number="TXN-NW-12",
    )

    # Step: T - 1
    facade.set_simulated_date(d(-1))
    # Invoice 7: PENDING promise for T + 3
    facade.record_promise(
        invoice_id=inv7.id,
        promised_date=d(3),
        amount=Money.of("55000.00", "INR"),
        note="Promised by Karan over phone",
    )

    # Return to real today
    facade.set_simulated_date(None)
    facade.run_daily_check()

    return {"seeded": True, "clients": 5, "invoices": 13}


def reset_demo_data(facade: CollectionFacade | None = None) -> None:
    seed_demo_data(facade)


if __name__ == "__main__":
    result = seed_demo_data()
    print("Seed result:", result)
