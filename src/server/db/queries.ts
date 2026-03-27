import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import type { ActionItem, DiscussionItem, Installation, Retrospective } from "./schema";
import {
	actionItems,
	discussionItems,
	installations,
	retrospectives,
	teamSettings,
} from "./schema";

function first<T>(rows: T[]): T {
	const row = rows[0];
	if (row === undefined) {
		throw new Error("Expected at least one row but got none");
	}
	return row;
}

// ── Installation queries ─────────────────────────────────────────────────────

export async function saveInstallation(
	teamId: string,
	accessToken: string,
	botUserId: string,
): Promise<Installation> {
	const rows = await db
		.insert(installations)
		.values({ teamId, accessToken, botUserId })
		.onConflictDoUpdate({
			target: installations.teamId,
			set: { accessToken, botUserId },
		})
		.returning();
	return first(rows);
}

export async function getInstallation(teamId: string): Promise<Installation | null> {
	const [result] = await db.select().from(installations).where(eq(installations.teamId, teamId));
	return result ?? null;
}

// ── Retrospective queries ────────────────────────────────────────────────────

export async function getActiveRetro(teamId: string): Promise<Retrospective | null> {
	const [result] = await db
		.select()
		.from(retrospectives)
		.where(and(eq(retrospectives.teamId, teamId), eq(retrospectives.status, "active")))
		.orderBy(desc(retrospectives.createdAt))
		.limit(1);
	return result ?? null;
}

export async function createRetro(teamId: string): Promise<Retrospective> {
	const rows = await db.insert(retrospectives).values({ teamId, status: "active" }).returning();
	return first(rows);
}

export async function getOrCreateActiveRetro(teamId: string): Promise<Retrospective> {
	const activeRetro = await getActiveRetro(teamId);
	if (activeRetro) {
		return activeRetro;
	}
	return createRetro(teamId);
}

export async function finishRetro(retroId: string, summary: string): Promise<Retrospective> {
	const rows = await db
		.update(retrospectives)
		.set({ status: "finished", finishedAt: sql`NOW()`, summary })
		.where(eq(retrospectives.id, retroId))
		.returning();
	return first(rows);
}

export async function getPastRetros(teamId: string): Promise<Retrospective[]> {
	return db
		.select()
		.from(retrospectives)
		.where(and(eq(retrospectives.teamId, teamId), eq(retrospectives.status, "finished")))
		.orderBy(desc(retrospectives.finishedAt))
		.limit(20);
}

// ── Discussion item queries ──────────────────────────────────────────────────

export async function getDiscussionItems(retroId: string): Promise<DiscussionItem[]> {
	return db
		.select()
		.from(discussionItems)
		.where(eq(discussionItems.retroId, retroId))
		.orderBy(asc(discussionItems.category), asc(discussionItems.createdAt));
}

export async function createDiscussionItem(
	retroId: string,
	userId: string,
	userName: string,
	category: "good" | "bad" | "question",
	content: string,
): Promise<DiscussionItem> {
	const rows = await db
		.insert(discussionItems)
		.values({ retroId, userId, userName, category, content })
		.returning();
	return first(rows);
}

export async function updateDiscussionItem(
	itemId: string,
	userId: string,
	content: string,
): Promise<DiscussionItem | null> {
	const [result] = await db
		.update(discussionItems)
		.set({ content })
		.where(and(eq(discussionItems.id, itemId), eq(discussionItems.userId, userId)))
		.returning();
	return result ?? null;
}

export async function deleteDiscussionItem(itemId: string, userId: string): Promise<boolean> {
	const result = await db
		.delete(discussionItems)
		.where(and(eq(discussionItems.id, itemId), eq(discussionItems.userId, userId)))
		.returning({ id: discussionItems.id });
	return result.length > 0;
}

export async function deleteAllDiscussionItems(retroId: string): Promise<void> {
	await db.delete(discussionItems).where(eq(discussionItems.retroId, retroId));
}

// ── Action item queries ──────────────────────────────────────────────────────

export async function getActionItems(retroId: string): Promise<ActionItem[]> {
	return db
		.select()
		.from(actionItems)
		.where(and(eq(actionItems.retroId, retroId), eq(actionItems.completed, false)))
		.orderBy(asc(actionItems.createdAt));
}

export async function getAllActionItems(retroId: string): Promise<ActionItem[]> {
	return db
		.select()
		.from(actionItems)
		.where(eq(actionItems.retroId, retroId))
		.orderBy(asc(actionItems.completed), asc(actionItems.createdAt));
}

export async function createActionItem(
	retroId: string,
	userId: string,
	responsibleUserId: string,
	responsibleUserName: string,
	content: string,
): Promise<ActionItem> {
	const rows = await db
		.insert(actionItems)
		.values({ retroId, userId, responsibleUserId, responsibleUserName, content })
		.returning();
	return first(rows);
}

export async function markActionItemComplete(itemId: string): Promise<ActionItem | null> {
	const [result] = await db
		.update(actionItems)
		.set({ completed: true, completedAt: sql`NOW()` })
		.where(eq(actionItems.id, itemId))
		.returning();
	return result ?? null;
}

export async function markActionItemIncomplete(itemId: string): Promise<ActionItem | null> {
	const [result] = await db
		.update(actionItems)
		.set({ completed: false, completedAt: null })
		.where(eq(actionItems.id, itemId))
		.returning();
	return result ?? null;
}

export async function migrateIncompleteActionItems(
	fromRetroId: string,
	toRetroId: string,
): Promise<void> {
	await db
		.update(actionItems)
		.set({ retroId: toRetroId })
		.where(and(eq(actionItems.retroId, fromRetroId), eq(actionItems.completed, false)));
}

// ── Team settings queries ────────────────────────────────────────────────────

export async function getTeamInstructions(teamId: string): Promise<string | null> {
	const [result] = await db
		.select({ retroInstructions: teamSettings.retroInstructions })
		.from(teamSettings)
		.where(eq(teamSettings.teamId, teamId));
	return result?.retroInstructions ?? null;
}

export async function saveTeamInstructions(teamId: string, instructions: string): Promise<void> {
	await db
		.insert(teamSettings)
		.values({ teamId, retroInstructions: instructions, updatedAt: sql`NOW()` })
		.onConflictDoUpdate({
			target: teamSettings.teamId,
			set: { retroInstructions: instructions, updatedAt: sql`NOW()` },
		});
}
