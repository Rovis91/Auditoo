# Design Document — Auditoo Inspection Manager

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  apps/web  (React 19 SPA, Vite, TanStack Router)    │
│  - shadcn/ui + Tailwind v4 (tokens/vars only)       │
│  - Framer Motion only when motion needs it          │
│  - TanStack Router (client-side routing)            │
│  - dnd-kit (drag-and-drop)                          │
│  - Serwist (PWA / service worker)                   │
│  - IndexedDB mutation queue (idb)                   │
└────────────────────────┬────────────────────────────┘
                         │ HTTP + Bearer JWT
┌────────────────────────▼────────────────────────────┐
│  apps/api  (Hono, TypeScript, Node)                 │
│  - JWT validation middleware (Supabase Auth JWKS)     │
│  - REST resource endpoints                          │
│  - OpenAI Whisper + GPT voice pipeline              │
│  - Supabase service-role client for DB access       │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  Supabase (local Docker)                            │
│  - PostgreSQL + Row Level Security                  │
│  - Supabase Auth (JWT issuer)                       │
│  - Studio at localhost:54323                        │
└─────────────────────────────────────────────────────┘
```

The frontend never talks directly to Supabase. All requests go through the Hono API, which validates the JWT issued by Supabase Auth and uses the Supabase service-role client for database operations. This separation keeps business logic server-side and avoids leaking the service-role key to the client.

---

## Key Decisions

### 1. Hono as the API framework

Hono was chosen for its minimal footprint, TypeScript-first design, and fast cold start. It has no unnecessary abstractions for a one-day build and maps cleanly to resource-based REST. Express would have worked too, but Hono's built-in request/response typing reduces boilerplate.

### 2. Resource-based REST over a single sync endpoint

A resource-based API (`POST /levels`, `PATCH /spaces/:id`, etc.) was preferred over a single `POST /sync` batch endpoint. Reasons:
- Easier to reason about and debug
- Each endpoint can be tested independently
- More credible as a production-like pattern
- Scales better if the API grows

The offline queue replays individual mutations against these standard endpoints rather than requiring a dedicated sync protocol.

### 3. Offline strategy: IndexedDB queue + push on reconnect

When the app detects no connectivity (via `navigator.onLine` + a periodic health check), mutations are written to an IndexedDB queue instead of being sent immediately. When connectivity resumes, the queue is drained in order, each mutation sent to its corresponding REST endpoint.

This approach was chosen over libraries like PowerSync or ElectricSQL because:
- No additional infrastructure required
- Transparent and auditable — the queue is inspectable
- Sufficient for single-user sessions (one inspector per device)
- Well-understood trade-offs

**Trade-off:** If two agents edit the same inspection concurrently while both are offline, the last one to reconnect wins. This is documented and acceptable for the MVP.

### 4. Last-write-wins conflict resolution

No conflict detection or merge logic is implemented. The last `PATCH` request to reach the server overwrites whatever was there. Chosen because:
- In real usage, inspections are typically owned and edited by one agent at a time
- Conflict resolution UI would add significant complexity for marginal benefit at MVP stage
- The trade-off is explicitly documented here rather than silently ignored

**Production improvement:** Track a `version` or `updated_at` field per record and return a 409 conflict when the client's version is stale, prompting a merge UI.

### 5. Fractional indexing (client-computed, server-trusted)

The `fractional-indexing` library runs on the client to compute new index values when a user drags and drops a row. The server stores whatever value the client sends without recomputing.

**Trade-off:** A misbehaving or buggy client could send an invalid index. In production, the server should validate that indexes are well-formed strings and fall within expected bounds. For this MVP, the trust-the-client model is sufficient.

### 6. AI voice pipeline

```
User taps mic → browser MediaRecorder → audio blob
→ POST /voice (multipart: audio, inspectionId, spaceId?)
→ Hono: Whisper API (transcription, French)
→ Hono: GPT with inspection context + transcript
→ GPT returns structured JSON diff (fields to update)
→ Hono applies diff to DB via Supabase
→ Response: { changes: [...] }
→ Frontend updates local state + cache
```

The GPT prompt includes the full inspection context (existing levels, spaces, field values) so the model can understand what already exists and apply changes correctly (e.g. "add a bedroom on the first floor" → create a space under the matching level).

**Offline behavior:** When offline, the voice request is added to the IndexedDB queue like any other mutation. The UI shows a "queued" badge instead of "processing". The audio blob is stored in IndexedDB until the queue is flushed.

**Trade-off:** Storing audio blobs in IndexedDB is not ideal for large files. A production system would upload audio to object storage (e.g. Supabase Storage) first, then process asynchronously.

### 7. Authentication: seeded credentials, no registration UI

The MVP skips company and agent registration entirely. `supabase/seed.js` runs modules under `supabase/seed/`: **`auth.js` first** (Supabase Admin API for the real Auth user), then one file per table with `insert` via the service-role client (e.g. company, then agent). This was chosen because:
- Registration flows involve email verification, error handling, and onboarding — high complexity for low MVP value
- The recruiter can evaluate auth integration (JWT, RLS, middleware) without a registration form
- A clearly documented seed approach is honest about the simplification

**Production improvement:** Add a company sign-up flow with email verification, and an agent invitation system (email link → set password).

### 8. Supabase RLS: company-scoped isolation

Every table that contains company data (`inspections`, `levels`, `spaces`) has an RLS policy that restricts reads and writes to the agent's company. The policy joins through `agents` to resolve `auth.uid()` → `company_id`.

All writes go through the Hono API using the **service-role key**, which bypasses RLS. RLS is therefore enforced as a safety net for any direct Supabase client access, but the primary enforcement is the API's JWT middleware (which extracts `company_id` from the validated token and scopes all queries accordingly).

### 9. Supabase-generated TypeScript types

`npx supabase gen types typescript` produces `database.types.ts` at the monorepo root. Both `apps/web` and `apps/api` import from this file. This gives end-to-end type safety without a shared package, which would add tooling overhead for a one-day build.

**Note:** The file must be regenerated whenever the schema changes (`npm run db:types` or equivalent script).

### 10. PWA via Serwist

Serwist (a maintained fork of Workbox) provides the service worker layer. The service worker:
- Caches the app shell for offline loading
- Does not cache API responses (data freshness is handled by the mutation queue, not the SW)
- Enables the "Add to Home Screen" prompt on mobile

**Web app manifest and iOS:** `apps/web/public/manifest.webmanifest` lists `name`, `short_name`, `description`, `lang`, `icons` (SVG + PNG 192/512), and `theme_color` / `background_color`. `index.html` links `apple-touch-icon.png` (180×180) and Apple web app meta tags so “Add to Home Screen” on iOS shows a proper icon and title.

### 11. End-to-end test (Cypress)

A single critical-path spec (`cypress/e2e/critical-path.cy.ts`) covers: login with seeded credentials → create inspection → add level → add space → rename space → delete level. Stable selectors use `data-testid` on auth, list, form, and levels/spaces screens. Run `npm test` with the dev stack up (see `docs/SETUP.md`). Voice and OpenAI are out of scope for this test.

### 12. Mobile polish (Phase 7)

Levels/spaces and space detail use shadcn `Button` sizes (including a larger icon touch size) for ~44×44 px tap targets where practical. The offline/sync strip is `role="status"` with clear foreground/muted styling. Space detail uses a scrollable main column and `scrollIntoView` on focus to reduce fields hidden behind the mobile keyboard.

---

## Data Model Rationale

### `companies` and `agents` tables

Rather than treating Supabase Auth users as the only identity primitive, a `companies` table and an `agents` table sit alongside the auth schema. This reflects real organizational structure (multiple inspectors at the same firm) and is a common pattern in multi-tenant Supabase apps.

`agents.id` is a foreign key to `auth.users.id`, linking the business identity to the auth identity.

### `inspections` fields

DPE-relevant fields (heating type, hot water, ventilation, insulation context) were added at the inspection level rather than only at the space level because some characteristics describe the whole building (e.g. main heating system type, ventilation strategy). Space-level fields handle room-specific detail.

### `levels` and `spaces` fields

Kept minimal but realistic. A `fractional_index` text column stores the ordering key. A `label` on levels (free text) handles the inspector's own naming convention (RDC, Cave, Comble, etc.) without imposing an enum that would need localization.

---

## Limitations and Known Trade-offs

| Limitation | Reason | Production fix |
|---|---|---|
| Last-write-wins sync | Simplicity | Optimistic locking with version field + conflict UI |
| No registration UI | Complexity vs. MVP value | Full onboarding flow with email verification |
| No agent management | Out of scope | Admin screen: invite, deactivate agents |
| No real-time sync | Not required | Supabase Realtime subscriptions |
| Audio stored in IndexedDB | Simple offline queue | Upload to Supabase Storage, async processing |
| No soft deletes | Simplicity | `deleted_at` column + cascading rules |
| No DPE score calculation | Out of scope | Integrate DPE calculation engine downstream |
| Local-only deployment | One-day build | Supabase cloud project + Render/Railway deploy |
| No role-based access | Flat agent hierarchy | Admin/agent roles with permission checks |
| Single E2E test | Time constraint | Full test suite: unit + integration + E2E |
