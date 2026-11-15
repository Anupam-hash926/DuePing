# UML Diagram 06 — Sequence: Blocker to Action Generation

Traces how raising a `PaymentBlocker` triggers the domain event pipeline and uses the `ResolutionPlaybook` to generate a targeted `NextAction`.

```mermaid
sequenceDiagram
    autonumber
    actor User as Account Owner
    participant Facade as CollectionFacade
    participant Repo as InvoiceRepository
    participant Inv as Invoice (Aggregate Root)
    participant Bus as EventBus
    participant ActGen as ActionGenerationListener
    participant Playbook as ResolutionPlaybook
    participant Strategy as ResolutionStrategy

    User ->> Facade: raise_blocker(invoice_id, blocker_type, description, owner)
    Facade ->> Repo: find_by_id(invoice_id)
    Repo -->> Facade: invoice

    Facade ->> Inv: raise_blocker(blocker_type, description, owner)
    activate Inv
    Inv ->> Inv: create PaymentBlocker(status=OPEN)
    opt blocker_type == DISPUTED_AMOUNT
        Inv ->> Inv: _set_state(DisputedState)
        Inv ->> Inv: _record(InvoiceDisputed)
    end
    Inv ->> Inv: _record(BlockerRaised)
    Inv -->> Facade: blocker
    deactivate Inv

    Facade ->> Facade: _save_and_publish(invoice)
    activate Facade
    Facade ->> Inv: pull_events()
    Inv -->> Facade: [BlockerRaised, ...]
    Facade ->> Repo: save(invoice)

    Facade ->> Bus: publish_all([BlockerRaised])
    activate Bus
    Bus ->> ActGen: on_blocker_raised(BlockerRaised)
    activate ActGen

    ActGen ->> Repo: find_by_id(invoice_id)
    Repo -->> ActGen: invoice
    ActGen ->> Playbook: suggest_action(context, blocker)
    activate Playbook
    Playbook ->> Strategy: suggest_action(context)
    Strategy -->> Playbook: (action_text, priority, days, channel)
    Playbook -->> ActGen: action
    deactivate Playbook

    ActGen ->> Inv: add_action(action_text, priority, due_date, channel, source, source_id)
    Inv ->> Inv: _record(ActionCreated)
    ActGen ->> Repo: save(invoice)
    ActGen ->> Bus: publish_all([ActionCreated])
    Note over Bus: ActionCreated queued and dispatched cleanly without reentrancy
    deactivate ActGen
    deactivate Bus
    deactivate Facade

    Facade -->> User: blocker
```
