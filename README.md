# SettleUp

A group expense-sharing and debt-settlement app. The core technical
piece is the settlement optimizer, which turns a group's raw
expense obligations into a reduced set of final payments — not yet
built (that's Phase 4–5).

**Status: Phase 5 (Settlement Optimizer V1) complete.** All core
algorithm/backend phases (1–5) are done. The frontend still only has
the Phase 1 app shell — no real UI for any of this yet (Phase 6).

## Stack

- **Backend:** Node.js, Express, TypeScript, SQLite (`better-sqlite3`)
- **Frontend:** React, Vite, TypeScript, React Router
- **Testing:** Vitest (both server and client)

## Project layout

```
settleup/
  client/   React + Vite frontend
  server/   Express + TypeScript backend
  shared/   Types/schemas shared between client and server (not yet used)
  tests/    Cross-cutting test suites (e.g. algorithm tests, once Phase 4/5 land)
```

## Local development

Two separate npm projects — install and run each independently.

**Backend**
```
cd server
cp .env.example .env
npm install
npm run dev       # http://localhost:4000
npm test          # run backend tests
npm run build     # production build → server/dist
```

**Frontend**
```
cd client
npm install
npm run dev        # http://localhost:5173
npm test           # run frontend tests
npm run build       # production build → client/dist
```

The frontend calls the backend at `http://localhost:4000/api` by
default; override with `VITE_API_URL` if needed.

## What's built (Phase 5)

- **Settlement optimizer** (`algorithm/settlementOptimizer.ts`): pure
  `optimizeSettlements()` function, greedy creditor/debtor matching.
  Repeatedly pays the largest remaining debtor to the largest
  remaining creditor until every balance is zero. Deterministic
  (ties broken by userId), and explicitly documented as NOT
  guaranteed-minimal in every case — that's the harder exact-solver
  problem deferred to Phase 13, per the spec's caution about not
  overclaiming optimality.
- `GET /api/groups/:groupId/settlements/plan` — membership-gated,
  returns the reduced transaction list with `fromName`/`toName` for
  display.
- 15 new tests (94 total): 11 unit tests directly on the optimizer,
  including one that reproduces the exact worked example from the
  spec (A +500, B +100, C -300, D -300 → C→A 300, D→A 200, D→B 100 —
  greedy matches it exactly) and invariant-based tests checked against
  every case (total outgoing = total positive balance, applying the
  plan zeroes every balance, no non-positive transfers, no
  self-payment, deterministic output for repeated runs), plus 4
  integration tests through the real API.

## What's built (Phase 4)

- **Balance engine** (`algorithm/balanceCalculator.ts`): pure
  `calculateBalances()`, no DB/Express dependency. Already accepts an
  optional settlements list (unused for now — no settlements table
  yet; that's Phase 7).
- `GET /api/groups/:groupId/balances`.
- Shared `requireGroupMembership()` helper used by all services.

## What's built (Phase 3)

- **Split calculator** (`services/splitCalculator.ts`): equal, exact,
  percentage, and share-based splits, using "largest remainder"
  apportionment so a split always sums to exactly the total.
- **Expenses**: create/list/get endpoints, all validated against
  group membership.
- **Assumption made**: the API accepts `amount` as an integer in minor
  currency units directly from the client.

## What's built (Phase 2)

- **Auth**: register/login/logout via session cookies, bcrypt hashing.
- **Groups & membership**: full CRUD, owner-only authorization,
  last-owner-removal guard, non-member access returns 404.

## What's built (Phase 1)

- Express app foundation, SQLite + migrations, health endpoint.
- React app shell: router, nav, `Dashboard`/`Groups`/404 pages.

## Known limitations / not yet done

- No frontend UI for any of groups/expenses/balances/settlements yet
  — everything above is backend/API only; Phase 6 builds the actual
  screens
- No settlement persistence/history (no "mark as paid") — the plan is
  computed on the fly each time, nothing is recorded yet (Phase 7)
- No expense update/delete
- No CSRF protection, no rate limiting, no email verification/password
  reset — all deferred to Phase 15
- The optimizer is greedy only — no exact/minimal-transaction-count
  solver yet (Phase 13)
- `npm audit` flags some vulnerabilities in transitive dev
  dependencies — not yet triaged

## Next phase

**Phase 6 — Expense and Balance UI**: the actual application
experience — Dashboard, Groups, Group Details, Add Expense, Expense
Details, Balances pages, with a multi-step add-expense flow and
obvious split-validation feedback. This is the first phase that
gives the backend built in Phases 2–5 a real interface.
