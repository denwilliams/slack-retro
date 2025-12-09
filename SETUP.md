# Slack Retro - Setup Guide

## Prerequisites

- Node.js 18+ installed
- A Slack workspace where you can install apps
- A Neon database account (free tier works)
- Vercel account for deployment (optional for local development)

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Neon Database

1. Create a new project on [Neon](https://neon.tech)
2. Copy your database connection string
3. The connection string should look like:
   ```
   postgresql://user:password@host/database?sslmode=require
   ```

### 3. Create Slack App

1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app "Retro Bot" and select your workspace
4. Configure the following:

#### OAuth & Permissions

Add these **Bot Token Scopes**:
- `app_mentions:read`
- `chat:write`
- `users:read`
- `users:read.email`

#### Event Subscriptions

1. Enable Events
2. Request URL: `https://your-domain.com/api/slack/events`
3. Subscribe to bot events:
   - `app_home_opened`
   - `app_mention`

#### Interactivity & Shortcuts

1. Enable Interactivity
2. Request URL: `https://your-domain.com/api/slack/events`

#### App Home

1. Enable Home Tab
2. Enable Messages Tab (optional)

#### Install App

Install the app to your workspace and copy the **Bot User OAuth Token**

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Slack App Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret

# Neon Database
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Initialize Database

Start the dev server:

```bash
npm run dev
```

Then initialize the database by visiting:
```
http://localhost:3000/api/init-db
```

Or use curl:
```bash
curl -X POST http://localhost:3000/api/init-db
```

### 6. Update Slack App URLs

Update your Slack app configuration with your public URL:
- Event Subscriptions Request URL: `https://your-domain.com/api/slack/events`
- Interactivity Request URL: `https://your-domain.com/api/slack/events`

For local development, use [ngrok](https://ngrok.com/) to create a public URL:

```bash
ngrok http 3000
```

Then update the Slack app URLs with your ngrok URL (e.g., `https://abc123.ngrok.io/api/slack/events`)

### 7. Test the App

1. Open Slack
2. Go to your workspace
3. Find your app in the Apps section
4. Click on the app to open the Home tab
5. You should see the retro interface!

## Deployment to Vercel

### 1. Push to GitHub

Make sure your code is pushed to a GitHub repository.

### 2. Deploy to Vercel

1. Go to [Vercel](https://vercel.com)
2. Import your GitHub repository
3. Add environment variables from `.env.local`
4. Deploy!

### 3. Update Slack App URLs

Update your Slack app configuration with your Vercel URL:
- Event Subscriptions Request URL: `https://your-app.vercel.app/api/slack/events`
- Interactivity Request URL: `https://your-app.vercel.app/api/slack/events`

### 4. Initialize Production Database

Visit your production URL to initialize the database:
```
https://your-app.vercel.app/api/init-db
```

Or use curl:
```bash
curl -X POST https://your-app.vercel.app/api/init-db
```

## Usage

### Starting a Retro

1. Open the app in Slack
2. Click "Add Discussion Item" to add items in three categories:
   - 😊 What went well
   - 😕 What could be improved
   - ❓ Questions / Discussion topics
3. Add action items with "Add Action Item"
4. When done, click "Finish Retro" to save a summary

### Viewing Past Retros

Click "Past Retros" to view summaries of previous retrospectives.

## Troubleshooting

### Slack Events Not Working

- Make sure your Request URL is publicly accessible
- Check that your Slack Signing Secret is correct
- Verify that Event Subscriptions are enabled

### Database Connection Issues

- Verify your DATABASE_URL is correct
- Make sure your Neon database is running
- Check that you've initialized the database

### App Not Appearing in Slack

- Make sure you've installed the app to your workspace
- Check that the App Home tab is enabled in your app configuration

## Development Tips

- Use ngrok for local development with Slack
- Check the Vercel logs for debugging production issues
- The database schema is automatically created when you call `/api/init-db`
- Each team gets one active retro at a time
