# Slack Retro

A Slack app for running team retrospectives directly in Slack using the App Home tab, with an optional browser view for a richer experience.

## Features

### Discussion Items
- Add discussion items in three categories:
  - What went well
  - What could be improved
  - Questions / Discussion topics
- Items are displayed with author attribution
- Users can only edit or delete their own items

### Action Items
- Create action items with assigned responsibility
- Mark items as complete/incomplete with a toggle
- Incomplete action items carry over to the next retro
- Track who's responsible for each action

### Retro Management
- **Finish Retro** generates a markdown summary of all discussion and action items
- **Past Retros** shows historical retro summaries with dates
- One active retro per team at a time

### Browser View
- Open a live retro board in the browser from Slack
- 3-column layout with inline add/edit/delete
- Real-time updates via Server-Sent Events (SSE)

### Team Instructions
- Set markdown-formatted retro instructions per team
- Instructions render as rich text in the Slack modal

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [TanStack Start](https://tanstack.com/start) (Vite + Nitro)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) with Bun's built-in PostgreSQL driver (`bun:sql`)
- **Database**: PostgreSQL
- **Real-time**: [Upstash Redis](https://upstash.com) + SSE
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **Linting**: [Biome](https://biomejs.dev)
- **Slack**: `@slack/web-api`
- **Hosting**: Vercel

## Getting Started

See [SETUP.md](./SETUP.md) for detailed installation and deployment instructions.

### Quick Start

1. Clone the repository
2. Install dependencies: `bun install`
3. Create Slack app using `slack-manifest.yaml` (see [SETUP.md](./SETUP.md))
4. Set up environment variables (see `.env.example`)
5. Run Drizzle migrations: `bun run db:migrate`
6. Deploy to Vercel or run locally with `bun run dev`

## Project Structure

```
slack-retro/
├── src/
│   ├── routes/                  # TanStack Router pages
│   │   ├── __root.tsx           # HTML shell layout
│   │   ├── index.tsx            # Landing page
│   │   └── retro.tsx            # Retro board (browser view)
│   ├── server/
│   │   ├── auth.ts              # HMAC token auth (Bun.CryptoHasher)
│   │   ├── redis.ts             # Upstash Redis pub/sub
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle schema (5 tables)
│   │   │   ├── index.ts         # DB connection (bun:sql)
│   │   │   └── queries.ts       # All query functions
│   │   └── slack/
│   │       ├── handlers.ts      # Slack event processing
│   │       └── ui.ts            # Slack Block Kit UI builders
│   ├── lib/
│   │   └── use-sse.ts           # React hook for SSE
│   └── types/
│       └── index.ts             # Re-exported Drizzle types
├── server/
│   └── routes/api/              # Nitro API routes
│       ├── slack/events.post.ts # Slack webhook
│       ├── auth/browser.get.ts  # Browser auth
│       ├── sse.get.ts           # SSE endpoint
│       ├── retro.get.ts         # GET retro data
│       ├── discussion-items.*   # Discussion item CRUD
│       ├── action-items.*       # Action item CRUD
│       ├── init-db.post.ts      # DB connection check
│       └── db-health.get.ts     # Table health check
├── drizzle/                     # Generated migrations
├── drizzle.config.ts
├── vite.config.ts
├── biome.json
├── slack-manifest.yaml
└── CLAUDE.md                    # Development notes
```

## Environment Variables

### Required
- `DATABASE_URL` — PostgreSQL connection string
- `SLACK_BOT_TOKEN` — Bot User OAuth Token (`xoxb-...`)
- `SLACK_SIGNING_SECRET` — For verifying requests from Slack

### Optional
- `AUTH_SECRET` — For browser auth tokens (defaults to `SLACK_SIGNING_SECRET`)
- `UPSTASH_REDIS_REST_URL` — For real-time updates via SSE
- `UPSTASH_REDIS_REST_TOKEN` — For real-time updates via SSE
- `BASE_URL` — Override base URL (defaults to `VERCEL_URL` or `localhost:3000`)

## Database Schema

- **retrospectives** — Retro sessions (active/finished status)
- **discussion_items** — Discussion topics by category (good/bad/question)
- **action_items** — Action items with completion tracking
- **team_settings** — Per-team retro instructions
- **installations** — Reserved for future OAuth implementation

## Development

```bash
bun install          # Install dependencies
bun run dev          # Start dev server (port 3000)
bun test             # Run tests
bun run lint         # Lint with Biome
bun run typecheck    # TypeScript check
bun run build        # Production build
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
```

## License

ISC
