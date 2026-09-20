# SettleUp

A group expense-sharing and debt-settlement app. The core technical
piece is the settlement optimizer, which turns a group's raw
expense obligations into a reduced set of final payments — not yet
built (that's Phase 4–5).

**Status: Phase 2 (Authentication and Groups) complete.** Expenses,
the balance engine, and the settlement optimizer are not implemented
yet.

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
- 23 backend tests total: the Phase 1 suite plus registration,
  duplicate-email rejection, invalid-input rejection, login
  (success/wrong password/unknown email), the protected `/me`
  endpoint (valid session / no cookie / forged cookie), logout
  invalidating the session, group creation + ownership, non-member
  access denial, member addition and visibility, non-owner rename/
  delete/add/remove rejection (403), group-list scoping, and the
  last-owner removal guard.

## What's built (Phase 1)

- Express app with centralized error handling (`AppError` hierarchy),
  a generic Zod-based request validator, and a health endpoint
  (`GET /api/health`)
- SQLite connection + an idempotent migration runner, with the
  `users`, `groups`, and `group_members` tables. Amounts will be
  stored as integer minor units (paise), not floats, once expenses
  land in Phase 3 — this is a schema-level decision made now to avoid
  a retrofit later
- React app shell: router, nav, a `Dashboard` page that calls the real
  health endpoint (proving the loading/error state pattern end-to-end
  rather than against a mock), a `Groups` placeholder, and a 404 page
- `useAsync` hook and `LoadingState`/`ErrorState` components so every
  future page handles loading/error consistently

## Known limitations / not yet done

- No expenses, balances, or settlement optimizer yet (Phases 3–7)
- Frontend has no login/register/groups UI yet — the actual UI for
  auth and groups is scheduled for Phase 6 in the build plan; the
  `Dashboard`/`Groups` pages from Phase 1 are unchanged placeholders
- No CSRF protection yet (noted for Phase 15, security pass) — session
  cookies use `sameSite: lax`, which mitigates but doesn't eliminate
  CSRF risk on state-changing requests
- No rate limiting on login/register (brute-force risk) — also
  scheduled for the security pass
- No email verification or password reset flow
- `npm audit` flags some vulnerabilities in transitive dev
  dependencies (mostly from `better-sqlite3`'s prebuild toolchain and
  jsdom's dependency tree) — not yet triaged; revisit before
  production deployment (Phase 15, security pass)

## Next phase

**Phase 3 — Expense Engine**: expense creation with equal/exact/
percentage/share splits, validation for each split type, and
extensive tests per split type and edge case.
