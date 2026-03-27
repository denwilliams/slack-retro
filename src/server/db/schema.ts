import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ── Installations ────────────────────────────────────────────────────────────

export const installations = pgTable("installations", {
	id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
	teamId: text("team_id").notNull().unique(),
	accessToken: text("access_token").notNull(),
	botUserId: text("bot_user_id").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
});

// ── Retrospectives ───────────────────────────────────────────────────────────

export const retrospectives = pgTable(
	"retrospectives",
	{
		id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
		teamId: text("team_id").notNull(),
		status: text("status", { enum: ["active", "finished"] })
			.notNull()
			.default("active"),
		createdAt: timestamp("created_at").defaultNow(),
		finishedAt: timestamp("finished_at"),
		summary: text("summary"),
	},
	(table) => [
		index("idx_retrospectives_team_id").on(table.teamId),
		index("idx_retrospectives_status").on(table.status),
	],
);

// ── Discussion Items ─────────────────────────────────────────────────────────

export const discussionItems = pgTable(
	"discussion_items",
	{
		id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
		retroId: text("retro_id")
			.notNull()
			.references(() => retrospectives.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(),
		userName: text("user_name").notNull(),
		category: text("category", { enum: ["good", "bad", "question"] }).notNull(),
		content: text("content").notNull(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => [index("idx_discussion_items_retro_id").on(table.retroId)],
);

// ── Action Items ─────────────────────────────────────────────────────────────

export const actionItems = pgTable(
	"action_items",
	{
		id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
		retroId: text("retro_id")
			.notNull()
			.references(() => retrospectives.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(),
		responsibleUserId: text("responsible_user_id").notNull(),
		responsibleUserName: text("responsible_user_name").notNull(),
		content: text("content").notNull(),
		completed: boolean("completed").default(false),
		createdAt: timestamp("created_at").defaultNow(),
		completedAt: timestamp("completed_at"),
	},
	(table) => [
		index("idx_action_items_retro_id").on(table.retroId),
		index("idx_action_items_completed").on(table.completed),
	],
);

// ── Team Settings ────────────────────────────────────────────────────────────

export const teamSettings = pgTable("team_settings", {
	teamId: text("team_id").primaryKey(),
	retroInstructions: text("retro_instructions"),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Inferred Types ───────────────────────────────────────────────────────────

export type Installation = InferSelectModel<typeof installations>;
export type InsertInstallation = InferInsertModel<typeof installations>;

export type Retrospective = InferSelectModel<typeof retrospectives>;
export type InsertRetrospective = InferInsertModel<typeof retrospectives>;

export type DiscussionItem = InferSelectModel<typeof discussionItems>;
export type InsertDiscussionItem = InferInsertModel<typeof discussionItems>;

export type ActionItem = InferSelectModel<typeof actionItems>;
export type InsertActionItem = InferInsertModel<typeof actionItems>;

export type TeamSettings = InferSelectModel<typeof teamSettings>;
export type InsertTeamSettings = InferInsertModel<typeof teamSettings>;
