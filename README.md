# Auditoo

Mobile-first, offline-first PWA for DPE field inspections: levels, spaces, measurements, and voice-assisted updates (Whisper + structured extraction) via a small Hono API and Supabase (Postgres + Auth).

## Quick start

```bash
npm install
# Configure env: apps/api/.env + apps/web/.env (see docs/SETUP.md and each app’s .env.example)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Full prerequisites, Supabase, seeding, Cypress, and troubleshooting: **[docs/SETUP.md](docs/SETUP.md)**.

```bash
npm run lint    # ESLint: apps/api + apps/web
npm test        # Cypress (requires stack running — see SETUP)
```

## Take-home note

This submission **intentionally** includes AI assistant configuration (e.g. `CLAUDE.md`, `.agents/skills/`) and design reference material under `base/` so reviewers can see how the assistant and design inputs were used. That layout would **not** mirror a production repository.

## Monorepo

| Workspace   | Role |
|------------|------|
| `apps/web` | Vite + React 19 + TanStack Router |
| `apps/api` | Hono REST API (JWT via Supabase JWKS, service-role DB) |
