# Slack Retro

A Slack app for running team retrospectives directly in Slack using the App Home tab.

## Features

### Discussion Items
- Add discussion items in three categories:
  - 😊 **What went well** - Positive highlights from the sprint
  - 😕 **What could be improved** - Areas needing attention
  - ❓ **Questions / Discussion topics** - Items to talk about
- Items are displayed vertically with author attribution
- Users can only edit or delete their own items
- Add button positioned at top for easy access

### Action Items
- Create action items with assigned responsibility
- Mark items as complete/incomplete with a toggle button
- Action items persist across retros (discussion items are cleared)
- Track who's responsible for each action

### Retro Management
- **Finish Retro** - Generates a markdown summary of all discussion and action items
- **Past Retros** - View historical retro summaries with completion dates
- One active retro per team at a time

### Privacy & Access
- Single team per Slack installation
- No granular privacy controls (all team members can see all items)
- Users can only modify their own discussion items

## Tech Stack

- **Frontend/Backend**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Neon Serverless PostgreSQL
- **Slack Integration**: Slack Web API
- **Hosting**: Vercel

## Getting Started

See [SETUP.md](./SETUP.md) for detailed installation and deployment instructions.

### Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Create Slack app using `slack-manifest.yaml` (see [SETUP.md](./SETUP.md))
4. Set up environment variables (see `.env.example`)
5. Initialize the database: `POST /api/init-db`
6. Deploy to Vercel or run locally with `npm run dev`

## Project Structure

```
slack-retro/
├── app/
│   ├── api/
│   │   ├── init-db/         # Database initialization endpoint
│   │   └── slack/events/    # Slack event handler
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── db.ts               # Database connection
│   ├── queries.ts          # Database queries
│   ├── slack-handlers.ts   # Slack event processing
│   └── slack-ui.ts         # Slack UI builders
├── types/
│   └── index.ts            # TypeScript interfaces
├── slack-manifest.yaml     # Slack app configuration
├── TODO.md                 # Project roadmap
├── SETUP.md                # Setup instructions
└── CLAUDE.md               # Development notes for Claude
```

## Database Schema

- **retrospectives** - Retro sessions (active/finished status)
- **discussion_items** - Discussion topics by category
- **action_items** - Action items with completion tracking
- **installations** - Reserved for future OAuth implementation (not currently used)

## Future Enhancements

- Multi-team support per Slack installation
- Privacy controls and permissions
- Customizable category names
- Export to external formats
- Reminder notifications for outstanding action items
- Recurring retro scheduling

## License

ISC
