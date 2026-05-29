# Technical Requirements Document — Society Maintenance & Expense Tracker (Phase 1)

> **Status:** Draft v1 (complete) · **Phase:** 1 (Meta / MVP) · **Companion to:** PRD.md · **Last updated:** 27 May 2026

---

## 1. Technology Stack

| Layer | Choice | Rationale (Phase 1) |
|---|---|---|
| **Frontend** | React (SPA) | Team familiarity; app is form/table-heavy and well-suited to React. Talks to the backend over JSON/REST. |
| **Backend** | Python + FastAPI | Async-capable, self-documenting (OpenAPI/Swagger), Pydantic validation maps directly onto the PRD's integrity rules. |
| **Database** | PostgreSQL | Chosen over MySQL specifically because this is a financial ledger: stronger constraint enforcement, reliable `NUMERIC` money handling, and dependable transactional/`CHECK` guarantees — exactly what IR-1…IR-9 require. |
| **ORM / Migrations** | SQLAlchemy + Alembic | Versioned, reviewable schema migrations — important given the known single→multi-society migration (PRD OQ-1). |
| **Auth** | JWT (token-based) | Stateless fit for React SPA ↔ FastAPI; token carries role + `can_approve` for authorization (§5). |
| **Containerization** | Docker | Standard; one image for the API, static build for the frontend. |
| **Hosting** | Azure Container Apps | Serverless containers, scales to zero (cost-efficient for single-society light traffic), low operational overhead vs. AKS. |
| **Managed DB** | Azure Database for PostgreSQL (Flexible Server) | Managed Postgres; no self-hosting of the data store. |

**Non-negotiable cross-cutting rules** (detailed in §7): money is a fixed-precision **decimal** end to end; the PRD's integrity model (IR-1…IR-9) is enforced in the **backend and database**, never in the frontend.

## 2. System Architecture

### 2.1 Shape — classic 3-tier
```
React SPA  ──HTTPS/JSON──▶  FastAPI service  ──SQLAlchemy──▶  PostgreSQL
(browser)                   (single deployable)               (Azure managed)
```
One frontend, one backend service, one database. No microservices — distributed overhead would buy nothing at single-society scale.

### 2.2 Backend internal organization
Although deployed as one service, the code is organized into clear internal modules so the ledger logic stays isolated and testable, and so Phase-2 growth is cheap:
- **identity** — users, roles, registration/approval, JWT issuance.
- **ledger** — transactions, charges, payments; the IR-1…IR-9 logic.
- **read/dashboard** — derived views (balance, per-unit paid/unpaid) that read across modules. Serves both the Expense Dashboard and Maintenance Dashboard.

### 2.3 Request path
1. SPA calls a REST endpoint with a JWT in the `Authorization` header.
2. FastAPI validates the token, resolves role + `can_approve`, and authorizes the action (§5).
3. Pydantic validates the request body.
4. The relevant module executes business logic within a DB transaction.
5. For money writes, both the app-layer rules **and** the DB-level guardrails (§2.4) apply.

### 2.4 Integrity enforcement — two layers (defense in depth)
Per the chosen approach, IR-1 (append-only) and related rules are enforced at **both** layers:
- **Application layer** — the only sanctioned way to "change" a transaction is to post a reversing entry plus a correction (PRD Flow C). The service layer exposes no update/delete operation for financial rows.
- **Database layer** — a guardrail that makes violations impossible even outside the app: `UPDATE`/`DELETE` on the ledger table are blocked (revoked grants and/or a trigger that raises on row mutation). A buggy code path, an ad-hoc query, or a bad migration cannot silently alter a financial record.

This is what turns IR-1 from a convention into a guarantee, satisfying PRD §2.3 ("trust wins").

### 2.5 Derived values
The society **balance** is computed on demand by summing active ledger entries (no stored/cached balance). A charge's **settled/outstanding** status is likewise derived from its Payments. At Phase-1 data volumes this is instant and cannot drift. (If multi-society scale ever makes this slow, a materialized view is the documented later optimization — not a Phase-1 concern.)

