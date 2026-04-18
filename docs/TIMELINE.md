# Development Timeline — April 18, 2026

One-day build with AI assistance. Each phase lists concrete tasks and its dependencies.

---

## Phase 0 — Scaffold (30 min)
**Dependencies:** none

- [ ] Create monorepo root with `package.json` (npm workspaces: `apps/web`, `apps/api`)
- [ ] Init `apps/web` with Vite + React 19 + TypeScript template
- [ ] Init `apps/api` as a plain TypeScript Node project
- [ ] Configure root-level `tsconfig.json` references
- [ ] Add ESLint (flat config) with TypeScript rules — shared from root
- [ ] Init Supabase project: `npx supabase init` (use `npx supabase` on all platforms; required on Windows)
- [ ] Add `concurrently` to root devDependencies for `npm run dev`
- [ ] Move `fullstack.md` to `docs/` (do not edit it)
- [ ] Add a `.gitignore` file to keep `base/`, `chat/` and `docs/` folders in repo
- [ ] Commit: `chore: scaffold monorepo`

---

## Phase 1 — Database & Auth (60 min)
**Dependencies:** Phase 0

- [ ] Write migration `0001_init.sql` (schema only — keep migrations split by concern):
  - `companies` (id, name, created_at)
  - `agents` (id, company_id, email, name — FK to auth.users)
  - `inspections` (id, company_id, agent_id, owner_name, address, date, status, construction_year, living_area, heating_type, hot_water_system, ventilation_type, insulation_context)
  - `levels` (id, inspection_id, label, fractional_index)
  - `spaces` (id, level_id, name, area, window_count, glazing_type, heating_presence, heating_type, ventilation_presence, ventilation_type, insulation_rating, fractional_index)
- [ ] Write migration `0002_rls.sql` (separate file from init — policies only):
  - Enable RLS on `inspections`, `levels`, `spaces`
  - Policy: agent can read/write rows where `company_id` matches their own (resolved via `agents` join on `auth.uid()`)
- [ ] Add further migrations as **new numbered files** when the schema changes (do not keep stuffing unrelated changes into `0001` after it has been used)
- [ ] `npx supabase start` → verify Studio loads
- [ ] `npx supabase db reset` → apply migrations
- [ ] Add `supabase/seed.js` plus `supabase/seed/`: **`auth.js` first** (Admin API user), then one module per table using `await supabase.from('…').insert(…)` (e.g. `companies.js`, `agents.js`) in FK order
- [ ] `npm run db:seed` → verify seeded user can log in via Studio Auth tab
- [ ] `npm run db:types` → generate `database.types.ts` at repo root
- [ ] Commit: `feat: database schema, RLS, and seed scripts`

---

## Phase 2 — Hono API (75 min)
**Dependencies:** Phase 1

- [ ] Add Hono, `@supabase/supabase-js`, `dotenv` to `apps/api`
- [ ] Create server entry `apps/api/src/index.ts` (Hono app, port from env)
- [ ] JWT middleware: validate `Authorization: Bearer <token>` using `SUPABASE_JWT_SECRET`, attach `{ userId, companyId }` to context
- [ ] Resource routers (each in its own file):
  - `GET /inspections` — list by company
  - `POST /inspections` — create
  - `GET /inspections/:id` — single (with levels + spaces)
  - `PATCH /inspections/:id` — update fields
  - `DELETE /inspections/:id`
  - `POST /levels` — create (requires inspectionId)
  - `PATCH /levels/:id` — rename or reorder
  - `DELETE /levels/:id`
  - `POST /spaces` — create (requires levelId)
  - `PATCH /spaces/:id` — update fields or reorder or move level
  - `DELETE /spaces/:id`
  - `POST /voice` — accept audio blob + context, call Whisper + GPT, apply changes, return diff
- [ ] Wire all routers into the main app with JWT middleware applied globally
- [ ] Manual smoke test with curl or Bruno/Postman
- [ ] Commit: `feat: Hono REST API with JWT middleware`

---

## Phase 3 — Frontend Foundation (60 min)
**Dependencies:** Phase 0 (Phase 2 running helps but not strictly required)

- [ ] Install and configure Tailwind CSS v4 in `apps/web`
- [ ] Install and init shadcn/ui; apply Auditoo token palette from `base/scraped.css` to `globals.css`
- [ ] Install lucide-react
- [ ] Install and configure TanStack Router; define route tree:
  - `/login`
  - `/inspections` (list)
  - `/inspections/new`
  - `/inspections/:id/edit`
  - `/inspections/:id` (levels & spaces)
  - `/inspections/:id/spaces/:spaceId`
- [ ] Auth context: store JWT in memory + localStorage; expose `useAuth()` hook
- [ ] Protected route wrapper: redirect to `/login` if no token
- [ ] Serwist: add service worker config (cache app shell, skip API caching)
- [ ] API client utility (`apps/web/src/lib/api.ts`): thin wrapper over `fetch` that injects Bearer token and base URL
- [ ] Commit: `feat: frontend scaffold, routing, auth context, PWA`

---

## Phase 4 — Core Screens (150 min)
**Dependencies:** Phases 2 and 3

### Login (15 min)
- [ ] Email + password form using shadcn `Input` + `Button`
- [ ] Call Supabase Auth sign-in endpoint via API proxy
- [ ] Store JWT, redirect to inspection list

### Inspection List (20 min)
- [ ] Fetch `GET /inspections` on mount
- [ ] Card per inspection: owner name, address, date, status badge
- [ ] "New Inspection" button → `/inspections/new`
- [ ] Tap card → `/inspections/:id`

