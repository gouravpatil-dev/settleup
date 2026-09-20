# SettleUp

A group expense-sharing and debt-settlement app. The core technical
piece is the settlement optimizer, which turns a group's raw
expense obligations into a reduced set of final payments — not yet
built (that's Phase 4–5).

**Status: Phase 3 (Expense Engine) complete.** The balance engine and
settlement optimizer are not implemented yet.

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

## What's built (Phase 3)

- **Split calculator** (`services/splitCalculator.ts`): pure functions,
  no DB/Express dependency. Supports equal, exact, percentage, and
  share-based splits. All four use a "largest remainder" apportionment
  method so a split always sums to exactly the total amount — no lost
  or invented paise from floating-point division. Percentages are
  converted to basis points internally to avoid float rounding drift.
- **Expenses**: `expenses` + `expense_participants` tables (amounts as
  integer minor units, per the Phase 1 schema decision). Create/list/
  get endpoints nested under a group
  (`/api/groups/:groupId/expenses`), all behind `requireAuth` +
  membership checks.
- **Validation**: exact splits must sum to the total; percentages must
  sum to 100 (±0.01 to tolerate things like three-way 33.33/33.33/
  33.34 splits); shares must be positive integers; the payer and every
  participant must belong to the group; no duplicate participants.
- **Assumption made**: the API accepts `amount` as an integer in minor
  currency units (e.g. paise, cents) directly from the client, not as
  a decimal rupee/dollar figure — this keeps the float-free boundary
  consistent end-to-end rather than converting at the API edge. Worth
  revisiting once the frontend expense form (Phase 6) is built, if a
  decimal input feels more natural there.
- 39 new tests (62 total): 23 pure split-calculator tests (all four
  split types, remainder distribution, rejection of bad input) plus
  16 integration tests (one creation test per split type, rejection
  of bad exact/percentage/shares input, non-member participant/payer
  rejected, non-positive amount rejected, unauthenticated/non-member
  access denied, list and get-by-id, cross-group expense id correctly
  404s).

## What's built (Phase 2)

- **Auth**: register/login/logout backed by session cookies (httpOnly,
  `sameSite: lax`, `secure` in production), 7-day sessions stored in a
  `sessions` table, bcrypt password hashing (12 rounds). Login and
  registration failures never reveal whether an email is registered.
- **Groups**: create, rename, delete, list-for-user, get-details — all
  behind `requireAuth`.
- **Membership**: add/remove members by email, list members,
  owner-only authorization for rename/delete/add/remove, and a guard
  against removing a group's last owner.
- **Isolation**: a non-member requesting a group they don't belong to
  gets a 404 (identical to "group doesn't exist"), never a 403 that
  would confirm the group's existence.

## What's built (Phase 1)

- Express app with centralized error handling (`AppError` hierarchy),
  a generic Zod-based request validator, and a health endpoint
  (`GET /api/health`)
- SQLite connection + an idempotent migration runner
- React app shell: router, nav, a `Dashboard` page that calls the real
  health endpoint, a `Groups` placeholder, and a 404 page
- `useAsync` hook and `LoadingState`/`ErrorState` components

## Known limitations / not yet done

- No balance engine or settlement optimizer yet (Phases 4–5) — nothing
  yet converts expenses into "who owes whom"
- No expense update/delete — Phase 3 scope was creation, per the
  build plan; edit/delete would follow the same
  authorization/ownership pattern as groups if added
- Frontend has no expense UI yet — scheduled for Phase 6
- No CSRF protection, no rate limiting on login/register — deferred to
  Phase 15 (security pass)
- No email verification or password reset
- `npm audit` flags some vulnerabilities in transitive dev
  dependencies — not yet triaged; revisit at Phase 15