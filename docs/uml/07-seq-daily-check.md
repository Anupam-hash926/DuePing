# UML Diagram 07 — Sequence: Daily Check

Traces how `DailyCheckService` evaluates active invoices against `Clock.today()`, detecting newly overdue invoices, breached promises, and aging blockers.

```mermaid
sequenceDiagram
    autonumber
    actor Scheduler as Scheduler (simulated)
    participant Facade as CollectionFacade
    participant Daily as DailyCheckService
    participant Clock as Clock
    participant Repo as InvoiceRepository
    participant Inv as Invoice (Aggregate Root)
    participant Bus as EventBus
    participant Rel as ReliabilityListener
    participant Notif as NotificationListener
    participant ActGen as ActionGenerationListener

    Scheduler ->> Facade: run_daily_check()
    Facade ->> Daily: run()
    activate Daily
    Daily ->> Clock: today()
    Clock -->> Daily: current_date

    Daily ->> Repo: list_active()
    Repo -->> Daily: [invoice_1, invoice_2, ...]

    loop For each active invoice
        Daily ->> Inv: flag_overdue_if_needed(current_date)
        opt today > due_date and not overdue_notified
            Inv ->> Inv: overdue_notified = True
            Inv ->> Inv: _record(InvoiceBecameOverdue)
        end

        Daily ->> Inv: check_promises(current_date)
        opt pending promise due_date < current_date
            Inv ->> Inv: promise.mark_missed()
            Inv ->> Inv: _record(PromiseMissed)
        end

        opt events generated
            Daily ->> Inv: pull_events()
            Inv -->> Daily: [InvoiceBecameOverdue, PromiseMissed]
            Daily ->> Repo: save(invoice)
            Daily ->> Bus: publish_all(events)
            activate Bus
            Bus ->> Rel: on_promise_missed(PromiseMissed)
            Rel ->> Rel: client.record_broken_promise()
            Bus ->> Notif: on_promise_missed(PromiseMissed)
            Bus ->> ActGen: on_promise_missed(PromiseMissed)
            ActGen ->> Inv: add_action("Follow up on broken promise", CRITICAL)
            deactivate Bus
        end
    end

    Daily -->> Facade: DailyCheckSummary
    deactivate Daily
    Facade -->> Scheduler: DailyCheckSummary
```
