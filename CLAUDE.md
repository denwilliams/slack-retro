# Claude Development Notes

This document contains important context for Claude Code sessions working on this project.

## Project Overview

This is a Slack App for running team retrospectives. Users interact with the app through the Slack App Home tab, where they can add discussion items, create action items, and view past retros.

## Architecture Decisions

### Why Not Slack Bolt?

Originally attempted to use `@slack/bolt` but ran into issues with Next.js App Router integration:
- Bolt's `receiver.requestListener` is private and not meant for external use
- Custom event handler (`lib/slack-handlers.ts`) was implemented instead
- Direct use of `@slack/web-api` WebClient for API calls
- Manual request verification using HMAC SHA256

### Database Connection Pattern

The database connection in `lib/db.ts` uses a placeholder pattern to allow builds without DATABASE_URL:
```typescript
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:password@localhost/dbname";
```

This is intentional to allow Next.js builds to complete without throwing errors during static page generation. Runtime validation occurs when the database is actually used.

### Slack Client Initialization

In `lib/slack-handlers.ts`, the Slack client uses lazy initialization:
```typescript
function getSlackClient() {
  if (!client) {
    client = getClient();
  }
  return client;
}
```

This prevents errors during build time when SLACK_BOT_TOKEN isn't available.

### TypeScript Type Casting

Slack UI builders in `lib/slack-ui.ts` use `as const` for modal types and `as any` when passing to the API:
```typescript
return {
  type: "modal" as const,
  // ...
}

await client.views.open({
  view: buildAddDiscussionItemModal() as any,
});
```

This is necessary because Slack's TypeScript types are very strict and the runtime accepts more flexibility than the types suggest.

## Key Files

### `lib/slack-handlers.ts`
Processes all Slack events and interactivity. Main event types:
- `event_callback` → `app_home_opened`: Refresh home view
- `block_actions`: Handle button clicks
- `view_submission`: Handle modal form submissions

### `lib/slack-ui.ts`
Builds Slack Block Kit UI structures:
- `buildHomeView()`: Main App Home interface
- `buildAddDiscussionItemModal()`: Modal for adding discussion items
- `buildAddActionItemModal()`: Modal for adding action items
- `buildPastRetrosModal()`: Modal showing historical retros
- `generateRetroSummary()`: Creates markdown summary

### `lib/queries.ts`
All database queries using Neon's serverless PostgreSQL client. Uses tagged template literals for SQL queries:
```typescript
await sql`SELECT * FROM retrospectives WHERE team_id = ${teamId}`
```

### `app/api/slack/events/route.ts`
Next.js API route that:
1. Verifies Slack request signatures
2. Handles URL verification challenges
3. Processes events asynchronously with `setImmediate()`
4. Returns immediate acknowledgment to Slack

## Database Schema Notes

### Foreign Key Constraints
- `retrospectives.team_id` → `installations.team_id`
- `discussion_items.retro_id` → `retrospectives.id` (CASCADE DELETE)
- `action_items.retro_id` → `retrospectives.id` (CASCADE DELETE)

### Important: User Name Storage
User names are denormalized and stored with items:
- `discussion_items.user_name`
- `action_items.responsible_user_name`

This is intentional to avoid extra Slack API calls when displaying items.

## Slack App Configuration Required

**Quick Setup**: Use `slack-manifest.yaml` to create the app with all settings pre-configured. Just update the request URLs before creating the app.

### OAuth Scopes
- `app_mentions:read`
- `chat:write`
- `users:read`
- `users:read.email`

### Event Subscriptions
- `app_home_opened`
- `app_mention`

### Interactivity
All buttons, modals, and interactions use the same endpoint: `/api/slack/events`

### App Home
- Home tab must be enabled
- No messages tab needed

## Common Development Tasks

### Adding a New Modal
1. Create builder function in `lib/slack-ui.ts` with `type: "modal" as const`
2. Add handler in `lib/slack-handlers.ts` for the button action
3. Add view submission handler for the modal's `callback_id`
4. Call `refreshHomeView()` after processing to update the UI

