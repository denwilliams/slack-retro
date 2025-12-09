# TODO List - Slack Retro App

## Phase 1: Project Setup & Infrastructure
- [ ] Initialize Next.js project with TypeScript
- [ ] Set up Hono API framework with Next.js integration
- [ ] Configure Neon serverless database connection
- [ ] Set up environment variables and configuration
- [ ] Install Slack SDK dependencies
- [ ] Configure Vercel deployment settings
- [ ] Set up basic project structure (folders, types, utilities)

## Phase 2: Database Schema & Models
- [ ] Design database schema for retrospectives
  - Retrospectives table (id, team_id, status, created_at, finished_at, summary)
  - Discussion items table (id, retro_id, user_id, category, content, created_at)
  - Action items table (id, retro_id, user_id, responsible_user_id, content, completed, created_at, completed_at)
- [ ] Create database migration scripts
- [ ] Implement database connection utilities
- [ ] Create TypeScript types/interfaces for data models

## Phase 3: Slack App Setup
- [ ] Create Slack app configuration
- [ ] Configure OAuth scopes and permissions
- [ ] Set up Slack App Home tab
- [ ] Implement Slack event subscriptions
- [ ] Implement Slack interactivity (buttons, modals)
- [ ] Set up Slack OAuth installation flow

## Phase 4: API Development (Hono)
- [ ] Create API route structure
- [ ] Implement Slack event handler endpoint
- [ ] Implement Slack interactivity endpoint
- [ ] Implement Slack OAuth callback endpoint
- [ ] Create CRUD endpoints for discussion items
- [ ] Create CRUD endpoints for action items
- [ ] Create endpoint for finishing retro
- [ ] Create endpoint for fetching past retros
- [ ] Add proper error handling and validation

## Phase 5: Slack Home Tab UI
- [ ] Design home tab layout (vertical layout for 3 categories)
- [ ] Implement "Add Discussion Item" button at top
- [ ] Create modal for adding discussion items with category selection (:) | :( | ?)
- [ ] Display discussion items grouped by category
  - :) Good/Positive items
  - :( Bad/Negative items
  - ? Questions/Sharing items
- [ ] Show user attribution for each discussion item
- [ ] Add edit/delete buttons for user's own items only
- [ ] Implement "Add Action Item" button
- [ ] Create modal for adding action items with responsible person
- [ ] Display action items with completion checkboxes
- [ ] Add "Mark Complete" functionality for action items
- [ ] Implement "Finish Retro" button
- [ ] Implement "Past Retros" button/view

## Phase 6: Core Features Implementation
- [ ] Discussion Item Management
  - [ ] Add discussion item functionality
  - [ ] Edit own discussion items
  - [ ] Delete own discussion items
  - [ ] Validate user permissions (own items only)
- [ ] Action Item Management
  - [ ] Add action item functionality
  - [ ] Assign responsible person
  - [ ] Mark action items as complete
  - [ ] Filter out completed action items from display
- [ ] Finish Retro Flow
  - [ ] Generate summary with all discussion topics
  - [ ] Include action items (completed and outstanding) in summary
  - [ ] Save summary to database
  - [ ] Delete discussion items after finish
  - [ ] Keep action items after finish
- [ ] Past Retros Viewer
  - [ ] Fetch and display past retrospectives
  - [ ] Show summary for each past retro
  - [ ] Display completion dates

## Phase 7: Testing & Refinement
- [ ] Test Slack app installation flow
- [ ] Test discussion item CRUD operations
- [ ] Test action item CRUD operations
- [ ] Test user permission validation
- [ ] Test finish retro flow
- [ ] Test past retros viewer
- [ ] Test error handling and edge cases
- [ ] Verify mobile/responsive layout in Slack

## Phase 8: Deployment
- [ ] Configure Vercel project
- [ ] Set up production environment variables
- [ ] Deploy to Vercel
- [ ] Configure Slack app URLs with production endpoints
- [ ] Test production deployment
- [ ] Document installation and usage instructions

## Future Enhancements (Post-MVP)
- [ ] Multi-team support per Slack installation
- [ ] Privacy controls and permissions
- [ ] Customizable column names/categories
- [ ] Export retros to external formats
- [ ] Reminder notifications for outstanding action items