## 3. Data Layer (Schema & Integrity)

Tables map to the PRD's seven entities. Money columns are **`NUMERIC(12,2)`** (fixed-precision decimal) — never float. All timestamps are UTC. Financial tables use **status fields, never soft-delete** (IR-1, IR-2).

### 3.1 Tables (Phase 1)

**`units`**
`id` (PK) · `identifier` · `type` (enum: villa/bungalow/apartment/individual_house) · `charge_rate NUMERIC(12,2)` · `created_at`

**`users`**
`id` (PK) · `name` · `email`/`phone` (unique) · `password_hash` · `unit_id` (FK) · `role` (enum: treasurer/committee/resident) · `can_approve BOOLEAN` · `status` (enum: active/pending/rejected) · `created_at`

**`registration_requests`**
`id` (PK) · `name` · `contact` · `claimed_unit_id` (FK) · `status` (enum: pending/approved/rejected) · `decided_by` (FK users) · `decided_at` · `created_at`

**`transactions`** — *append-only*
`id` (PK) · `direction` (enum: in/out) · `amount NUMERIC(12,2)` `CHECK (amount > 0)` · `txn_date` · `description` (NOT NULL) · `category` (text) · `recorded_by` (FK users) · `recorded_at` · `reverses_transaction_id` (FK self, nullable) · `status` (enum: active/reversed)

**`charges`** — what is owed
`id` (PK) · `unit_id` (FK) · `cycle` (e.g. `2026-05`) · `amount NUMERIC(12,2)` `CHECK (amount > 0)` · `raised_by` (FK users) · `raised_at` · *(status derived, not stored)*

**`payments`** — what is paid
`id` (PK) · `charge_id` (FK) · `unit_id` (FK) · `amount NUMERIC(12,2)` `CHECK (amount > 0)` · `method` (text) · `reference` (text, nullable) · `transaction_id` (FK transactions — the `in` entry it produced) · `recorded_by` (FK users) · `recorded_at`

**`complaints`**
`id` (PK) · `raised_by` (FK users) · `unit_id` (FK) · `text` · `raised_at`

### 3.2 Integrity at the DB level
- **Append-only guardrail on `transactions`:** `UPDATE` and `DELETE` are blocked (revoked grants and/or a `BEFORE UPDATE/DELETE` trigger that raises). The only mutation permitted is flipping `status` active→reversed, performed by the sanctioned reversal routine — implemented so it cannot be used to alter amounts or other fields.
- **`CHECK (amount > 0)`** on every money column — no zero or negative amounts.
- **Foreign keys** enforce that every Payment ties to a real Charge and Unit, and that a reversal references a real original transaction.
- **A reversal cannot itself be reversed** (guard on `reverses_transaction_id` chains).
- **Partial payments:** a Charge is `settled` when `SUM(payments.amount) >= charge.amount`, else partly outstanding — computed, never stored (PRD FR-22, FR-31).

### 3.3 Migrations
All schema changes go through **Alembic** — versioned and reviewable. The single→multi-society change (PRD OQ-1) is explicitly anticipated as a future migration (adding a `society_id` scope); designing migrations cleanly now keeps that path open.

### 3.4 Money & timezone rules
- Money: `NUMERIC(12,2)` in Postgres ↔ Python `Decimal` ↔ string in JSON. **No floating-point arithmetic on money anywhere.**
- Time: store UTC; render in the society's local timezone (IST) at the frontend.

## 4. API Design

REST over JSON. The live contract is the **auto-generated OpenAPI/Swagger** from FastAPI; the table below is the design-level list. **Financial resources expose no PUT or DELETE** — the only correction path is a reverse action that creates new entries (IR-1, IR-2).

### 4.1 Endpoints

