# slack-retro
For running retrospectives in Slack.

For now it only supports a single team per Slack install and no privacy controls. Assumes that everyone with Slack access is permitted to access this and see contents. In the future we may add team control and privacy.

Provides a home page in Slack where each team member can add items, and remove or edit their OWN ITEMS ONLY.

Format for now is fixed to 3 columns that represent good, bad, and questions/sharing -> :) | :( | ?

I don't think Slack can have 3 columns, so it might have to be laid out vertically.

The "add discussion item" button should be at the top so you don't have to scroll down unless you need to. Discussion items should be tagged with whoever added it.

There should also be an "add action item" to add actions as discussion happens. Action items should be tagged with whoever is responsible for it.

Each action item should have a "mark complete" button so we can remove the done ones.

Finally when the retro is done there should be a finish retro button that summarises all the discussion topics that were included, plus any action items that were added or are still outstanding in a single chunk of text (simple markdown formatting) and save it to the database. After this is done then delete the discussion items but keep the action items.

There needs to be a "Past Retros" button to view past retros

## Implementation Decisions

The project will be hosted on Vercel and should use Next.js

The API should use Hono with their built in support for Next.js

The database will be Neon serverless so use the required SDK for that.
