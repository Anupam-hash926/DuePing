# UML Diagram 04 — Invoice State Machine

> **Important Architectural Note:**  
> **Overdue is derived, not a stored state.** An invoice is overdue when its status is active (`SENT`, `PARTIALLY_PAID`, or `DISPUTED`), its outstanding balance is greater than zero, and the evaluation date `today > due_date` (evaluated dynamically via `invoice.is_overdue(today)`). This avoids corrupting state machines with wall-clock polling.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : create_invoice()

    DRAFT --> SENT : send(sent_at)

    SENT --> PARTIALLY_PAID : record_payment() [remaining > 0]
    SENT --> PAID : record_payment() [remaining == 0]
    SENT --> DISPUTED : raise_blocker() [DISPUTED_AMOUNT]
    SENT --> WRITTEN_OFF : write_off()

    PARTIALLY_PAID --> PARTIALLY_PAID : record_payment() [remaining > 0]
    PARTIALLY_PAID --> PAID : record_payment() [remaining == 0]
    PARTIALLY_PAID --> DISPUTED : raise_blocker() [DISPUTED_AMOUNT]
    PARTIALLY_PAID --> WRITTEN_OFF : write_off()

    DISPUTED --> SENT : resolve_blocker() [amount_paid == 0]
    DISPUTED --> PARTIALLY_PAID : resolve_blocker() [amount_paid > 0]
    DISPUTED --> PARTIALLY_PAID : record_payment() [remaining > 0]
    DISPUTED --> PAID : record_payment() [remaining == 0]

    PAID --> [*]
    WRITTEN_OFF --> [*]
```
