# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Auditoo Inspection Manager — a mobile-first, offline-first PWA for DPE field inspectors. Inspectors manage building levels and spaces, record energy-relevant measurements, and dictate observations via voice (Whisper + GPT → structured DB updates).

Full product spec: `docs/PRD.md`. Architecture decisions and trade-offs: `docs/DESIGN.md`.

## Commands

```bash
npm run dev          # Start everything: Supabase (Docker) + Hono API + Vite frontend
npm run db:reset     # Wipe DB and re-apply all Supabase migrations
npm run db:seed      # Run supabase/seed.js (Auth + table rows via JS; run after db:reset)
npm run db:types     # Regenerate database.types.ts from local Supabase schema
npm run lint         # ESLint across all workspaces
npm test             # Run Cypress E2E tests
```

**Supabase CLI (Windows):** Always invoke the CLI with `npx supabase` (for example `npx supabase start`, `npx supabase db reset`). A global `supabase` binary is unreliable or absent on many Windows setups.

Running a single Cypress test:
```bash
npx cypress run --spec "cypress/e2e/<test>.cy.ts"
```

## Monorepo Structure

```
/
├── apps/
│   ├── web/          # React 19 SPA (Vite, TanStack Router, Tailwind v4, shadcn/ui)
│   └── api/          # Hono TypeScript REST API (Node)
├── supabase/
│   ├── migrations/   # SQL only — one file per logical change (schema, RLS, indexes); applied in order by `npx supabase db reset`
│   ├── seed.js       # Entry: loads service-role client, runs seed modules in order (see npm run db:seed)
│   └── seed/
│       ├── auth.js   # Runs first: Auth user via Admin API — before `companies` and `agents` seed modules
│       ├── companies.js   # await supabase.from('companies').insert(...)
│       ├── agents.js      # await supabase.from('agents').insert(...)
│       └── ...            # One file per table, FK-safe order after auth.js
├── database.types.ts # Auto-generated Supabase types — DO NOT edit manually
├── cypress/          # E2E tests
└── docs/             # PRD, DESIGN, SETUP, TIMELINE, fullstack.md
```

Keep migrations small and focused: add new files for new tables or policy changes instead of editing old migrations after they have been applied anywhere.

## Architecture

The frontend (`apps/web`) never calls Supabase directly. All requests go through the Hono API (`apps/api`) which validates the Supabase-issued JWT and uses the service-role key for DB access.

```
React SPA → Bearer JWT → Hono API → Supabase service-role client → PostgreSQL
```

Auth flow: Supabase Auth issues the JWT → stored in `localStorage` → attached as `Authorization: Bearer` header to every API request → Hono middleware validates it using `SUPABASE_JWT_SECRET`.

## Frontend

When designing or building UI in `apps/web`, **always** use `.agents/skills/frontend-design/SKILL.md`: read it first and apply its guidance for layout, typography, components, and visual polish so the app stays consistent with the intended design system.

**Stack and styling (non-negotiable):**

- **shadcn/ui + Tailwind only** — Use shadcn primitives/patterns and Tailwind utilities for structure and styling. Do not add other CSS frameworks, styling libraries, or hand-rolled global CSS for component appearance.
- **Variables and theme tokens only** — No hardcoded literals in components (no arbitrary `#hex`, `rgb()`, one-off `px` for spacing/type, or magic numbers in `className` strings that bypass the scale). Use Tailwind classes tied to the theme, shadcn semantic tokens (`bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, etc.), and CSS variables such as `hsl(var(--primary))`. When something new is needed, extend `tailwind` theme / CSS variables in config, then consume the token — do not sprinkle raw values in JSX or CSS modules.
- **Animation** — Prefer Tailwind transitions and plain CSS. Use **Framer Motion** (`framer-motion`) **only when necessary** (e.g. non-trivial layout or gesture-driven motion that is impractical in CSS). Do not add Framer for simple hovers or fades.

## Key Patterns

**Offline sync:** All mutations in `apps/web` go through `src/lib/api.ts`. When `navigator.onLine` is false, mutations are written to an IndexedDB queue (via `idb`) instead of being fetched. On reconnect, the queue drains in order against the same REST endpoints. Voice blobs are serialized to base64 and queued the same way.

**Fractional indexing:** Client computes new index values using `fractional-indexing` on drag-and-drop. The server stores whatever value the client sends — no server-side recomputation.

**Voice pipeline:** `POST /voice` (multipart: audio blob + inspectionId + optional spaceId) → Whisper transcription → GPT with full inspection context → JSON diff of field changes → applied via Supabase → returned to frontend to merge into local state.

**Conditional fields:** On the space detail form, `heatingType` is only shown when `heatingPresence` is true; same pattern for ventilation fields. Controlled locally in React state, persisted on blur via debounced `PATCH /spaces/:id`.

**RLS:** Enabled on `inspections`, `levels`, `spaces`. Policies scope reads/writes to `company_id` resolved through `agents → auth.uid()`. The API bypasses RLS via service-role key but enforces company scoping manually in query filters.

## Environment Variables

`apps/api/.env` — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `OPENAI_API_KEY`, `PORT`

`apps/web/.env` — `VITE_API_URL`

## Supabase Local Ports

| Service | URL |
|---|---|
| API | http://localhost:54321 |
| Studio | http://localhost:54323 |
| DB (Postgres) | localhost:54322 |
| Hono API | http://localhost:3001 |
| Vite dev server | http://localhost:5173 |

## Seeded Test Credentials

- Email: `agent@exemple.com`
- Password: `motdepasse`

## Intentional Simplifications (do not "fix" without discussion)

- **Last-write-wins** conflict resolution — no version field, no conflict UI
- **No registration UI** — auth user is seeded, not created through the app
- **Client-trusted fractional indexes** — server does not validate index values
- **Hard deletes only** — no `deleted_at` soft-delete pattern
- **Local Supabase only** — no cloud project, no production deployment
