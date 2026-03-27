import { defineHandler, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookieHeader } from "@/server/auth";
import { createActionItem, getOrCreateActiveRetro } from "@/server/db/queries";
import { publishEvent } from "@/server/redis";

export default defineHandler(async (event) => {
	const session = getSessionFromCookieHeader(getRequestHeader(event, "cookie") ?? null);
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	try {
		const body = await readBody<{
			content?: string;
			responsibleUserId?: string;
			responsibleUserName?: string;
		}>(event);
		const { content, responsibleUserId, responsibleUserName } = body ?? {};

		if (!content || !responsibleUserId || !responsibleUserName) {
			return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
		}

		const retro = await getOrCreateActiveRetro(session.teamId);
		const item = await createActionItem(
			retro.id,
			session.userId,
			responsibleUserId,
			responsibleUserName,
			content,
		);

		publishEvent(session.teamId, {
			type: "action:added",
			teamId: session.teamId,
			timestamp: Date.now(),
		});

		return { item };
	} catch (error) {
		console.error("Error creating action item:", error);
		return new Response(JSON.stringify({ error: "Failed to create action item" }), {
			status: 500,
		});
	}
});
