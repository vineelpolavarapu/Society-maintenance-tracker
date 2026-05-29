# Product Requirements Document — Society Maintenance & Expense Tracker (Phase 1)

> **Status:** Draft v1 (complete) · **Phase:** 1 (Meta / MVP) · **Last updated:** 27 May 2026

---

## 1. Overview & Purpose

### 1.1 Product
**Society Maintenance & Expense Tracker** — a web application serving a single residential society. It is the society's shared, trustworthy record of money: maintenance dues collected and expenses paid out.

### 1.2 Phase 1 in one sentence
The Treasurer records all money in and money out; every other member logs in and views the records. Phase 1 is a **record of truth, not a payment processor.**

### 1.3 Primary problem this solves
**Transparency.** Members should be able to trust where the society's money goes. Today that trust depends on a Treasurer's word and informal records. Phase 1 replaces that with a single shared ledger every member can see: total collected, total spent, current balance, every transaction, and who has and hasn't paid.

### 1.4 Scope of Phase 1
This is a **meta / MVP version**. All payments happen **offline** by any method the resident chooses (cash, cheque, UPI, bank transfer). The Treasurer collects them in real life and **manually enters** the resulting records into the system. The system performs no payment processing, no gateway integration, and no automated reconciliation.

**Explicit Phase 1 boundary:** Residents **cannot** self-report or confirm their own payments in Phase 1. They view only what the Treasurer has entered. Resident-side payment confirmation is deferred to a later phase (see §9).

### 1.5 Primary reader of this document
A **developer building the system**. The document favours precision over prose. Where a design choice has a non-obvious rationale, the rationale is stated briefly so it isn't accidentally "optimised away" during implementation.

### 1.6 Deployment context
A **single society**. There is no concept of multiple societies, no society switcher, and no per-society onboarding in Phase 1. (One consequence of this simplification is recorded in §10.)

## 2. Goals & Non-Goals

### 2.1 Primary goal
Any member can log in and, at any time, see the society's **current balance** and **every transaction** that produced it. This is the single condition that defines Phase 1 success — it directly delivers the transparency the product exists for.

### 2.2 Supporting goals
- Any member can see **who has and hasn't paid** the current maintenance cycle.
- The Treasurer can **record an expense or a payment quickly**, without friction.

### 2.3 Guiding principle (tie-breaker)
When two goals conflict during implementation, **trust and transparency win.** Concretely: if a faster or more convenient implementation would weaken the integrity of the financial record (e.g. allowing rows to be edited or deleted in place), the integrity-preserving option is chosen even if it is slower to build or use. This principle governs §8.

### 2.4 Non-Goals (explicitly out of scope for Phase 1)
The following are deliberately **not** built in Phase 1. They are listed so scope stays fixed; several are planned for later phases (§9).

- **Complaints & member communication** — no complaints board, no announcements, no member-to-member messaging. Deferred to a later phase.
- **Online payment processing** — no gateway, no UPI/card integration, no automated reconciliation. All payments occur offline and are entered manually by the Treasurer.
- **Reminders & notifications** — no email/SMS/push reminders to defaulters; no notifications of any kind.
- **Reports & exports** — no PDF/Excel statements, no annual summaries. The dashboard is the only view.
- **Variable dues** — maintenance is a single flat rate for every unit in Phase 1.
- **Resident self-service on payments** — residents cannot record, claim, or confirm payments (restated from §1.4).

### 2.5 Note on "variable dues" being a non-goal
Variable dues are out of scope as a **feature**, but the data model still derives each unit's charge *per unit* rather than from a global constant (see §4). This makes future variable-rate billing a configuration change, not a schema rewrite. Phase 1 simply sets every unit's rate to the same value.

## 3. Users & Roles

### 3.1 Role model
Phase 1 uses a **simple role field** on each user — no permission engine. There are three role values, plus one capability flag.

