import { defineHandler, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookieHeader } from "@/server/auth";
import { createDiscussionItem, getOrCreateActiveRetro } from "@/server/db/queries";
import { publishEvent } from "@/server/redis";

const VALID_CATEGORIES = new Set(["good", "bad", "question"]);

export default defineHandler(async (event) => {
	const session = getSessionFromCookieHeader(getRequestHeader(event, "cookie") ?? null);
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	try {
		const body = await readBody<{ category?: string; content?: string }>(event);
		const { category, content } = body ?? {};

		if (!category || !content) {
			return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
		}

		if (!VALID_CATEGORIES.has(category)) {
			return new Response(JSON.stringify({ error: "Invalid category" }), { status: 400 });
		}

		const retro = await getOrCreateActiveRetro(session.teamId);
		const item = await createDiscussionItem(
			retro.id,
			session.userId,
			session.userName,
			category as "good" | "bad" | "question",
			content,
		);

		publishEvent(session.teamId, {
			type: "item:added",
			teamId: session.teamId,
			timestamp: Date.now(),
		});

		return { item };
	} catch (error) {
		console.error("Error creating discussion item:", error);
		return new Response(JSON.stringify({ error: "Failed to create discussion item" }), {
			status: 500,
		});
	}
});
