import { sql } from "drizzle-orm";
import { defineHandler } from "nitro/h3";
import { db } from "@/server/db";
import {
	actionItems,
	discussionItems,
	installations,
	retrospectives,
	teamSettings,
} from "@/server/db/schema";

interface TableStatus {
	exists: boolean;
	count?: number;
	error?: string;
}

async function checkTable(
	// biome-ignore lint/suspicious/noExplicitAny: drizzle table reference type is complex
	table: any,
): Promise<TableStatus> {
	try {
		const [result] = await db.select({ count: sql<number>`count(*)` }).from(table);
		return { exists: true, count: result?.count ?? 0 };
	} catch (error) {
		return {
			exists: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export default defineHandler(async () => {
	try {
		const tables: Record<string, TableStatus> = {};

		const checks = await Promise.all([
			checkTable(installations),
			checkTable(retrospectives),
			checkTable(discussionItems),
			checkTable(actionItems),
			checkTable(teamSettings),
		]);

		const tableNames = [
			"installations",
			"retrospectives",
			"discussion_items",
			"action_items",
			"team_settings",
		];

		for (let i = 0; i < tableNames.length; i++) {
			const name = tableNames[i];
			const check = checks[i];
			if (name && check) {
				tables[name] = check;
			}
		}

		const allExist = Object.values(tables).every((t) => t.exists);

		return {
			success: allExist,
			tables,
			message: allExist
				? "All tables exist"
				: "Some tables are missing - run POST /api/init-db to initialize",
		};
	} catch (error) {
		console.error("Error checking database health:", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Failed to check database",
				details: error instanceof Error ? error.message : String(error),
			}),
			{ status: 500 },
		);
	}
});
