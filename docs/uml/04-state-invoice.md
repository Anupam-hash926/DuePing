# UML Diagram 04 — Invoice State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT : create_invoice()

    DRAFT --> ISSUED : issue()\n[invoice_number assigned,\nissued_date = today]

    ISSUED --> PARTIAL : record_payment(amount)\n[amount < total]

    ISSUED --> PAID : record_payment(amount)\n[amount >= total]

    ISSUED --> OVERDUE : flag_overdue()\n[today > due_date]

    ISSUED --> DISPUTED : dispute()

    PARTIAL --> PAID : record_payment(amount)\n[paid_so_far >= total]

    PARTIAL --> OVERDUE : flag_overdue()\n[today > due_date]

    PARTIAL --> DISPUTED : dispute()

    OVERDUE --> PARTIAL : record_payment(amount)\n[amount < remaining]

    OVERDUE --> PAID : record_payment(amount)\n[amount >= remaining]

    OVERDUE --> WRITTEN_OFF : write_off()

    OVERDUE --> DISPUTED : dispute()

    DISPUTED --> ISSUED : resolve_dispute()\n[no payments yet]

    DISPUTED --> PARTIAL : resolve_dispute()\n[partial payments exist]

    DISPUTED --> WRITTEN_OFF : write_off()

    PAID --> [*]
    WRITTEN_OFF --> [*]
```

## Transition Table

| From State | Event / Guard | To State | Domain Event Fired |
|-----------|--------------|----------|--------------------|
| DRAFT | `issue()` | ISSUED | `InvoiceIssued` |
| ISSUED | `record_payment()` [partial] | PARTIAL | `PaymentRecorded` |
| ISSUED | `record_payment()` [full] | PAID | `PaymentRecorded`, `InvoicePaid` |
| ISSUED | `flag_overdue()` | OVERDUE | `InvoiceOverdue` |
| ISSUED | `dispute()` | DISPUTED | `InvoiceDisputed` |
| PARTIAL | `record_payment()` [completes] | PAID | `PaymentRecorded`, `InvoicePaid` |
| PARTIAL | `flag_overdue()` | OVERDUE | `InvoiceOverdue` |
| PARTIAL | `dispute()` | DISPUTED | `InvoiceDisputed` |
| OVERDUE | `record_payment()` [partial] | PARTIAL | `PaymentRecorded` |
| OVERDUE | `record_payment()` [full] | PAID | `PaymentRecorded`, `InvoicePaid` |
| OVERDUE | `write_off()` | WRITTEN_OFF | `InvoiceWrittenOff` |
| OVERDUE | `dispute()` | DISPUTED | `InvoiceDisputed` |
| DISPUTED | `resolve_dispute()` [no payments] | ISSUED | `BlockerResolved` |
| DISPUTED | `resolve_dispute()` [partial paid] | PARTIAL | `BlockerResolved` |
| DISPUTED | `write_off()` | WRITTEN_OFF | `InvoiceWrittenOff` |

## Terminal States

- **PAID** — Invoice fully collected. No further transitions.
- **WRITTEN_OFF** — Invoice deemed uncollectable. No further transitions.
