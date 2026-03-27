# Claude Development Notes

This document contains important context for Claude Code sessions working on this project.

## Project Overview

This is a Slack App for running team retrospectives. Users interact with the app through the Slack App Home tab, where they can add discussion items, create action items, and view past retros. A browser view is also available via an authenticated link from Slack.

## Tech Stack

- **Runtime**: Bun
- **Framework**: TanStack Start (Vite + Nitro)
- **Language**: TypeScript (strict mode)
- **ORM**: Drizzle ORM with `bun:sql` (Bun's built-in PostgreSQL driver)
- **Database**: PostgreSQL
- **Real-time**: Upstash Redis (HTTP-based polling) + Server-Sent Events
- **Styling**: Tailwind CSS v4
- **Linting**: Biome
- **Slack**: `@slack/web-api` WebClient (no Bolt)

## Commands

- `bun install` — Install dependencies
- `bun run dev` — Start dev server on port 3000
- `bun run build` — Production build (outputs to `.output/`)
- `bun run start` — Run production build
- `bun test` — Run tests
- `bun run lint` — Lint with Biome
- `bun run typecheck` — TypeScript check
- `bun run db:generate` — Generate Drizzle migrations
- `bun run db:migrate` — Run Drizzle migrations
- `bun run db:studio` — Open Drizzle Studio

## Architecture

### Two Route Systems

**Page routes** (`src/routes/`) — TanStack Router file-based routing for React pages:
- `__root.tsx` — HTML shell, Tailwind import, `<Outlet />`
- `index.tsx` — Landing page (`/`)
- `retro.tsx` — Retro board (`/retro`) with SSE live updates

**API routes** (`server/routes/api/`) — Nitro server routes with method-based file naming:
- `slack/events.post.ts` — Slack webhook endpoint
- `auth/browser.get.ts` — Browser auth (token → session cookie → redirect)
- `sse.get.ts` — Server-Sent Events for real-time updates
- `retro.get.ts` — GET active retro + items
- `discussion-items.{post,patch,delete}.ts` — Discussion item CRUD
- `action-items.{post,patch}.ts` — Action item create/toggle
- `init-db.post.ts` — Database connection check
- `db-health.get.ts` — Table health check

### Why Not `createAPIFileRoute`?

TanStack Start v1 does not export `createAPIFileRoute`. All API routes use Nitro's native `defineHandler` from `nitro/h3` in `server/routes/`. Nitro auto-discovers these routes with method-based file naming (e.g., `events.post.ts` handles POST).

### Why Not Slack Bolt?

Bolt's `receiver.requestListener` is private and doesn't integrate well with custom server frameworks. Instead:
- Direct use of `@slack/web-api` WebClient for API calls
- Manual request verification using HMAC SHA256 (`Bun.CryptoHasher`)
- Custom event handler in `src/server/slack/handlers.ts`

### Database Connection Pattern

The database connection in `src/server/db/index.ts` uses a placeholder to allow builds without DATABASE_URL:
```typescript
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:password@localhost/dbname";
export const db = drizzle({ connection: DATABASE_URL, schema });
```

### Slack Client Initialization

In `src/server/slack/handlers.ts`, the Slack client uses lazy initialization to prevent errors during build time when SLACK_BOT_TOKEN isn't available.

### Auth Flow

1. User clicks "Open in Browser" in Slack App Home
2. Handler generates a signed HMAC token (5-minute expiry)
3. Modal shows a link to `/api/auth/browser?token=...`
4. Browser auth route verifies token, creates session cookie (4-hour expiry), redirects to `/retro`
5. All browser API routes authenticate via the `retro_session` cookie

### Real-Time Updates (SSE)

- Mutations in both Slack handlers and browser API routes call `publishEvent()` from `src/server/redis.ts`
- Events are stored in Redis lists per team (`retro:events:${teamId}`)
- SSE endpoint (`server/routes/api/sse.get.ts`) polls Redis every 2 seconds for new events
- Browser clients use `useSSE()` hook (`src/lib/use-sse.ts`) with auto-reconnect and exponential backoff
- Falls back gracefully when Redis is not configured (no real-time, manual refresh still works)

## Key Files

### `src/server/db/schema.ts`
Drizzle schema defining 5 tables: `installations`, `retrospectives`, `discussionItems`, `actionItems`, `teamSettings`. Exports inferred types via `InferSelectModel`/`InferInsertModel`.

### `src/server/db/queries.ts`
All 19 database query functions using Drizzle query builder. Exact same function signatures as the original raw SQL queries.

### `src/server/auth.ts`
HMAC-SHA256 token auth using `Bun.CryptoHasher`. Functions: `generateAuthToken`, `verifyAuthToken`, `generateSessionToken`, `verifySessionToken`, `getSessionFromCookieHeader`.

### `src/server/slack/handlers.ts`
Processes all Slack events. Split into handler functions to keep cognitive complexity under 15 (Biome rule). Main export: `processSlackEvent(payload)`.

### `src/server/slack/ui.ts`
Pure functions that return Slack Block Kit JSON. All UI builders including markdown-to-rich-text conversion.

### `src/server/redis.ts`
Upstash Redis client with lazy initialization. Exports `publishEvent()` (fire-and-forget) and `getRecentEvents()` (for SSE polling).

## Database Schema

### Tables
- **installations** — Slack workspace info (future OAuth)
- **retrospectives** — Retro sessions with active/finished status
- **discussion_items** — Discussion topics by category (good/bad/question), FK → retrospectives (CASCADE DELETE)
- **action_items** — Assigned tasks with completion tracking, FK → retrospectives (CASCADE DELETE)
- **team_settings** — Per-team configuration (retro instructions)

### User Name Storage
User names are denormalized on `discussion_items.user_name` and `action_items.responsible_user_name`. This avoids extra Slack API calls when displaying items.

## Slack App Configuration

**Quick Setup**: Use `slack-manifest.yaml` to create the app with all settings pre-configured.

### OAuth Scopes
`app_mentions:read`, `chat:write`, `users:read`, `users:read.email`

### Event Subscriptions
`app_home_opened`, `app_mention`

### Interactivity
All buttons, modals, and interactions use the same endpoint: `/api/slack/events`

## Common Development Tasks

### Adding a New Modal
1. Create builder function in `src/server/slack/ui.ts` with `type: "modal" as const`
2. Add handler in `src/server/slack/handlers.ts` for the button action
3. Add view submission handler for the modal's `callback_id`
4. Call `refreshHomeView()` after processing to update the UI
5. Add `publishEvent()` call if the action mutates data

### Adding a New Database Table
1. Add table definition to `src/server/db/schema.ts` using `pgTable()`
2. Export inferred types (`InferSelectModel`, `InferInsertModel`)
3. Re-export types from `src/types/index.ts`
4. Add query functions to `src/server/db/queries.ts`
5. Run `bun run db:generate` then `bun run db:migrate`

### Adding a New API Route
Create a file in `server/routes/api/` with method suffix (e.g., `my-route.get.ts`):
```typescript
import { defineHandler, getRequestHeader } from "nitro/h3";
import { getSessionFromCookieHeader } from "@/server/auth";

export default defineHandler(async (event) => {
  const session = getSessionFromCookieHeader(getRequestHeader(event, "cookie") ?? null);
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  // ... route logic
  return { data: "..." };
});
```

### Testing Locally with Slack
1. Use ngrok: `ngrok http 3000`
2. Update Slack app URLs with ngrok URL
3. Run `bun run dev`
4. Check ngrok web interface for request details

## Environment Variables

### Required
- `DATABASE_URL` — PostgreSQL connection string
- `SLACK_BOT_TOKEN` — Bot User OAuth Token (`xoxb-...`)
- `SLACK_SIGNING_SECRET` — For verifying requests from Slack

### Optional
- `AUTH_SECRET` — For browser auth tokens (defaults to `SLACK_SIGNING_SECRET`)
- `UPSTASH_REDIS_REST_URL` — For real-time updates
- `UPSTASH_REDIS_REST_TOKEN` — For real-time updates
- `BASE_URL` — Override base URL (defaults to `VERCEL_URL` or `localhost:3000`)

## Code Style

- Biome enforced: tabs, 100 line width, `noDefaultExport` (exempted for route files)
- Named exports only (no default exports except Nitro route handlers)
- `async/await` for all async operations
- Error handling: Log errors but don't throw in Slack handlers (Slack expects 200 OK)
- Cognitive complexity limit: 15 per function
- Types inferred from Drizzle schema, re-exported from `src/types/index.ts`

## Troubleshooting

### "Invalid signature" errors
- Check `SLACK_SIGNING_SECRET` is correct
- Verify timestamp isn't too old (Slack rejects >5 minutes)

### Database connection errors at build time
- Expected — the placeholder connection string allows builds to complete
- Real validation happens at runtime

### Home view not updating
- Check that `refreshHomeView()` is called after data changes
- Verify `user_id` and `team_id` are correctly extracted from payload

### SSE not working
- Check Redis env vars are set
- SSE falls back to no real-time when Redis is unavailable
- Check browser console for EventSource connection errors
