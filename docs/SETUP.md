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

### `apps/api/.env`
```env
# Supabase local instance (default ports from `npx supabase start`)
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>   # printed by `npx supabase start`
SUPABASE_JWT_SECRET=<jwt_secret>               # printed by `npx supabase start`

# OpenAI
OPENAI_API_KEY=sk-...

# API port
PORT=3001
```

### `apps/web/.env`
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

Copy `service_role_key` and `jwt_secret` into `apps/api/.env`.

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
- One auth user: `inspector@auditoo.eco` / `password123`
- One `agents` row linked to that auth user

> **Credentials for login:**
> - Email: `inspector@auditoo.eco`
> - Password: `password123`

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

## 8. Supabase Studio (optional)

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
| API 401 errors | Check `SUPABASE_JWT_SECRET` in `apps/api/.env` matches CLI output |
| Voice not working | Check `OPENAI_API_KEY` in `apps/api/.env` is valid |