| Role value | Who | Can write money? | Read access |
|---|---|---|---|
| `treasurer` | The Treasurer | **Yes — sole writer** of all financial records | All records |
| `committee` | President, Secretary | No | All records |
| `resident` | Every household member | No | All records + own unit's dues; can raise complaints |

A single boolean capability, **`can_approve`**, is layered on top of the role. In Phase 1 only the **Secretary** has `can_approve = true`. It grants exactly one power: approving or rejecting pending registrations. It grants nothing else.

> **Design note (separation of duties):** money and membership are deliberately split. The Treasurer controls money; the Secretary controls who gets in. No single person does both. This protects an honest Treasurer from suspicion as much as it protects the society.

### 3.2 What each actor can do in Phase 1

**Treasurer** — the only writer to the financial ledger. Records transactions (money in/out), raises maintenance charges, and records payments against them. Corrections are made by reversal, never by editing in place (§8). Has full read access. Does **not** manage membership or approvals.

**Secretary** (`committee` + `can_approve`) — approves or rejects pending registration requests. **Nothing else special.** No money access, no member-access management, no notifications. Otherwise identical to other committee members: full read-only visibility.

**President** (`committee`) — read-only. Full visibility of all financial records and all complaints. No write powers of any kind in Phase 1.

**Resident** (`resident`) — read-only on all society-wide records (this satisfies the transparency goal). Additionally sees their own unit's dues and payment history. Can raise complaints. Cannot record, claim, or confirm payments (§1.4).

> **Phase 1 note on President & Secretary:** apart from the Secretary's single approval power, President and Secretary behave like any other read-only member. Their titles are recorded, but they carry no additional in-app powers in Phase 1. Expanded committee powers (e.g. announcements, second-approver on large expenses) are deferred (§9).

### 3.3 Dashboard access (read vs. write)
There is **one set of financial data**, presented through views that differ by *write capability*, not by *visibility*:

- **Everyone** (Treasurer, committee, residents) can **read** the dashboard — balance, all transactions, who has/hasn't paid. This is the transparency guarantee.
- **Only the Treasurer** can **make changes** — the entry/control actions (record transaction, raise charge, record payment) are available only to the Treasurer.

No member is ever blocked from *seeing* the financial records; only from *changing* them.

### 3.4 Authentication & registration (requirements 4, 5, 6)
- Two auth methods are exposed: **register** and **login**. (Requirement 5.)
- Authentication distinguishes the Treasurer (admin-level write) from all other users (read-level), per role. (Requirement 4.)
- A new user's registration is **not active until approved**. It enters a pending state and is approved or rejected by a user with `can_approve` — the **Secretary** in Phase 1. This prevents unauthorised self-registration. (Requirement 6.)
- A rejected or still-pending user cannot access any society data.

## 4. Core Concepts (Domain Model)

Phase 1 has **seven entities**. The financial trust model lives in three of them (Transaction, Charge, Payment) and is governed by §8. Field lists below are conceptual, not a final schema — they state what each entity must carry and why.

### 4.1 Unit
A physical home in the society. Exists independently of any person — residents change, the unit and its dues history persist.

- `id`
- `identifier` — e.g. "Villa 12", "Flat A-304"
- `type` — villa / bungalow / apartment / individual house
- `charge_rate` — the maintenance amount for this unit. **Flat (same value for all units) in Phase 1**, but stored per-unit so variable rates are a later config change, not a schema change (§2.5).

**Relationships:** a Unit has many Users; a Unit has many Charges.

### 4.2 User
A person who logs in. Tied to a Unit.

- `id`
- `name`, `email`/`phone`
- `unit_id` — the unit this user belongs to
- `role` — `treasurer` / `committee` / `resident` (§3.1)
- `can_approve` — boolean; true only for the Secretary in Phase 1
- `status` — `active` / `pending` / `rejected` (mirrors registration outcome)

**Relationships:** a User belongs to one Unit; a User may record Transactions/Payments (Treasurer only); a User may raise Complaints.

