# Auditoo — web

React 19 SPA (Vite, TanStack Router, Tailwind v4, shadcn/ui, Serwist PWA). All data goes through the Hono API in `apps/api`, not Supabase directly from the browser.

- **Run from monorepo root:** `npm run dev` (starts API + Vite + Supabase per root `package.json`).
- **Env:** copy [`apps/web/.env.example`](.env.example) to `apps/web/.env`.
- **Full setup:** [docs/SETUP.md](../../docs/SETUP.md) · [../../README.md](../../README.md)