| Method | Path | Who can call | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Create a `pending` RegistrationRequest (FR-1, FR-2). |
| POST | `/auth/login` | public | Authenticate; returns JWT with role + `can_approve` (FR-5). |
| GET | `/registrations` | `can_approve` | List pending requests. |
| POST | `/registrations/{id}/approve` | `can_approve` | Approve → activate user (FR-4). |
| POST | `/registrations/{id}/reject` | `can_approve` | Reject; applicant may re-register (FR-4). |
| GET | `/units` | any member | List units. |
| POST | `/units` | treasurer | Pre-load a unit (FR-12). |
| GET | `/transactions` | any member | Read ledger (FR-50). |
| POST | `/transactions` | treasurer | Record an `in`/`out` entry (FR-40). |
| POST | `/transactions/{id}/reverse` | treasurer | Post reversal + correction (FR-42). **No PUT/DELETE exists.** |
| POST | `/charges/bulk` | treasurer | Raise charges for all units for a cycle (FR-20). |
| GET | `/charges` | any member | View charges (filter by unit/cycle). |
| POST | `/payments` | treasurer | Record a payment against a charge; creates the linked `in` transaction (FR-30…FR-32). |
| GET | `/units/{id}/dues` | any member | A unit's charges + payment history (FR-52). |
| GET | `/dashboard/expenses` | any member | Derived balance + full transaction ledger for a given cycle (FR-50, FR-51). |
| GET | `/dashboard/maintenance` | any member | Collected totals + per-unit paid/unpaid for a given cycle (FR-50). |

### 4.2 Conventions
- All non-public endpoints require a valid JWT; authorization is checked server-side per the "Who can call" column (§5).
- Money fields are transmitted as **strings** in JSON to preserve decimal precision; parsed to `Decimal` server-side.
- Errors use standard HTTP status codes with a consistent JSON error body.
- Absence of mutate/delete endpoints on financial resources is intentional and load-bearing, not an omission.

## 5. Authentication & Authorization

### 5.1 Authentication (JWT)
- **Login** verifies credentials against `users.password_hash` (passwords hashed with a strong adaptive algorithm, e.g. bcrypt/argon2 — never stored or logged in plaintext) and issues a signed JWT.
- The JWT carries: `user_id`, `role`, `can_approve`, `unit_id`, expiry.
- The SPA sends it as `Authorization: Bearer <token>`. The backend is stateless; no server session store in Phase 1.
- Token signing secret is held in Azure configuration/Key Vault, never in code or the repo.

### 5.2 Authorization (role-based, server-side)
Authorization is enforced **on the backend**, never trusted to the frontend. Each endpoint checks the token's claims against its required capability:
- **Write to ledger** (transactions, charges, payments, reverse) → `role == treasurer`.
- **Approve/reject registrations** → `can_approve == true` (the Secretary).
- **Pre-load units** → `role == treasurer`.
- **Read dashboard / records / complaints, raise complaints** → any active member.
- **Pending/rejected users** → no access to any society data.

The frontend may *hide* controls a user can't use (UX), but the backend independently rejects unauthorized calls (security). Hiding a button is not access control.

### 5.3 Notes
- Registration does not grant access; only approval does (FR-3, FR-4).
- Phase 1 has no password reset, MFA, or SSO — deferred (§10 / PRD §9).

## 6. Frontend Architecture

### 6.1 Shape
- React SPA, single build, served as static assets.
- Talks to the FastAPI backend over JSON/REST; no business logic or integrity rules live in the frontend.
- Routes map to the PRD screens (§7): expense-dashboard, maintenance-dashboard, my-unit, admin/approvals, plus login/register. Complaints are out of scope for Phase 1.

### 6.2 Role-driven rendering
- The JWT's `role`/`can_approve` drive which controls render: the Treasurer sees entry controls; the Secretary sees the approvals screen; everyone sees the read-only dashboard.
- This is **UX convenience only** — every action is independently authorized server-side (§5.2).

