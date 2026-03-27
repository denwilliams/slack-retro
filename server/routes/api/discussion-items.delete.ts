import { defineHandler, getQuery, getRequestHeader } from "nitro/h3";
import { getSessionFromCookieHeader } from "@/server/auth";
import { deleteDiscussionItem } from "@/server/db/queries";
import { publishEvent } from "@/server/redis";

export default defineHandler(async (event) => {
	const session = getSessionFromCookieHeader(getRequestHeader(event, "cookie") ?? null);
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	try {
		const query = getQuery(event);
		const itemId = typeof query.itemId === "string" ? query.itemId : null;

		if (!itemId) {
			return new Response(JSON.stringify({ error: "Missing itemId parameter" }), { status: 400 });
		}

		await deleteDiscussionItem(itemId, session.userId);

		publishEvent(session.teamId, {
			type: "item:deleted",
			teamId: session.teamId,
			timestamp: Date.now(),
		});

		return { success: true };
	} catch (error) {
		console.error("Error deleting discussion item:", error);
		return new Response(JSON.stringify({ error: "Failed to delete discussion item" }), {
			status: 500,
		});
	}
});
