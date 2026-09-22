# SettleUp

A group expense-sharing and debt-settlement app. The core technical
piece is the settlement optimizer, which turns a group's raw
expense obligations into a reduced set of final payments — not yet
built (that's Phase 4–5).

**Status: Phase 4 (Balance Engine) complete.** The settlement
optimizer is not implemented yet.

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

## What's built (Phase 4)

- **Balance engine** (`algorithm/balanceCalculator.ts`): a pure
  `calculateBalances()` function, no DB/Express dependency. Takes
  member ids, expenses (payer + resolved participant shares), and an
  optional settlements list; returns each member's net balance
  (positive = owed money, negative = owes money). Every member is
  seeded at zero so someone with no expenses still shows as settled,
  and any id that turns up in expenses/settlements but isn't in
  memberIds is still included — balances are never silently dropped.
- Settlements are already a first-class input to the engine even
  though there's no settlements table yet — that lands in Phase 7
  ("mark as paid"); wiring real ones in later is additive to
  `BalanceService`, not a rewrite of the engine.
- `GET /api/groups/:groupId/balances` — membership-gated, returns
  each member's balance plus name/email for display.
- Small refactor: the repeated "is this user a member of this group"
  check (previously duplicated in `GroupService` and `ExpenseService`)
  is now a shared `requireGroupMembership()` helper, used by all three
  services including the new `BalanceService`.
- 17 new tests (79 total): 12 unit tests on the balance engine (single
  expense, multiple expenses, multiple payers — the worked example
  from the spec, unequal splits, a member with no expenses at all,
  a payer who's also a participant netting to zero, full and partial
  settlements, rounding-remainder splits still summing to zero, 25
  members × 60 expenses with no drift, and a defensive case for a
  balance id outside the known member list) plus 5 integration tests.

## What's built (Phase 3)

- **Split calculator** (`services/splitCalculator.ts`): pure functions,
  no DB/Express dependency. Supports equal, exact, percentage, and
  share-based splits, using a "largest remainder" apportionment method
  so a split always sums to exactly the total amount.
- **Expenses**: `expenses` + `expense_participants` tables. Create/
  list/get endpoints nested under a group.
- **Assumption made**: the API accepts `amount` as an integer in minor
  currency units directly from the client, not a decimal figure.

## What's built (Phase 2)

- **Auth**: register/login/logout backed by session cookies, bcrypt
  password hashing, 7-day sessions. Login/registration never reveal
  whether an email is registered.
- **Groups & membership**: full CRUD, owner-only authorization,
  last-owner-removal guard, and non-member access returns 404.

## What's built (Phase 1)

- Express app with centralized error handling, Zod validation,
  SQLite + idempotent migrations, health endpoint.
- React app shell: router, nav, `Dashboard`/`Groups`/404 pages,
  `useAsync` hook, loading/error components.

## Known limitations / not yet done

- No settlement optimizer yet (Phase 5) — balances exist, but nothing
  yet converts them into a minimal set of payments
- No settlement persistence/history — the engine supports it, the API
  doesn't expose it yet (Phase 7)
- No expense updation or deletion
- Frontend has no expense/balance UI yet — scheduled for Phase 6
- No CSRF protection, no rate limiting, no email verification/password
  reset — all deferred to Phase 15
- `npm audit` flags some vulnerabilities in transitive dev
  dependencies — not yet triaged

## Next phase

**Phase 5 — Settlement Optimizer V1**: a pure algorithm module that
takes net balances and produces a reduced set of settlement
transactions (greedy creditor/debtor matching), with invariant-based
tests (money conserved, all balances resolve to zero, no self-
payments, no non-positive transfers, deterministic output).