### 6.3 Money handling on the client
- Money arrives as strings; the client uses a decimal-safe representation for display and never does floating-point math on amounts.
- Amounts rendered with currency and the society's locale (IST, ₹).

### 6.4 State & data fetching
- Server state via a data-fetching layer (e.g. React Query or equivalent) so the dashboard reflects the latest derived balance after each write.
- Auth token stored following standard SPA security practice; protected routes redirect unauthenticated users to login.

## 7. Money & Integrity Enforcement (cross-cutting)

This section consolidates the rules that span every layer. They implement PRD §8 (IR-1…IR-9).

### 7.1 Money type, end to end
| Layer | Representation |
|---|---|
| PostgreSQL | `NUMERIC(12,2)` |
| Python / FastAPI | `Decimal` |
| JSON / API | string (e.g. `"3000.00"`) |
| React | decimal-safe display value |

**No floating-point arithmetic on money at any layer.** All sums (balance, charge settlement) use exact decimal arithmetic.

### 7.2 Append-only, enforced twice
- **App layer:** no service method updates or deletes a financial row; corrections go through the reversal routine only.
- **DB layer:** `UPDATE`/`DELETE` blocked on `transactions` (revoked grants and/or trigger). Even direct DB access cannot silently mutate the ledger.

### 7.3 Derivation, not storage
- Balance = `SUM(active in) − SUM(active out)`, computed per request.
- Charge status = derived from `SUM(payments)` vs `charge.amount`.
- No stored balances or paid-flags that could drift (IR-3, IR-4).

### 7.4 Atomicity
- Recording a Payment and creating its linked `in` Transaction happen in **one DB transaction** — they cannot half-succeed (IR-5).
- A reversal + correction is likewise atomic.

### 7.5 Attribution & validation
- Every financial row records `recorded_by` and `recorded_at` (IR-7).
- Description is mandatory on transactions (IR-8); `amount > 0` enforced by `CHECK` (DB) and Pydantic (app).

## 8. Containerization & Deployment (Azure)

### 8.1 Topology
- **Frontend** — React built to static assets, served via **Azure Static Web Apps** (or blob + CDN). CDN-cached; no container needed.
- **Backend** — FastAPI in a **Docker** image, running on **Azure Container Apps** (serverless, scales to zero).
- **Database** — **Azure Database for PostgreSQL (Flexible Server)**, one server hosting **separate `dev` and `prod` databases**. Production data is never used for development or migration testing.

### 8.2 Container
- Single backend image (FastAPI + dependencies), built from a pinned base image.
- Image stored in **Azure Container Registry (ACR)**.

### 8.3 CI/CD (GitHub Actions, kept minimal)
1. On push to the main branch: build the backend image.
2. Push to ACR.
3. Deploy the new revision to Container Apps.
4. Run Alembic migrations against the target database as a release step.
Frontend builds deploy to Static Web Apps on the same trigger. The pipeline is intentionally simple for Phase 1; elaboration (staging gates, approvals) is deferred.

### 8.4 Secrets & configuration
- **Phase 1 decision:** secrets (JWT signing secret, DB credentials) and config are supplied via **environment variables** on Container Apps. No code or repo ever contains secrets.
- ⚠️ **Known tradeoff / hardening step:** env-vars-only is simpler but weaker than a managed secret store. For a system holding financial records, migrating secrets to **Azure Key Vault** (with Container Apps referencing Key Vault secrets) is the recommended Phase-2 hardening and is recorded as such in §10. This is a consciously deferred decision, not an oversight.

### 8.5 Transport & basics
- HTTPS enforced end to end (Static Web Apps and Container Apps provide TLS).
- CORS configured to allow only the known frontend origin.
- Database reachable only from the backend (no public DB exposure).

## 9. Non-Functional Requirements

