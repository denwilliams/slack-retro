import { sql } from "drizzle-orm";
import { defineHandler } from "nitro/h3";
import { db } from "@/server/db";

export default defineHandler(async () => {
	try {
		await db.execute(sql`SELECT 1`);
		return { success: true, message: "Database connection verified" };
	} catch (error) {
		console.error("Error verifying database connection:", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Failed to connect to database",
				details: error instanceof Error ? error.message : String(error),
			}),
			{ status: 500 },
		);
	}
});
