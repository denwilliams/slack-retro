import { defineHandler, getRequestHeader } from "nitro/h3";
import { getSessionFromCookieHeader } from "@/server/auth";
import { getActionItems, getDiscussionItems, getOrCreateActiveRetro } from "@/server/db/queries";

export default defineHandler(async (event) => {
	const session = getSessionFromCookieHeader(getRequestHeader(event, "cookie") ?? null);
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
	}

	try {
		const retro = await getOrCreateActiveRetro(session.teamId);
		const [discussionItemsList, actionItemsList] = await Promise.all([
			getDiscussionItems(retro.id),
			getActionItems(retro.id),
		]);

		return {
			retro,
			discussionItems: discussionItemsList,
			actionItems: actionItemsList,
			user: {
				userId: session.userId,
				userName: session.userName,
			},
		};
	} catch (error) {
		console.error("Error fetching retro data:", error);
		return new Response(JSON.stringify({ error: "Failed to fetch retro data" }), { status: 500 });
	}
});