### 4.3 RegistrationRequest
A pending request to join, kept as its own entity (not just a flag) so the approval action has a clear record (requirement 6).

- `id`
- `applicant details` — name, contact, claimed `unit_id`
- `status` — `pending` / `approved` / `rejected`
- `decided_by` — the approving user (Secretary)
- `decided_at`

**Lifecycle:** `pending` → `approved` (creates/activates the User) or `rejected`. Until approved, the applicant has no access to society data.

### 4.4 Transaction — *append-only (§8)*
The atomic unit of money movement: any single in or out. **Never edited or deleted after creation.**

- `id`
- `direction` — `in` (income, e.g. a maintenance payment) / `out` (expense)
- `amount`
- `date`
- `description` — plain-language; mandatory, because a number with no explanation does not build trust
- `category` — free-text (e.g. "security", "repairs"); no Category entity in Phase 1
- `recorded_by` — the Treasurer
- `recorded_at`
- `reverses_transaction_id` — null normally; set when this entry is a correction that reverses an earlier one
- `status` — `active` / `reversed`

**Relationships:** recorded by one User (Treasurer). A Payment produces a corresponding `in` Transaction (see 4.6).

### 4.5 Charge — *what is owed*
An obligation raised against a Unit for a billing cycle. Separate from Payment so the system can answer "who hasn't paid."

- `id`
- `unit_id`
- `cycle` — e.g. "2026-05" (the maintenance period)
- `amount` — taken from the Unit's `charge_rate` at time of raising
- `raised_by` — the Treasurer
- `raised_at`
- `status` — `outstanding` / `settled` (derived from Payments against it; see §8)

**Relationships:** a Charge belongs to one Unit; a Charge is settled by one or more Payments.

### 4.6 Payment — *what is paid*
A record that a Unit has paid, in whole or part, against a Charge. Recorded by the Treasurer from an offline payment (§1.4).

- `id`
- `charge_id` — the obligation being settled
- `unit_id`
- `amount`
- `method` — free-text: cash / cheque / UPI / bank transfer (the system processes none of these; it only records)
- `reference` — optional (cheque no., UPI txn id)
- `recorded_by` — the Treasurer
- `recorded_at`

**Relationships:** a Payment settles one Charge and produces one `in` Transaction in the ledger, keeping the unit-dues view and the society balance consistent.

> **Why three money entities, not one:** the ledger (Transaction) is the society-wide truth of total money in/out and the balance. Charge and Payment sit on top to answer the per-unit question "who owes / who paid." A Payment is simultaneously a settlement of a Charge *and* an income Transaction — this link is what keeps "who paid" and "what's the balance" from ever disagreeing.

### 4.7 Complaint
A message raised by any member; readable by everyone (requirement 3).

- `id`
- `raised_by` — the User
- `unit_id`
- `text`
- `raised_at`

Phase 1 keeps complaints deliberately flat: no status lifecycle, no private/public toggle, no assignment — all complaints are visible to all members, exactly as specified. Ticket states and visibility controls are deferred (§9).

### 4.8 Derived values (never stored)
The society **balance** is never a stored, hand-updated number. It is computed as the sum of active `in` Transactions minus active `out` Transactions. A Charge's **settled/outstanding** status is derived from the Payments against it. Computed-not-stored is what guarantees the dashboard can never silently drift from the underlying records (§8).

## 5. Functional Requirements

Requirements are grouped by area and numbered for traceability. Each is testable.

### 5.1 Authentication & Registration
- **FR-1** The system exposes two auth methods: **register** and **login**.
- **FR-2** Registration captures applicant name, contact, and a **claimed unit** selected from the pre-loaded unit list (§FR-12).
- **FR-3** A new registration is created in `pending` status and grants no access to any society data.
- **FR-4** A user with `can_approve` (the Secretary) can approve or reject a pending registration. Approval activates the user and binds them to the claimed unit; rejection sets `rejected`.
- **FR-5** Login authenticates a user and resolves their role (`treasurer` / `committee` / `resident`), which governs all subsequent access.

