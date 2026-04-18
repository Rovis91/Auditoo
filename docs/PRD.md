# Product Requirements Document — Auditoo Inspection Manager

## Product Overview

A mobile-first, offline-capable web app for DPE (Diagnostic de Performance Énergétique) field inspectors. Inspectors use the app on-site to structure a building's layout (levels and spaces), record energy-relevant measurements and characteristics, and dictate observations via voice. All data must be preserved even without connectivity.

---

## Target Users

**Primary user: DPE inspector (agent)**
- Works on-site in buildings, often with poor or no internet
- Uses the app on a smartphone (Chrome on Android or iOS)
- Needs to move fast: the UI must require minimal taps and support one-handed operation
- Belongs to a diagnostics company; multiple agents can share the same company account

**Typical field workflow:**
1. Arrive at property, open or create an inspection
2. Walk through each floor, add levels (RDC, 1er étage, etc.) and spaces (Salon, WC, etc.)
3. For each space, record area, window count, glazing type, heating and ventilation presence, insulation rating
4. Dictate observations verbally — the AI transcribes and maps them to structured fields
5. Mark inspection as completed when done

---

## Core Features

### CRUD — Levels & Spaces
- Add, rename, and delete levels and spaces inline (no modal required)
- Swipe left on a row to reveal a delete action
- Each level has a label (e.g. RDC, 1er étage, Sous-sol, Comble)
- Each space has a name and typed fields (area, glazing, heating, ventilation, insulation)

### Reordering
- Drag to reorder spaces within a level
- Drag to reorder levels
- Drag a space into a different level
- Order stored as fractional indexes (client-computed, server-trusted)

### Offline-First Sync
- All mutations (create, update, delete, reorder) work without connectivity
- Mutations are queued in IndexedDB and replayed against the REST API when connection resumes
- Visible offline indicator and sync status badge in the UI
- Last-write-wins conflict resolution (intentional simplification — see DESIGN.md)

### Voice AI
- Microphone button at the bottom of the levels/spaces screen and space detail page
- Audio sent to the backend → OpenAI Whisper transcribes (French) → GPT extracts structured changes → applied to DB
- UI shows queued state (offline) or processing state (online)
- No free-text dump: the AI pipeline applies changes to real DB fields

### Mobile-First UI
- Designed for Chrome on Android/iOS, portrait mode
- Inline editing, touch-friendly tap targets, swipe gestures
- Shadcn/ui components styled with the Auditoo scraped CSS token palette
- PWA: installable, offline-capable via Serwist service worker

### Multi-Inspection / Multi-Company
- Agents belong to a company; inspections belong to a company
- Each agent sees all inspections within their company
- Multiple inspections can be active simultaneously
- Basic company isolation enforced via Supabase RLS

---

## Screen-by-Screen Breakdown

### 1. Login
**Purpose:** Authenticate an existing agent (no registration UI — DB is seeded).

**Key interactions:**
- Email + password form
- Submit → Supabase Auth → JWT stored → redirect to inspection list
- Error state for wrong credentials

**Notes:** No "forgot password", no sign-up link. MVP only.

---

### 2. Inspection List
**Purpose:** Show all inspections belonging to the agent's company.

**Key interactions:**
- List of inspection cards showing: owner name, address, date, status badge (draft/completed)
- Tap card → open levels/spaces screen for that inspection
- "New inspection" button → opens new inspection form
- Pull-to-refresh or auto-refresh on reconnect

**Fields displayed per card:** owner name, address, inspection date, status

---

### 3. New / Edit Inspection
**Purpose:** Create or edit the metadata and DPE context for an inspection.

**Key interactions:**
- Single-page form (no tabs)
- Save → returns to inspection list (new) or levels/spaces screen (edit)
- Status toggle: draft ↔ completed

**Fields:**
| Field | Type |
|---|---|
| Owner name | Text |
| Property address | Text |
| Inspection date | Date picker |
| Status | Select: draft / completed |
| Construction year | Number |
| Living area (m²) | Number |
| Heating type | Select (gas, electric, heat pump, wood, other) |
| Hot water system | Select (same options + solar) |
| Ventilation type | Select (natural, VMC simple flux, VMC double flux, other) |
| Insulation context | Textarea (brief notes) |

---

### 4. Levels & Spaces
**Purpose:** The main on-site screen. Inspectors build the building structure here.

**Key interactions:**
- Hierarchical list: levels as section headers, spaces as rows beneath each level
- **Add level:** inline text input at the bottom of the levels list
- **Add space:** inline text input below the last space in a level
- **Rename:** tap name to edit inline
- **Delete:** swipe left to reveal delete button
- **Reorder levels:** drag handle on level header
- **Reorder spaces:** drag handle on space row
- **Move space to another level:** drag space row onto a different level header
- **Voice button:** fixed bottom bar with mic icon → starts recording
- **Offline indicator:** top bar badge (Offline / Syncing / Synced)

**Notes:** This screen is the most critical for mobile usability. Tap targets must be large, drag handles must be thumb-reachable.

---

### 5. Space Detail
**Purpose:** Edit all structured fields for a single space.

**Key interactions:**
- Single scrollable form (no tabs)
- Conditional field reveal: checking "Heating present" reveals "Heating type" select
- Same for ventilation
- Save button / auto-save on blur
- Voice button at the bottom (same as levels/spaces screen)
- Back navigation to levels/spaces screen

**Fields:**
| Field | Type | Condition |
|---|---|---|
| Name | Text | always |
| Area (m²) | Number | always |
| Window count | Number | always |
| Glazing type | Select (single, double, triple) | always |
| Heating present | Toggle | always |
| Heating type | Select (radiator, floor, electric, other) | if heating present |
| Ventilation present | Toggle | always |
| Ventilation type | Select (natural, VMC, other) | if ventilation present |
| Insulation rating | Select (none, low, medium, high) | always |

---

## MVP Scope

**In scope:**
- Login (seeded credentials)
- Inspection list, create, edit
- Levels & spaces management (CRUD, drag, swipe)
- Space detail form with conditional fields
- Offline-first mutation queue + sync
- Voice AI pipeline (Whisper + GPT → structured DB updates)
- PWA (installable, offline)
- Supabase Auth + basic RLS
- Single Cypress E2E test

**Out of scope:**
- Company or agent registration / management UI
- Role-based access control
- Real-time sync across devices (Supabase Realtime)
- Image capture or recognition
- DPE score calculation or report export
- Conflict resolution UI
- Multi-language support (French only)
- Cloud deployment (local Supabase Docker only)
- Soft deletes
