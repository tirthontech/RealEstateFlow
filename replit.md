# EstateFlow CRM

A full-stack real estate CRM with Dashboard, Leads, Properties, Deals (Kanban), and Agents management.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/crm run dev` — run the CRM frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (then overwrite `lib/api-zod/src/index.ts` to `export * from "./generated/api";` only)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Wouter (routing), shadcn/ui, Recharts, lucide-react
- API: Express 5, Pino logging
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle for API server)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all endpoints)
- `lib/api-zod/src/index.ts` — must remain `export * from "./generated/api";` only
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `lib/db/src/schema/` — Drizzle schema files (agents, leads, properties, deals, activity)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/crm/src/pages/` — All page components (dashboard, leads, lead-detail, properties, property-detail, deals, agents, agent-detail)
- `artifacts/crm/src/components/MainLayout.tsx` — Sidebar nav layout
- `artifacts/crm/src/lib/utils.ts` — Helpers (formatCurrency, statusColor, stageLabel, etc.)
- `artifacts/crm/src/index.css` — Theme (navy sidebar + amber primary)

## Architecture decisions

- Contract-first API: OpenAPI spec drives codegen for both Zod validators (server) and React Query hooks (client). Never write raw fetch or manual hooks.
- Drizzle `inArray()` must be used instead of `sql\`ANY(...)\`` for array filtering — Drizzle's parameterization doesn't produce valid PostgreSQL ANY syntax with tuple notation.
- API server uses esbuild for bundling; **restart the workflow** after any route changes (hot reload is not available).
- Generated React Query hooks return `T` directly (not `{ data: T }`). When passing `enabled`, must also pass `queryKey`.
- Orval `schemas` option was removed from `orval.config.ts` to avoid duplicate exports in the generated barrel.

## Product

- **Dashboard**: KPI stat cards (leads, pipeline value, revenue, properties), active pipeline bar chart, lead sources pie chart, recent activity feed
- **Leads**: Searchable/filterable table with status badges, lead scores, budget; create/delete leads; click through to editable detail view
- **Properties**: Card grid with price, beds/baths/sqft, status; create/delete; click through to editable detail view
- **Deals**: Drag-and-drop Kanban board across 7 stages (Prospect → Closed); create/delete deals; stage value totals per column
- **Agents**: Agent cards with live stats (leads, deals, revenue); create; click through to editable detail view

## Gotchas

- After any `codegen` run, overwrite `lib/api-zod/src/index.ts` with `export * from "./generated/api";` only.
- API server must be restarted (not just edited) for changes to take effect — it compiles to `dist/` with esbuild.
- `inArray` from `drizzle-orm` required for multi-value WHERE clauses; `sql\`ANY(...)\`` does not work correctly.
- Deals table `value` column is `numeric` in Postgres → always wrap with `Number()` when used in JS arithmetic.

## Pointers

- See `.local/skills/pnpm-workspace` for workspace structure and TypeScript setup
- See `.local/skills/react-vite` for frontend conventions