### 5.2 Units & Members
- **FR-12** The Treasurer pre-loads the **unit list** (identifier, type, charge_rate). Units exist before any resident registers.
- **FR-13** Each active user is bound to exactly one unit. A unit may have multiple users.

### 5.3 Maintenance Charges
- **FR-20** The Treasurer can **raise charges in bulk** for a billing cycle: one action generates one Charge per unit at that unit's `charge_rate`.
- **FR-21** Each Charge records its `unit_id`, `cycle`, `amount`, and who raised it.
- **FR-22** A Charge's status (`outstanding` / `settled`) is **derived** from the Payments recorded against it, never set by hand.

### 5.4 Payments
- **FR-30** The Treasurer can record a Payment against a Charge, capturing amount, method (free-text), and optional reference.
- **FR-31** **Partial payments are allowed.** A Payment may be less than the Charge amount; the Charge remains partly outstanding until the cumulative Payments cover it.
- **FR-32** Recording a Payment also produces a corresponding `in` Transaction in the ledger, so the society balance and the unit-dues view stay consistent.
- **FR-33** Residents cannot record, claim, or confirm payments (Phase 1 boundary, §1.4).

### 5.5 Ledger & Corrections
- **FR-40** The Treasurer can record a Transaction (`in` or `out`) with amount, date, mandatory description, and free-text category.
- **FR-41** Transactions are **append-only** — never edited or deleted after creation.
- **FR-42** A correction is made by posting a **reversing entry** (which sets the original's status to `reversed`) plus a new corrected entry. Both remain permanently visible.

### 5.6 Dashboard / Transparency Views
- **FR-50** Every authenticated member can **read** the dashboard: current balance, full transaction list, and per-unit paid/unpaid status for the current cycle.
- **FR-51** The society **balance is derived** (sum of active `in` minus active `out` Transactions), never a stored editable number.
- **FR-52** Any member can view their **own unit's** charges and payment history.
- **FR-53** Only the Treasurer sees write/entry controls; all other roles see read-only views of the same data.

### 5.7 Complaints
Complaints are **out of scope for Phase 1** (see §9). The feature is deliberately excluded to keep the MVP focused on financial transparency. No complaints screen, no complaint submission, and no complaint reading exists in Phase 1.

## 6. Key User Flows

Each step is tagged with the **actor** and the **entity** it touches. These are happy paths plus the failure branches that matter.

### 6.1 Flow A — Register → Approve
1. *(Applicant)* Submits registration: name, contact, and a claimed unit from the pre-loaded list. → creates **RegistrationRequest** (`pending`).
2. *(System)* Applicant has no data access while `pending`.
3. *(Secretary)* Reviews pending requests, matching the claimed unit against the known unit list.
4a. *(Secretary)* **Approves** → **RegistrationRequest** (`approved`); a **User** is activated and bound to the unit. Applicant can now log in (read access).
4b. *(Secretary)* **Rejects** → **RegistrationRequest** (`rejected`). Applicant is informed and may re-register.

### 6.2 Flow B — Raise charges → Record payment → See balance
1. *(Treasurer)* Raises charges in bulk for the cycle → one **Charge** (`outstanding`) per unit at its `charge_rate`.
2. *(Resident)* Pays offline by any method (cash/UPI/cheque/transfer). *No system action — payment happens in real life.*
3. *(Treasurer)* Records the payment against that unit's Charge → creates **Payment** + a corresponding `in` **Transaction**.
4. *(System)* Charge status re-derives: `settled` if cumulative Payments cover it, else stays partly `outstanding` (partial payment).
5. *(System)* Society **balance** re-derives from the ledger.
6. *(Any member)* Opens dashboard → sees updated balance, the new transaction, and that unit now marked paid (or partly paid).

### 6.3 Flow C — Correct a mistake
1. *(Treasurer)* Identifies an incorrect **Transaction** (e.g. wrong amount).
2. *(Treasurer)* Posts a **reversing entry** → original **Transaction** set to `reversed`; a new offsetting Transaction is created.
3. *(Treasurer)* Posts a **corrected entry** → new **Transaction** with the right values.
4. *(System)* Balance re-derives from active entries only. **Nothing was edited or deleted** — original, reversal, and correction all remain visible.
5. *(Any member)* Can see the full correction trail on the dashboard.

> This flow exists to prevent the most likely implementation mistake: editing a row in place. Corrections are *new facts*, never overwrites (§8).

### 6.4 Flow D — Raise a complaint
1. *(Any member)* Writes a complaint → creates **Complaint** (text, tied to their unit).
2. *(System)* Complaint is immediately visible to all members.
3. *(Any member)* Reads all complaints. No status changes, replies, or privacy in Phase 1.

## 7. Screens

Purpose and key elements per screen. The Treasurer and read-only dashboards render the **same data**; they differ only in whether write controls appear (FR-53).

### 7.1 Expense Dashboard (Member view — read-only)
**Purpose:** the transparency surface for all money movement; the primary ledger screen for every member.
**Key elements:**
- Four stat cards for the selected cycle: **Opening Balance** (previous month's closing balance), **Collected**, **Spent**, **Current Balance** (derived: opening + collected − spent).
- **Transaction list** — all `in`/`out` entries with date, amount, description; reversed entries shown as part of the correction trail.
- Calendar month picker (top-right) to view any past cycle.
- No entry controls visible.

### 7.2 Expense Dashboard (Treasurer view — read + write)
**Purpose:** same Expense Dashboard, plus the entry actions.
**Key elements:** everything in 7.1, plus:
- **Record transaction** (in/out).
- **Correct entry** (reverse + re-enter).

### 7.3 Maintenance Dashboard (Member view — read-only)
**Purpose:** maintenance dues surface — who has paid, collected totals, outstanding dues for the selected cycle.
**Key elements:**
- **Units paid / total** count for the selected cycle.
- **Collected vs Outstanding** split stat card for the selected cycle.
- **Rate per unit** (flat rate, ₹3,000/cycle in Phase 1).
- **Per-unit paid/unpaid table** — unit pill buttons; clicking a unit opens a detail drawer showing member-since year, months paid (GitHub-style 24-month payment grid), and pending dues.
- Calendar month picker (top-right) to view any past cycle.
- No entry controls visible.

### 7.4 Maintenance Dashboard (Treasurer view — read + write)
**Purpose:** same Maintenance Dashboard, plus the collection actions.
**Key elements:** everything in 7.3, plus:
- **Raise charges** (bulk, per cycle).
- **Record payment** against a unit's charge.

### 7.5 My Unit
**Purpose:** a member's own dues and payment history.
**Key elements:**
- This unit's **charges** by cycle and their status (outstanding / partly paid / settled).
- **Payment history** for the unit (amount, method, reference, date).
- Read-only — residents cannot record or confirm payments here (§1.4).

### 7.6 Admin / Approvals (Secretary)
**Purpose:** gate unauthorised registrations (requirement 6).
**Key elements:**
- List of **pending RegistrationRequests** with applicant details and claimed unit.
- **Approve** / **Reject** actions.
- Visible only to a user with `can_approve` (the Secretary).

## 8. Data Integrity & Trust Rules

These rules are the heart of the product. Per the §2.3 tie-breaker, they win over convenience.

- **IR-1 Append-only ledger.** Transactions are never edited or deleted after creation.
- **IR-2 Corrections are entries, not edits.** A mistake is fixed by a reversing entry (which marks the original `reversed`) plus a corrected entry. The full trail stays visible forever.
- **IR-3 Derived balance.** The society balance is always computed from active ledger entries, never stored as a hand-editable number.
- **IR-4 Derived charge status.** A charge is `settled`/`outstanding` based on Payments against it — never set directly.
- **IR-5 Payment ⇒ ledger.** Every Payment produces exactly one `in` Transaction, so "who paid" and "the balance" can never disagree.
- **IR-6 Single writer.** Only the Treasurer writes financial records; this keeps responsibility for the ledger unambiguous.
- **IR-7 Attribution.** Every financial record carries who recorded it and when.
- **IR-8 Mandatory description.** Every transaction must carry a plain-language description — a number without explanation does not build trust.
- **IR-9 Gated registration.** No user gains access without explicit approval by the Secretary.

## 9. Out of Scope (Deferred to Later Phases)

Deliberately excluded from Phase 1; recorded so intent isn't lost.

- **Complaints & announcements** — complaints board and member communication removed from Phase 1 scope; planned for a later phase.
- **Online payments** — gateway/UPI integration, automated reconciliation.
- **Resident payment self-service** — residents claiming/confirming their own payments (the strongest trust upgrade; the §4.6 Payment entity already has room for a confirmation state).
- **Reminders & notifications** — email/SMS/push to defaulters; in-app announcements.
- **Reports & exports** — PDF/Excel statements, annual summaries, budget-vs-actual.
- **Variable dues** — per-unit or per-type rates (model is already per-unit; Phase 1 just sets one rate).
- **Richer roles** — full permission engine; expanded committee powers; President as second approver / large-expense sign-off.
- **Complaint lifecycle** — status, replies, assignment, public/private visibility.
- **Receipts/attachments** — proof images on transactions and payments.
- **Audit-log as a feature** — beyond the append-only ledger's inherent history.

## 10. Open Questions / Decisions Pending

- **OQ-1 Single-society schema.** Phase 1 is single-society by decision (§1.6). Consequence: the schema is **not** society-scoped, so introducing a second society later would require a data migration on a live financial ledger. Accepted for now; flagged so it's a conscious future cost, not a surprise.
- **OQ-2 Multiple users per unit.** The model allows it (owner + spouse). Phase 1 has not defined whether they have identical access or an owner/tenant distinction — currently identical. Revisit if needed.
- **OQ-3 Re-registration after rejection.** A rejected applicant may re-register (§6.1). No limit on attempts is defined; acceptable for a meta version.
- **OQ-4 Cycle definition.** "Cycle" is assumed monthly (e.g. `2026-05`). Confirm if any society uses a different period.
- **OQ-5 Partial-payment display.** Partial payments are supported (FR-31); exact presentation of "partly paid" on the dashboard is left to build-time.

## 11. Mockup Design Decisions

The following implementation choices made during mockup design are recorded here so they are not accidentally reversed during build.

- **Two separate dashboards.** The single dashboard is split into an **Expense Dashboard** (transaction ledger, balance, in/out totals) and a **Maintenance Dashboard** (who paid, collected vs outstanding split card, unit detail drawer). Each has its own write controls for the Treasurer.
- **Category field removed from transactions.** The free-text category column on the Transaction table is omitted from the UI. The mandatory description field (IR-8) is sufficient for trust and reduces Treasurer data-entry friction.
- **Calendar month picker.** Both dashboards feature a "Change date" button that opens a compact calendar (year arrows + 12-month grid) so any member can view historical cycle data. Months without recorded data are visually disabled.
- **Unit detail drawer.** In the Maintenance Dashboard's who-paid table, each unit is a clickable pill. Clicking opens a slide-in drawer showing: owner name, member-since year, months paid count (of last 24), pending dues, and a GitHub-style 24-month payment history grid (green = paid, amber = partial, grey = unpaid, dashed = future/pre-registration).
- **Collected / Outstanding split card.** The Activity stat card in the Maintenance Dashboard is split into two halves side-by-side (collected | outstanding) to show both figures without needing two full-width cards.

---

*Appendix: This PRD was co-authored conversationally; design rationale lives in the originating conversation.*
