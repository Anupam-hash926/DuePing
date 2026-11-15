# UML Diagram 01 — Use Case Diagram

### Primary Actors
- **Account Owner**: Freelancer, agency owner, or finance manager managing receivables and client follow-ups.
- **Scheduler (simulated)**: Automated cron runner invoking the daily check service to detect overdue invoices and missed promises.

### Rendering Note
PlantUML source is available at [01-use-case.puml](01-use-case.puml). A structural breakdown is rendered below.

```mermaid
flowchart LR
    subgraph Actors
        Owner["Account Owner"]
        Scheduler["Scheduler (simulated)"]
    end

    subgraph System["DuePing CollectionFacade"]
        UC1["Manage Clients & Projects"]
        UC2["Create, Update & Send Invoice"]
        UC3["Import Invoices (CSV)"]
        UC4["Record Payment"]
        UC5["Raise, Assign & Resolve Blocker"]
        UC6["Suggest Next Action (Playbook)"]
        UC7["Record Payment Promise"]
        UC8["Log Follow-Up"]
        UC9["Attach / Remove Document"]
        UC10["Generate & Mark Reminder Sent"]
        UC11["View Prioritized Action Centre"]
        UC12["Complete / Reschedule Action"]
        UC13["Run Daily Check"]
        UC14["Detect Breached Promises & Overdue"]
        UC15["View Dashboard & Reports"]
        UC16["View Audit Log & Notifications"]
        UC17["Write Off Invoice"]
        UC18["Time Travel & Demo Reset"]
    end

    Owner --> UC1
    Owner --> UC2
    Owner --> UC3
    Owner --> UC4
    Owner --> UC5
    Owner --> UC7
    Owner --> UC8
    Owner --> UC9
    Owner --> UC10
    Owner --> UC11
    Owner --> UC12
    Owner --> UC13
    Owner --> UC15
    Owner --> UC16
    Owner --> UC17
    Owner --> UC18

    Scheduler --> UC13

    UC5 -.->|includes| UC6
    UC13 -.->|includes| UC14
```
