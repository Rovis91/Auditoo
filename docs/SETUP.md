# Local Setup Guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | Use `node -v` to check |
| npm | 9+ | Comes with Node |
| Docker Desktop | Latest | Must be running before `npx supabase start` |
| Supabase CLI | Latest | Prefer **`npx supabase`** (works everywhere). **On Windows, use `npx supabase` for all CLI commands** — do not rely on a global install. Optional: `npm install -g supabase` or [official install](https://supabase.com/docs/guides/cli) on macOS/Linux |
| Git | Any | For cloning |

---

## 1. Clone and install dependencies

```bash
git clone <repo-url>
cd auditoo
npm install
```

This installs dependencies for all workspaces (`apps/web`, `apps/api`) via npm workspaces.

---

## 2. Environment variables

There are **two** env files to maintain locally (no third file at the repo root):

| File | Who reads it | Purpose |
|------|----------------|---------|
| `apps/api/.env` | Hono (`npm run dev` / `start` in `apps/api`) **and** `npm run db:seed` at the root | Supabase URL + service role, OpenAI, `PORT`, optional `CORS_ORIGINS` |
| `apps/web/.env` | Vite only | `VITE_API_URL` (and any other `VITE_*` public config) |

Keeping secrets in `apps/api/.env` and browser-safe vars in `apps/web/.env` matches how each tool loads env and avoids duplicating Supabase keys in a root `.env`.

### `apps/api/.env`

The API and the root seed script load this file (see `apps/api/package.json` and root `package.json` → `db:seed`). **Template:** `apps/api/.env.example` → copy to `apps/api/.env`.

```env
# Supabase local instance (default ports from `npx supabase start`)
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>   # printed by `npx supabase start`

# Browser origins allowed by CORS (comma-separated). Local dev defaults work if unset.
# CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# OpenAI
OPENAI_API_KEY=sk-...

# API port
PORT=3001
```

**JWT verification:** The Hono middleware validates `Authorization: Bearer <access_token>` using **JWKS** from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (see `apps/api/src/middleware/auth.ts`). It checks **issuer** (including both `http://localhost:54321` and `http://127.0.0.1:54321` forms when applicable) and **audience** `authenticated`. You do **not** need `SUPABASE_JWT_SECRET` in `apps/api/.env` for that flow; the JWT secret printed by the CLI is used by Supabase Auth internally, not by this API code path.

### `apps/web/.env`

**Template:** `apps/web/.env.example` → copy to `apps/web/.env`.

```env
VITE_API_URL=http://localhost:3001
```

> **Note:** Never put the Supabase service-role key or OpenAI key in the frontend env. They must stay server-side only.

---

## 3. Start Supabase locally

```bash
npx supabase start
```

Docker must be running. First run pulls ~1 GB of images — subsequent starts are fast.

When ready, the CLI prints:
```
API URL:     http://localhost:54321
DB URL:      postgresql://postgres:postgres@localhost:54322/postgres
Studio URL:  http://localhost:54323
anon key:    <anon_key>
service_role key: <service_role_key>
JWT secret:  <jwt_secret>
```

Copy `service_role_key` into `apps/api/.env` (required for API and for `npm run db:seed`).

---

## 4. Apply database migrations

```bash
npx supabase db reset
```

This runs every SQL file in `supabase/migrations/` in filename order. **Use separate migration files** for each logical change (initial schema, RLS policies, later alterations) instead of one large script — easier to review and safer to evolve.

`db reset` only applies SQL migrations. **Application seed data** (Auth user + rows inserted with the JS client) is handled in step 5, not by `seed.sql`, unless you deliberately add a tiny SQL-only seed for extensions or static config.

---

## 5. Seed auth user and test data

Supabase Auth users cannot be created from ordinary SQL migrations. Table rows are seeded with the **Supabase JS client** (service role) so you can use `await supabase.from('<table>').insert(data)` per table.

After `npx supabase db reset`, run:

```bash
npm run db:seed
```

This runs `supabase/seed.js`, which:

1. Runs **`supabase/seed/auth.js` first** — Admin API creates the Auth user (required before `agents` / any row that references `auth.users`).
2. Then runs the other modules under `supabase/seed/` (for example `companies.js`, `agents.js`) — **one file per table**, in dependency order, each using `insert` as needed.

Together these create:
- One company: `Diagnostics Dupont`
- One auth user: `agent@exemple.com` / `motdepasse`
- One `agents` row linked to that auth user

> **Credentials for login:**
> - Email: `agent@exemple.com`
> - Password: `motdepasse`

---

## 6. Generate TypeScript types from the schema

```bash
npm run db:types
```

This runs `npx supabase gen types typescript` (or the equivalent script) and writes the output to `database.types.ts` at the repo root. Re-run this whenever the schema changes.

---

## 7. Run everything

```bash
npm run dev
```

This single command (via `concurrently`) starts:
- **Supabase** — already running from step 3 (no-op if already up)
- **API** — Hono server on `http://localhost:3001`
- **Web** — Vite dev server on `http://localhost:5173`

Open `http://localhost:5173` in a browser and log in with the seeded credentials.

---

## 8. Cypress E2E tests

**Prerequisites:** Steps 1–7 above are done: Supabase is running, migrations applied, seed ran, `apps/api/.env` and `apps/web/.env` exist, and the stack is up so the SPA can call the API.

Start the app (Supabase + API + Vite):

```bash
npm run dev
```

In a **second** terminal, from the repo root:

```bash
npm test
```

This runs Cypress in headless mode against `http://localhost:5173` and executes the critical-path spec (`cypress/e2e/critical-path.cy.ts`: login with seeded credentials → create inspection → add level → add space → rename space → delete level).

- **Ports:** `5173` (Vite), `3001` (Hono; must match `VITE_API_URL`), `54321` (Supabase Auth/API used when logging in).
- **OpenAI** is **not** required for E2E (the voice flow is not covered).

To open the Cypress interactive runner:

```bash
npm run test:e2e
```

Run a single spec:

```bash
npx cypress run --spec "cypress/e2e/critical-path.cy.ts"
```

---

## 9. Supabase Studio (optional)

Browse the database visually:

```
http://localhost:54323
```

No login required in local mode.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npx supabase start` fails | Check Docker Desktop is running |
| Port 54321 already in use | `npx supabase stop` then `npx supabase start` |
| `db:seed` fails with "user already exists" | `npx supabase db reset` to wipe, then re-seed |
| Types out of sync | Run `npm run db:types` after any migration change |
| API 401 errors | Confirm `SUPABASE_URL` in `apps/api/.env` matches the host you use to sign in (e.g. `localhost` vs `127.0.0.1`). Token must be a valid Supabase access JWT; check expiry, and that `Authorization: Bearer` is sent. See JWKS flow in `apps/api/src/middleware/auth.ts`. |
| Voice not working | Check `OPENAI_API_KEY` in `apps/api/.env` is valid |
| Cypress `ECONNREFUSED` / blank tests | Ensure `npm run dev` is running (Vite + API) and `VITE_API_URL` points at the API |
| `npm run db:seed` fails with missing env | Ensure `apps/api/.env` exists with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (see §2) |
