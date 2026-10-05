# SettleUp

A group expense-sharing and debt-settlement app. The core technical
piece is the settlement optimizer, which turns a group's raw
expense obligations into a reduced set of final payments — not yet
built (that's Phase 4–5).

**Status: Phase 7 (Settlement Experience) complete.** Balances, the
settlement optimizer, and now actually recording/undoing payments are
all wired end to end, front to back. See the scope note below for
what's next.

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

## What's built (Phase 6)

- **Auth screens** (not in the original phase list, added as necessary
  prerequisite infrastructure — nothing else in the app works without
  a way to log in): `Login`/`Register` pages, an `AuthProvider`
  context resolving the session on load, and a `RequireAuth` route
  guard redirecting to `/login`.
- **Pages**: `Dashboard` (your groups at a glance), `Groups` (list +
  create), `GroupDetails` (total spending, settlement status, recent
  expenses, member list, add/remove members, delete group — all
  owner-gated in the UI to match the backend's authorization),
  `AddExpense`, `ExpenseDetails`, `Balances`.
- **Add-expense flow**: payer, amount, description, participant
  checkboxes, split-type selector, and a per-type config section with
  **live validation feedback** so the split's validity is never a
  guessing game — an exact split shows "Assigned ₹X of ₹Y" as you
  type, a percentage split shows a running total against 100%, and
  the submit button is disabled until the split is valid. The spec's
  8-step wizard is collapsed into one scrollable form with a review
  section at the bottom, rather than a literal multi-screen wizard —
  simpler to build and use for a form this size; noted here in case
  that trade-off is worth revisiting.
- **Resolved the Phase 3 "minor units" assumption**: the UI now
  accepts amounts in rupees (decimal) and converts to paise
  (`utils/currency.ts`) right at the API boundary — the one place
  that conversion happens, so the rest of the app stays float-free
  end to end as designed.
- **Bug found and fixed**: while wiring the UI up to real API
  responses, `GET`/`POST /api/groups*` turned out to return raw
  snake_case DB columns (`created_by`, `created_at`) instead of the
  camelCase shape every other endpoint uses — the Phase 2 tests never
  checked those specific fields, so it slipped through. Added
  `PublicGroup`/`toPublicGroup` (matching the pattern already used for
  users and expenses) and a regression test asserting the camelCase
  shape explicitly.
- 2 frontend tests updated for the new auth-gated routing (redirect to
  `/login` when logged out, `Dashboard` renders when logged in). 1
  server regression test added. 97 total tests across both packages,
  all passing.

## What's built (Phase 7)

- **Settlements are now real**: a `settlements` table records actual
  payments (separate from expenses, per the spec — recording one
  never touches expense data). `POST /api/groups/:groupId/settlements`
  ("mark as paid"), `GET .../settlements` (history),
  `DELETE .../settlements/:id` ("mark as unpaid" — undoes a record).
  Partial settlements work naturally: record less than the suggested
  amount and the residual balance is exactly `owed - paid`.
- **The balance engine now uses real settlement data** instead of the
  empty placeholder from Phase 4 — `BalanceService` pulls recorded
  settlements from the DB and passes them straight into
  `calculateBalances()`, which already supported this input from day
  one.
- **Authorization decision**: either the person who recorded a
  settlement or the group owner can undo it — not just anyone in the
  group. Not explicitly specified, so documenting the choice here.
- **UI**: the Balances page is now the full settlement experience —
  current balances, an "Optimize settlement" button that computes the
  plan on demand, a "Mark as paid" action per suggested transaction
  (with an editable, pre-filled amount for partial settlements), and
  a settlement history list with "Mark as unpaid" shown only to
  whoever's actually allowed to use it (matches the backend rule
  above, checked client-side for UX — the backend still enforces it
  either way).
- 12 new backend tests (106 total): recording a full settlement zeroes
  the balance, a partial settlement leaves the correct residual,
  `fromUserId === toUserId` rejected, a non-member `fromUserId`/
  `toUserId` rejected, non-positive amount rejected, non-member
  recording rejected (404), history listing, the recorder undoing
  their own record, the owner undoing someone else's record, a
  non-recorder non-owner blocked (403), and cross-group settlement id
  correctly 404s.
- Verified live end-to-end (not just tests): booted the real server,
  ran expense → balances → record settlement → balances update →
  history shows it → undo → balances restored, all through curl in
  the actual request sequence the UI uses.

## A note on project scope

This project was originally planned as a 22-phase build (see the full
phase list this README's structure follows). After Phase 5, we
deliberately stopped following that plan phase-by-phase: for a
portfolio project, a finished, well-tested 6-phase app demonstrates
more than a partially-built 22-phase one, and the time saved is
better spent on a second/third project and on shipping this one
(deployment, a polished README with the algorithm explained clearly,
maybe a live demo link) rather than adding more feature surface.
Settlement history/"mark as paid" (Phase 7), analytics (Phase 10),
and the exact-solver optimizer (Phase 13) are the most natural next
additions if this project gets picked back up, but they are not
planned as an immediate next phase the way Phases 1–6 were.

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

- No expense update/delete, either in the API or the UI
- No CSRF protection, no rate limiting, no email verification/password
  reset
- The optimizer is greedy only — no exact/minimal-transaction-count
  solver
- No analytics, no CSV/PDF export, no receipt attachments
- No deployment yet — see the scope note above for what's next
- `npm audit` flags some vulnerabilities in transitive dev
  dependencies — not yet triaged
