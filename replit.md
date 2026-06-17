# FlowPulse

WhatsApp / Instagram / TikTok DM automation SaaS — manage flows, broadcasts, contacts, inbox, analytics, and GDPR compliance across social messaging channels.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/flowpulse run dev` — run the frontend (port from $PORT)
- `pnpm run typecheck` — full typecheck across all packages (must pass with 0 errors)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT stored in localStorage under key `fp_token` — `{ userId, tenantId, email, role }`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Frontend: React + Vite; Vite proxy `/api → http://localhost:8080`
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — Drizzle ORM schema (source of truth for DB shape)
- `artifacts/api-server/src/routes/` — all Express API routes
- `artifacts/api-server/src/lib/auth.ts` — JWT middleware + helpers
- `artifacts/flowpulse/src/lib/api.ts` — all frontend API stubs (calls `/api/*`)
- `artifacts/flowpulse/src/hooks/useAuth.ts` — JWT auth hook (no Supabase)
- `artifacts/flowpulse/src/lib/supabase.ts` — null shim (Supabase fully removed)

## Architecture decisions

- **No Supabase** — all data goes through our own Express API; `supabase.ts` is a null shim so old imports compile without errors.
- **JWT auth** — tokens issued by `/api/auth/signin`, stored in `localStorage` as `fp_token`, sent as `Authorization: Bearer <token>` on every API call.
- **Vite proxy** — frontend proxies `/api/*` to `localhost:8080` so there are no CORS issues in dev.
- **noImplicitAny: false** in `artifacts/flowpulse/tsconfig.json` — allows the Bolt-generated frontend to compile without exhaustive type annotations.
- **API stubs pattern** — all frontend API modules use thin wrapper functions over `restApi()` so the real backend can be wired in incrementally.

## Product

- **Inbox** — unified DM inbox across WhatsApp / Instagram / TikTok with conversation management
- **Flows** — visual automation flow builder with trigger/action nodes
- **Broadcasts** — bulk message campaigns with scheduling and segmentation
- **Contacts** — unified contact database with tags, loyalty tiers, GDPR opt-in
- **Analytics** — attribution, revenue, funnel, and time-series reporting
- **Knowledge Base** — documents for AI response grounding
- **GDPR** — consent logging, data export, and erasure

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Any supabase import that was missed will show as `Cannot find name 'supabase'` — fix by replacing with the equivalent `api.ts` stub call or a local state update.
- The frontend `PickerChannel` type in `FlowBuilderPage.tsx` does not include `'logic'` or `'ai'` — comparisons need `(activeChannel as string)` casts.
- `attributionApi.analytics` and `realtimeApi.markAllRead` stubs accept variadic args to avoid call-site changes.
- DB push must be run after any schema change: `pnpm --filter @workspace/db run push`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