### New / Edit Inspection Form (25 min)
- [ ] Form with all fields from PRD (text, number, date, selects)
- [ ] `POST /inspections` on create, `PATCH /inspections/:id` on edit
- [ ] Status toggle (draft / completed)
- [ ] Back navigation

### Levels & Spaces Screen (60 min) ← most complex
- [ ] Fetch `GET /inspections/:id` (with levels + spaces nested)
- [ ] Render hierarchical list: level header rows + space rows beneath
- [ ] dnd-kit: `DndContext` + `SortableContext` per level for space drag; outer `SortableContext` for level drag
- [ ] Cross-level drag: detect when a space is dropped onto a different level header → `PATCH /spaces/:id { levelId }`
- [ ] Inline add level: press "Add level" → inline text input → confirm → `POST /levels`
- [ ] Inline add space: press "+" under a level → inline text input → confirm → `POST /spaces`
- [ ] Inline rename: tap name → editable input → blur → `PATCH`
- [ ] Swipe-to-delete: custom touch handler or `@use-gesture/react` → slide left → delete button → `DELETE`
- [ ] Offline indicator bar (top): Offline / Syncing / Synced
- [ ] Voice bar (bottom): mic button (see Phase 6)

### Space Detail Screen (30 min)
- [ ] Single scrollable form
- [ ] Conditional field reveal: `heatingPresence` toggle shows `heatingType`; same for ventilation
- [ ] Auto-save on blur (debounced `PATCH /spaces/:id`)
- [ ] Back button to levels/spaces screen
- [ ] Voice bar at bottom (see Phase 6)

- [ ] Commit: `feat: all core screens`

---

## Phase 5 — Offline Sync (75 min)
**Dependencies:** Phase 4

- [ ] Install `idb` (IndexedDB wrapper)
- [ ] Design queue schema: `{ id, endpoint, method, body, timestamp }`
- [ ] `MutationQueue` class:
  - `enqueue(mutation)` — write to IndexedDB
  - `flush()` — drain queue in order, POST each mutation to API, remove on success
  - `getStatus()` — returns queue length
- [ ] Intercept all API calls in `apps/web/src/lib/api.ts`: if `!navigator.onLine`, write to queue instead of fetching
- [ ] Sync manager: listen to `window.online` event → call `MutationQueue.flush()`
- [ ] Periodic health check (every 30 s) as fallback for `navigator.onLine` false positives
- [ ] Offline indicator component: reads queue status + online state → renders "Offline", "Syncing (N)", or "Synced" badge
- [ ] Register in Serwist: service worker intercepts navigation requests; API calls pass through (network-first for API, cache-first for app shell)
- [ ] Test offline flow manually: DevTools → Network → Offline → make changes → back Online → verify sync
- [ ] Commit: `feat: IndexedDB mutation queue and offline sync`

---

## Phase 6 — Voice AI (60 min)
**Dependencies:** Phases 2 and 4

- [ ] `VoiceBar` component: mic button, waveform or timer display, stop button
- [ ] Use `MediaRecorder` API: record until user stops → `audio/webm` blob
- [ ] If offline: serialize blob to base64 → enqueue as `POST /voice` mutation in IndexedDB with blob payload
- [ ] If online: `POST /voice` multipart form with audio blob + `inspectionId` + optional `spaceId`
- [ ] API `POST /voice` handler:
  - Send blob to OpenAI Whisper (`whisper-1`, language `fr`)
  - Build GPT prompt: include transcript + current inspection/space context from DB
  - Parse GPT JSON response → validate field names against schema
  - Apply changes via Supabase service-role client
  - Return `{ changes: [...] }` to frontend
- [ ] Frontend on response: merge returned changes into local state
- [ ] UI states: idle → recording → (queued if offline | processing if online) → done / error
- [ ] Place `VoiceBar` on levels/spaces screen and space detail page
- [ ] Commit: `feat: voice AI pipeline with Whisper and GPT`

---

## Phase 7 — Polish, Testing & Docs (60 min)
**Dependencies:** All previous phases

- [ ] Mobile review: open on real device or Chrome DevTools mobile emulator
  - Check tap target sizes (min 44×44 px)
  - Verify drag handles are thumb-reachable
  - Test swipe-to-delete on touch
  - Check form keyboard behavior (no input hidden behind keyboard)
- [ ] Apply consistent spacing, typography, and color using shadcn tokens from `scraped.css`
- [ ] Add `apple-touch-icon` and PWA manifest fields for iOS installability
- [ ] Cypress: write one E2E test covering the critical path:
  - Log in → create inspection → add a level → add a space → rename space → delete level
- [ ] `npm run db:types` — regenerate and commit final types
- [ ] Verify `npm run dev` starts cleanly from scratch (fresh clone)
- [ ] Final `DESIGN.md` pass: confirm all trade-offs are documented
- [ ] Commit: `feat: mobile polish, Cypress E2E, final docs`

---

## Dependency Graph

```
Phase 0 (scaffold)
  └─► Phase 1 (DB + auth)
        └─► Phase 2 (API)
              └─► Phase 4 (screens) ◄── Phase 3 (frontend foundation)
                    ├─► Phase 5 (offline sync)
                    └─► Phase 6 (voice AI)
                          └─► Phase 7 (polish + testing)
```

Phases 2 and 3 can proceed in parallel after Phase 1 completes.

---

## Time Budget Summary

| Phase | Budget |
|---|---|
| 0 — Scaffold | 30 min |
| 1 — DB & Auth | 60 min |
| 2 — API | 75 min |
| 3 — Frontend foundation | 60 min |
| 4 — Core screens | 150 min |
| 5 — Offline sync | 75 min |
| 6 — Voice AI | 60 min |
| 7 — Polish & testing | 60 min |
| **Total** | **~9 hours** |
