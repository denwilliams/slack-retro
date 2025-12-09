import { neon } from "@neondatabase/serverless";

// Use a placeholder during build time, will be validated at runtime
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:password@localhost/dbname";

export const sql = neon(DATABASE_URL);

function validateDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
}

export async function initDatabase() {
  validateDatabaseUrl();

  // Create installations table
  await sql`
    CREATE TABLE IF NOT EXISTS installations (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      team_id TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      bot_user_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Create retrospectives table
  await sql`
    CREATE TABLE IF NOT EXISTS retrospectives (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      team_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
      created_at TIMESTAMP DEFAULT NOW(),
      finished_at TIMESTAMP,
      summary TEXT,
      FOREIGN KEY (team_id) REFERENCES installations(team_id)
    )
  `;

  // Create discussion_items table
  await sql`
    CREATE TABLE IF NOT EXISTS discussion_items (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      retro_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('good', 'bad', 'question')),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (retro_id) REFERENCES retrospectives(id) ON DELETE CASCADE
    )
  `;

  // Create action_items table
  await sql`
    CREATE TABLE IF NOT EXISTS action_items (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      retro_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      responsible_user_id TEXT NOT NULL,
      responsible_user_name TEXT NOT NULL,
      content TEXT NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      FOREIGN KEY (retro_id) REFERENCES retrospectives(id) ON DELETE CASCADE
    )
  `;

  // Create indexes for better query performance
  await sql`CREATE INDEX IF NOT EXISTS idx_retrospectives_team_id ON retrospectives(team_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_retrospectives_status ON retrospectives(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_discussion_items_retro_id ON discussion_items(retro_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_action_items_retro_id ON action_items(retro_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_action_items_completed ON action_items(completed)`;

  console.log("Database initialized successfully");
}
