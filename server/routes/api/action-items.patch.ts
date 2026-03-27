import { defineHandler, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookieHeader } from "@/server/auth";
import { markActionItemComplete, markActionItemIncomplete } from "@/server/db/queries";
import { publishEvent } from "@/server/redis";

export default defineHandler(async (event) => {
	const session = getSessionFromCookieHeader(getRequestHeader(event, "cookie") ?? null);
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	try {
		const body = await readBody<{ itemId?: string; completed?: boolean }>(event);
		const { itemId, completed } = body ?? {};

		if (!itemId || typeof completed !== "boolean") {
			return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
		}

		if (completed) {
			await markActionItemComplete(itemId);
		} else {
			await markActionItemIncomplete(itemId);
		}

		publishEvent(session.teamId, {
			type: "action:toggled",
			teamId: session.teamId,
			timestamp: Date.now(),
		});

		return { success: true };
	} catch (error) {
		console.error("Error updating action item:", error);
		return new Response(JSON.stringify({ error: "Failed to update action item" }), {
			status: 500,
		});
	}
});