### Adding a New Database Table
1. Add TypeScript interface to `types/index.ts`
2. Add CREATE TABLE statement to `lib/db.ts` → `initDatabase()`
3. Add query functions to `lib/queries.ts`
4. Users must call `/api/init-db` again after deploying schema changes

### Testing Locally with Slack
1. Use ngrok: `ngrok http 3000`
2. Update Slack app URLs with ngrok URL (or update manifest and reinstall)
3. Run `npm run dev`
4. Check ngrok web interface for request details

### Updating Slack App Manifest
When adding new OAuth scopes or event subscriptions:
1. Update `slack-manifest.yaml` with the new configuration
2. Go to your Slack app settings → App Manifest
3. Paste the updated YAML and save
4. Reinstall the app to your workspace if permissions changed

## Known Limitations

### Single Team Support
The app currently supports one active retro per team. To support multiple teams:
- Would need to remove the UNIQUE constraint on `installations.team_id`
- Add proper OAuth flow for multi-workspace installations
- Update queries to filter by specific installation

### No Authentication
All Slack users can:
- See all discussion items and action items
- Mark any action item complete/incomplete
- Only restriction: users can only edit/delete their own discussion items

### Action Item Filtering
`getActionItems()` only returns incomplete items. `getAllActionItems()` returns everything. This is used to:
- Show only active items in the home view
- Include completed items in the final summary

## Environment Variables

### Required
Only these 3 environment variables are needed:
- `SLACK_BOT_TOKEN`: Bot User OAuth Token (starts with `xoxb-`)
- `SLACK_SIGNING_SECRET`: For verifying requests from Slack
- `DATABASE_URL`: Neon PostgreSQL connection string

### Not Used (No Need to Set)
- `SLACK_APP_TOKEN`: Only needed for Socket Mode (we use HTTP endpoints)
- `SLACK_CLIENT_ID`: Only needed for OAuth flow (not implemented)
- `SLACK_CLIENT_SECRET`: Only needed for OAuth flow (not implemented)

## Deployment Checklist

1. Create Neon database and get connection string
2. Create Slack app and configure all settings
3. Set environment variables in Vercel
4. Deploy to Vercel
5. Update Slack app Request URLs with Vercel deployment URL
6. Run database initialization: `curl -X POST https://your-app.vercel.app/api/init-db`
7. Install app to Slack workspace
8. Test by opening App Home in Slack

## Troubleshooting

### "Invalid signature" errors
- Check SLACK_SIGNING_SECRET is correct
- Verify timestamp isn't too old (Slack rejects requests >5 minutes old)
- Check request is coming from Slack (not a browser refresh)

### Database connection errors at build time
- This is expected! The placeholder connection string allows builds to complete
- Real validation happens at runtime when database is accessed
- Ensure DATABASE_URL is set in production environment

### Home view not updating
- Check that `refreshHomeView()` is called after data changes
- Verify user_id and team_id are correctly extracted from payload
- Look for errors in Vercel logs or console

### Modals not opening
- Verify `trigger_id` is passed correctly (it expires after 3 seconds)
- Check that the action handler calls `client.views.open()`
- Ensure modal builder returns proper structure with `type: "modal" as const`

## Code Style Notes

- Use `async/await` for all database and Slack API calls
- Error handling: Log errors but don't throw (Slack expects 200 OK)
- Use template literals for SQL queries with `sql` tag
- Export typed interfaces from `types/index.ts`
- Keep UI builders pure functions in `lib/slack-ui.ts`

## Future Improvements to Consider

1. **OAuth Flow**: Implement proper installation flow instead of manual token setup
2. **Multi-workspace**: Support installing to multiple Slack workspaces
3. **Recurring Retros**: Auto-create new retros on schedule
4. **Notifications**: Remind users about outstanding action items
5. **Customization**: Allow teams to customize category names
6. **Export**: Add CSV/JSON export for retro data
7. **Analytics**: Track retro participation and action item completion rates
8. **Threads**: Support threaded discussions on items
9. **Voting**: Let team members vote on discussion items
10. **Templates**: Pre-defined retro formats beyond the 3-category structure
