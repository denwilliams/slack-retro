import { sql } from "./db";
import type {
  Retrospective,
  DiscussionItem,
  ActionItem,
  Installation,
} from "@/types";

// Installation queries
export async function saveInstallation(
  teamId: string,
  accessToken: string,
  botUserId: string
): Promise<Installation> {
  const result = await sql`
    INSERT INTO installations (team_id, access_token, bot_user_id)
    VALUES (${teamId}, ${accessToken}, ${botUserId})
    ON CONFLICT (team_id)
    DO UPDATE SET access_token = ${accessToken}, bot_user_id = ${botUserId}
    RETURNING *
  `;
  return result[0] as Installation;
}

export async function getInstallation(
  teamId: string
): Promise<Installation | null> {
  const result = await sql`
    SELECT * FROM installations WHERE team_id = ${teamId}
  `;
  return result[0] as Installation | null;
}

// Retrospective queries
export async function getActiveRetro(
  teamId: string
): Promise<Retrospective | null> {
  try {
    console.log(`[getActiveRetro] Querying for team ${teamId}`);
    console.log(`[getActiveRetro] DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    const result = await sql`
      SELECT * FROM retrospectives
      WHERE team_id = ${teamId} AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    console.log(`[getActiveRetro] Query returned ${result.length} results`);
    return result[0] as Retrospective | null;
  } catch (error) {
    console.error(`[getActiveRetro] Database query error:`, error);
    if (error instanceof Error) {
      console.error(`[getActiveRetro] Error name: ${error.name}`);
      console.error(`[getActiveRetro] Error message: ${error.message}`);
    }
    throw error;
  }
}

export async function createRetro(teamId: string): Promise<Retrospective> {
  try {
    console.log(`[createRetro] Creating new retro for team ${teamId}`);
    const result = await sql`
      INSERT INTO retrospectives (team_id, status)
      VALUES (${teamId}, 'active')
      RETURNING *
    `;
    console.log(`[createRetro] Successfully created retro:`, result[0]);
    return result[0] as Retrospective;
  } catch (error) {
    console.error(`[createRetro] Database insert error:`, error);
    throw error;
  }
}

export async function getOrCreateActiveRetro(
  teamId: string
): Promise<Retrospective> {
  try {
    console.log(`[getOrCreateActiveRetro] Looking for active retro for team ${teamId}`);
    const activeRetro = await getActiveRetro(teamId);
    if (activeRetro) {
      console.log(`[getOrCreateActiveRetro] Found existing retro:`, activeRetro.id);
      return activeRetro;
    }
    console.log(`[getOrCreateActiveRetro] No active retro found, creating new one`);
    const newRetro = await createRetro(teamId);
    console.log(`[getOrCreateActiveRetro] Created new retro:`, newRetro.id);
    return newRetro;
  } catch (error) {
    console.error(`[getOrCreateActiveRetro] Error:`, error);
    throw error;
  }
}

export async function finishRetro(
  retroId: string,
  summary: string
): Promise<Retrospective> {
  const result = await sql`
    UPDATE retrospectives
    SET status = 'finished', finished_at = NOW(), summary = ${summary}
    WHERE id = ${retroId}
    RETURNING *
  `;
  return result[0] as Retrospective;
}

export async function getPastRetros(teamId: string): Promise<Retrospective[]> {
  const result = await sql`
    SELECT * FROM retrospectives
    WHERE team_id = ${teamId} AND status = 'finished'
    ORDER BY finished_at DESC
    LIMIT 20
  `;
  return result as Retrospective[];
}

// Discussion item queries
export async function getDiscussionItems(
  retroId: string
): Promise<DiscussionItem[]> {
  const result = await sql`
    SELECT * FROM discussion_items
    WHERE retro_id = ${retroId}
    ORDER BY category, created_at ASC
  `;
  return result as DiscussionItem[];
}

export async function createDiscussionItem(
  retroId: string,
  userId: string,
  userName: string,
  category: "good" | "bad" | "question",
  content: string
): Promise<DiscussionItem> {
  const result = await sql`
    INSERT INTO discussion_items (retro_id, user_id, user_name, category, content)
    VALUES (${retroId}, ${userId}, ${userName}, ${category}, ${content})
    RETURNING *
  `;
  return result[0] as DiscussionItem;
}

export async function updateDiscussionItem(
  itemId: string,
  userId: string,
  content: string
): Promise<DiscussionItem | null> {
  const result = await sql`
    UPDATE discussion_items
    SET content = ${content}
    WHERE id = ${itemId} AND user_id = ${userId}
    RETURNING *
  `;
  return result[0] as DiscussionItem | null;
}

export async function deleteDiscussionItem(
  itemId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    DELETE FROM discussion_items
    WHERE id = ${itemId} AND user_id = ${userId}
    RETURNING id
  `;
  return result.length > 0;
}

export async function deleteAllDiscussionItems(retroId: string): Promise<void> {
  await sql`
    DELETE FROM discussion_items WHERE retro_id = ${retroId}
  `;
}

// Action item queries
export async function getActionItems(retroId: string): Promise<ActionItem[]> {
  const result = await sql`
    SELECT * FROM action_items
    WHERE retro_id = ${retroId} AND completed = false
    ORDER BY created_at ASC
  `;
  return result as ActionItem[];
}

export async function getAllActionItems(retroId: string): Promise<ActionItem[]> {
  const result = await sql`
    SELECT * FROM action_items
    WHERE retro_id = ${retroId}
    ORDER BY completed ASC, created_at ASC
  `;
  return result as ActionItem[];
}

export async function createActionItem(
  retroId: string,
  userId: string,
  responsibleUserId: string,
  responsibleUserName: string,
  content: string
): Promise<ActionItem> {
  const result = await sql`
    INSERT INTO action_items (retro_id, user_id, responsible_user_id, responsible_user_name, content)
    VALUES (${retroId}, ${userId}, ${responsibleUserId}, ${responsibleUserName}, ${content})
    RETURNING *
  `;
  return result[0] as ActionItem;
}

export async function markActionItemComplete(
  itemId: string
): Promise<ActionItem | null> {
  const result = await sql`
    UPDATE action_items
    SET completed = true, completed_at = NOW()
    WHERE id = ${itemId}
    RETURNING *
  `;
  return result[0] as ActionItem | null;
}

export async function markActionItemIncomplete(
  itemId: string
): Promise<ActionItem | null> {
  const result = await sql`
    UPDATE action_items
    SET completed = false, completed_at = NULL
    WHERE id = ${itemId}
    RETURNING *
  `;
  return result[0] as ActionItem | null;
}
