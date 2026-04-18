# Hiring Task — Founding Engineer, Fullstack (Frontend-First)

**Description:** Build a synchronized, offline-first levels and spaces management UI for a housing inspection app.

**Contact:** gauthier@auditoo.eco

Read the [Auditoo Context](../../README.md) before starting.

## Context

The first thing an inspector does on-site is describe the building structure: enumerate the levels (floors) and spaces (rooms) that make up the property. This screen is used dozens of times a day, often in buildings with no connectivity. Data must never be lost, and the UI must be fast to operate on a phone.

Your task is to build this feature end-to-end — frontend and backend — as if it were going into production.

## Exercise

### Data model

- Two entity types: **level** and **space**
- Each entity has a unique `id` and a `name`
- A space belongs to exactly one level
- Ordering uses [fractional indexes](https://www.npmjs.com/package/fractional-indexing)

### Features

**CRUD**
- Add, rename, and delete levels and spaces
- Swipe to delete (mobile gesture)

**Reordering**
- Drag to reorder spaces within a level
- Drag to reorder levels
- Drag a space into a different level
- Ordering is stored as fractional indexes

**Offline-first sync**
- All mutations work without connectivity (local queue)
- Auto-sync when connection resumes
- Visible offline indicator and sync status in the UI

**UI**
- Mobile-first (Chrome on Android/iOS)
- No Figma provided — you own the design decisions

### Stack

**Frontend — required:**

- React 19 + TypeScript
- [TanStack Router](https://tanstack.com/router/latest) (SPA)
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) + [lucide](https://lucide.dev/icons/)
- [Serwist](https://serwist.pages.dev/) (PWA / service worker)
- [dnd-kit](https://dndkit.com/) (drag-and-drop)

**Backend — your choice:**

- Language: Python or TypeScript
- Database: JSON file, SQLite, or PostgreSQL
- Minimal REST API — no framework prescribed

## Deliverables

| Deliverable | Details |
| --- | --- |
| **GitHub repo** | Public, clean commit history |
| **Live deployment** | [Render](https://render.com/), [Vercel](https://vercel.com/), [Railway](https://railway.com/), or equivalent — must be testable |
| **`export session.md`** | Your Claude Code session history, agentguide.md, historic.md, agentrules or all IA related files/equivalent. |
| **`DESIGN.md`** | In the repo root. English, ≤ 500 lines. See below. |
| **[Loom video](https://www.loom.com/)** | ~5 min. Demo + key decisions + how you used AI |

### DESIGN.md

A human-readable document covering:

- Architecture overview (how frontend, backend, and sync fit together)
- Key decisions: data model, sync strategy, DB choice, PWA setup
- Tradeoffs you considered and rejected
- Key libraries and resources used (with links)

Aim for clarity over completeness. Easy to scan, not a wall of text.

## A note on AI

Auditoo is an AI-native company. We expect engineers to use AI coding agents as a natural part of their workflow — not as an occasional assistant, but as a core tool.

This task is intentionally scoped large. Candidates who master AI-assisted development will ship something coherent in a few hours. We don't require an AI log or artifact, but your Loom should briefly touch on how you worked with AI and where you had to course-correct it.

## Submission

Send to **gauthier@auditoo.eco**:

- Link to your GitHub repo or zip
- Link to the live deployment
- Loom link

If you have question email Gauthier.

Good luck — we look forward to the peer programming session with Lionel.