- **Correctness over performance.** Financial accuracy is paramount; the derived-balance approach is chosen for correctness, and Phase-1 data volumes make it fast regardless.
- **Scale (Phase 1).** A single society — hundreds of units, light, mostly-read traffic. Container Apps scale-to-zero suits the low and bursty load.
- **Availability.** Best-effort for a meta version; managed Azure services provide the baseline. No formal SLA in Phase 1.
- **Security baseline.** HTTPS everywhere; hashed passwords; server-side authorization on every protected endpoint; restricted DB exposure; least-privilege DB grants (which also back the append-only guardrail). Secrets handling per §8.4 (env vars now, Key Vault later).
- **Data integrity.** Enforced at app + DB layers (§7); this is the system's primary quality attribute.
- **Auditability.** The append-only ledger is itself the audit trail of financial actions; every entry is attributed and timestamped.
- **Maintainability.** Modular backend (§2.2), Alembic-versioned schema, auto-generated API docs.
- **Backups.** Rely on Azure PostgreSQL automated backups; verify retention is enabled before go-live.
- **Privacy.** Personal data limited to what's needed (name, contact, unit). No payment-card or bank data is ever stored (payments are offline; only a free-text reference is kept).

## 10. Technical Risks & Open Decisions

- **TR-1 Secrets in env vars (accepted Phase-1 risk).** Per §8.4, secrets use env vars, not Key Vault. Risk: weaker protection of the JWT secret and DB credentials. Mitigation/plan: migrate to Azure Key Vault as the first Phase-2 hardening. Consciously accepted for the meta version.
- **TR-2 Single-society schema (PRD OQ-1).** Schema is not society-scoped. Adding a second society later requires an Alembic migration to introduce a `society_id` scope across financial tables — non-trivial on live data. Migrations are designed cleanly now to keep this path open.
- **TR-3 Append-only guardrail correctness.** The DB-level block on `UPDATE`/`DELETE` for `transactions` must still permit the sanctioned active→reversed status flip without opening a hole for arbitrary edits. This trigger/grant logic needs careful implementation and a dedicated test.
- **TR-4 JWT token handling.** Statelessness means no server-side revocation in Phase 1; a leaked token is valid until expiry. Keep token lifetimes short; revocation/refresh is a Phase-2 consideration.
- **TR-5 Cycle definition (PRD OQ-4).** "Cycle" assumed monthly (`YYYY-MM`). Confirm before finalizing the `charges` schema if any non-monthly period is needed.
- **TR-6 Multiple users per unit (PRD OQ-2).** Currently all users on a unit have identical access. Owner/tenant distinction deferred; no schema blocker.
- **TR-7 Backup verification.** Automated backups assumed; must be confirmed enabled with adequate retention before go-live — non-negotiable for a financial system.

## 11. Mockup Implementation Notes

Decisions made during mockup prototyping that have build implications.

- **Two dashboard endpoints.** The single `/dashboard` endpoint is split into `/dashboard/expenses` and `/dashboard/maintenance`. Both accept a `?cycle=YYYY-MM` query parameter. The `/dashboard/expenses` response must include `open_balance` (the closing balance of the previous cycle), `collected`, `spent`, and `close_balance` (derived: open + collected − spent) so the four stat cards on the Expense Dashboard can be populated.
- **Unit detail endpoint.** The unit-detail drawer on the Maintenance Dashboard requires a `GET /units/{id}/history` endpoint (or an extended `/units/{id}/dues` response) that returns per-cycle payment status for the last 24 months, suitable for rendering the GitHub-style payment grid.
- **Category field.** The `category` column on `transactions` is retained in the schema (it may be used for filtering or reporting later) but is not rendered in the Phase 1 UI. The Treasurer does not fill it in Phase 1.
- **Complaints removed.** The `complaints` table, `GET /complaints`, and `POST /complaints` endpoints are not built in Phase 1. The `engagement` backend module is removed. No frontend route for complaints exists.

---

*Appendix: This TRD is the technical companion to PRD.md. Functional requirements (FR-*) and integrity rules (IR-*) referenced here are defined in the PRD.*
