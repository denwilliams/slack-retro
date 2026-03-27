import { defineHandler, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookieHeader } from "@/server/auth";
import { updateDiscussionItem } from "@/server/db/queries";
import { publishEvent } from "@/server/redis";

export default defineHandler(async (event) => {
	const session = getSessionFromCookieHeader(getRequestHeader(event, "cookie") ?? null);
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	try {
		const body = await readBody<{ itemId?: string; content?: string }>(event);
		const { itemId, content } = body ?? {};

		if (!itemId || !content) {
			return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
		}

		await updateDiscussionItem(itemId, session.userId, content);

		publishEvent(session.teamId, {
			type: "item:edited",
			teamId: session.teamId,
			timestamp: Date.now(),
		});

		return { success: true };
	} catch (error) {
		console.error("Error updating discussion item:", error);
		return new Response(JSON.stringify({ error: "Failed to update discussion item" }), {
			status: 500,
		});
	}
});
