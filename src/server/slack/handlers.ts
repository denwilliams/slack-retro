import { WebClient } from "@slack/web-api";
import { generateAuthToken } from "@/server/auth";
import {
	createActionItem,
	createDiscussionItem,
	createRetro,
	deleteAllDiscussionItems,
	deleteDiscussionItem,
	finishRetro,
	getActionItems,
	getAllActionItems,
	getDiscussionItems,
	getOrCreateActiveRetro,
	getPastRetros,
	getTeamInstructions,
	markActionItemComplete,
	markActionItemIncomplete,
	migrateIncompleteActionItems,
	saveTeamInstructions,
	updateDiscussionItem,
} from "@/server/db/queries";
import { publishEvent } from "@/server/redis";
import {
	buildAddActionItemModal,
	buildAddDiscussionItemModal,
	buildEditDiscussionItemModal,
	buildEditInstructionsModal,
	buildHomeView,
	buildOpenInBrowserModal,
	buildPastRetrosModal,
	buildViewInstructionsModal,
	generateRetroSummary,
} from "./ui";

function getClient() {
	if (!process.env.SLACK_BOT_TOKEN) {
		throw new Error("SLACK_BOT_TOKEN environment variable is not set");
	}
	return new WebClient(process.env.SLACK_BOT_TOKEN);
}

let client: WebClient | null = null;

function getSlackClient() {
	if (!client) {
		client = getClient();
	}
	return client;
}

async function refreshHomeView(userId: string, teamId: string) {
	try {
		const retro = await getOrCreateActiveRetro(teamId);
		const discussionItems = await getDiscussionItems(retro.id);
		const actionItems = await getActionItems(retro.id);
		const view = buildHomeView(discussionItems, actionItems, userId);

		// biome-ignore lint/suspicious/noExplicitAny: Slack API types require flexible typing
		await getSlackClient().views.publish({ user_id: userId, view: view as any });
	} catch (error) {
		console.error("[refreshHomeView] Error refreshing home view:", error);
	}
}

// biome-ignore lint/suspicious/noExplicitAny: Slack payloads are untyped
async function handleEventCallback(payload: any) {
	const event = payload.event;
	if (event.type === "app_home_opened") {
		const userId = event.user;
		const teamId = payload.team_id;
		await refreshHomeView(userId, teamId);
	}
}

// biome-ignore lint/suspicious/noExplicitAny: Slack payloads are untyped
async function handleMessageAction(payload: any) {
	if (payload.callback_id !== "add_message_to_retro") return;

	const messageText = payload.message.text;
	const messageUser = payload.message.user;
	const messageLink = payload.message_link;

	let initialContent = messageText;
	if (messageUser && messageLink) {
		initialContent = `From <@${messageUser}>: ${messageText}\n\n${messageLink}`;
	} else if (messageUser) {
		initialContent = `From <@${messageUser}>: ${messageText}`;
	}

	await getSlackClient().views.open({
		trigger_id: payload.trigger_id,
		// biome-ignore lint/suspicious/noExplicitAny: Slack API types require flexible typing
		view: buildAddDiscussionItemModal(initialContent) as any,
	});
}

// biome-ignore lint/suspicious/noExplicitAny: Slack payloads are untyped
async function handleOpenInBrowser(payload: any, userId: string, teamId: string) {
	const userName = payload.user.name || payload.user.username || "Unknown";
	const token = generateAuthToken(userId, userName, teamId);

	const baseUrl =
		process.env.BASE_URL ||
		(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
		"http://localhost:3000";
	const authUrl = `${baseUrl}/api/auth/browser?token=${token}`;

	await getSlackClient().views.open({
		trigger_id: payload.trigger_id,
		// biome-ignore lint/suspicious/noExplicitAny: Slack API types require flexible typing
		view: buildOpenInBrowserModal(authUrl) as any,
	});
}

// biome-ignore lint/suspicious/noExplicitAny: Slack payloads are untyped
async function handleDiscussionOverflow(payload: any, userId: string, teamId: string) {
	const action = payload.actions[0];
	const selectedOption = action.selected_option?.value;
	if (!selectedOption) return;

	if (selectedOption.startsWith("edit_discussion_")) {
		const itemId = selectedOption.replace("edit_discussion_", "");
		const retro = await getOrCreateActiveRetro(teamId);
		const items = await getDiscussionItems(retro.id);
		const item = items.find((i) => i.id === itemId);

		if (item && item.userId === userId) {
			await getSlackClient().views.open({
				trigger_id: payload.trigger_id,
				// biome-ignore lint/suspicious/noExplicitAny: Slack API types require flexible typing
				view: buildEditDiscussionItemModal(item) as any,
			});
		}
	} else if (selectedOption.startsWith("delete_discussion_")) {
		const itemId = selectedOption.replace("delete_discussion_", "");
		await deleteDiscussionItem(itemId, userId);
		publishEvent(teamId, { type: "item:deleted", teamId, timestamp: Date.now() });
		await refreshHomeView(userId, teamId);
	}
}

// biome-ignore lint/suspicious/noExplicitAny: Slack payloads are untyped
async function handleToggleAction(payload: any, userId: string, teamId: string) {
	const action = payload.actions[0];
	const itemId = action.value;

	const retro = await getOrCreateActiveRetro(teamId);
	const allActionItems = await getAllActionItems(retro.id);
	const item = allActionItems.find((i) => i.id === itemId);

	if (item) {
		if (item.completed) {
			await markActionItemIncomplete(itemId);
		} else {
			await markActionItemComplete(itemId);
		}
		publishEvent(teamId, { type: "action:toggled", teamId, timestamp: Date.now() });
		await refreshHomeView(userId, teamId);
	}
}

async function handleFinishRetro(userId: string, teamId: string) {
	const retro = await getOrCreateActiveRetro(teamId);
	const discussionItems = await getDiscussionItems(retro.id);
	const allActionItems = await getAllActionItems(retro.id);

	const summary = generateRetroSummary(discussionItems, allActionItems);

	await finishRetro(retro.id, summary);
	await deleteAllDiscussionItems(retro.id);

	const newRetro = await createRetro(teamId);
	await migrateIncompleteActionItems(retro.id, newRetro.id);
	publishEvent(teamId, { type: "retro:finished", teamId, timestamp: Date.now() });
	await refreshHomeView(userId, teamId);
}

// biome-ignore lint/suspicious/noExplicitAny: Slack payloads are untyped
async function handleBlockActions(payload: any) {
	const action = payload.actions[0];
	const userId: string = payload.user.id;
	const teamId: string = payload.team?.id || payload.user.team_id;
	const actionId: string = action.action_id;

	if (actionId === "open_in_browser") {
		await handleOpenInBrowser(payload, userId, teamId);
	} else if (actionId === "add_discussion_item") {
		await getSlackClient().views.open({
			trigger_id: payload.trigger_id,
			// biome-ignore lint/suspicious/noExplicitAny: Slack API types require flexible typing
			view: buildAddDiscussionItemModal() as any,
		});
	} else if (actionId === "add_action_item") {
		await getSlackClient().views.open({
			trigger_id: payload.trigger_id,
			// biome-ignore lint/suspicious/noExplicitAny: Slack API types require flexible typing
			view: buildAddActionItemModal([]) as any,
		});
	} else if (actionId === "refresh_home") {
		await refreshHomeView(userId, teamId);
	} else if (actionId === "view_past_retros") {
		const retros = await getPastRetros(teamId);
		await getSlackClient().views.open({
			trigger_id: payload.trigger_id,
			// biome-ignore lint/suspicious/noExplicitAny: Slack API types require flexible typing
			view: buildPastRetrosModal(retros) as any,
		});
	} else if (actionId === "edit_instructions") {
		const instructions = await getTeamInstructions(teamId);
		await getSlackClient().views.open({
			trigger_id: payload.trigger_id,
			// biome-ignore lint/suspicious/noExplicitAny: Slack API types require flexible typing
			view: buildEditInstructionsModal(instructions || undefined) as any,
		});
	} else if (actionId === "view_instructions") {
		const instructions = await getTeamInstructions(teamId);
		await getSlackClient().views.open({
			trigger_id: payload.trigger_id,
			// biome-ignore lint/suspicious/noExplicitAny: Slack API types require flexible typing
			view: buildViewInstructionsModal(instructions || undefined) as any,
		});
	} else if (actionId === "finish_retro") {
		await handleFinishRetro(userId, teamId);
	} else if (actionId.startsWith("discussion_overflow_")) {
		await handleDiscussionOverflow(payload, userId, teamId);
	} else if (actionId.startsWith("toggle_action_")) {
		await handleToggleAction(payload, userId, teamId);
	}
}

// biome-ignore lint/suspicious/noExplicitAny: Slack payloads are untyped
async function handleViewSubmission(payload: any) {
	const view = payload.view;
	const userId: string = payload.user.id;
	const teamId: string = payload.team?.id || payload.user.team_id;
	const userName: string = payload.user.name || payload.user.username;
	const callbackId: string = view.callback_id;

	if (callbackId === "add_discussion_item_modal") {
		await handleAddDiscussionSubmission(view, userId, userName, teamId);
	} else if (callbackId === "edit_discussion_item_modal") {
		await handleEditDiscussionSubmission(view, userId, teamId);
	} else if (callbackId === "add_action_item_modal") {
		await handleAddActionItemSubmission(view, userId, teamId);
	} else if (callbackId === "edit_instructions_modal") {
		await handleEditInstructionsSubmission(view, userId, teamId);
	}
}

async function handleAddDiscussionSubmission(
	// biome-ignore lint/suspicious/noExplicitAny: Slack view payloads are untyped
	view: any,
	userId: string,
	userName: string,
	teamId: string,
) {
	const category = view.state.values.category_block.category_input.selected_option?.value as
		| "good"
		| "bad"
		| "question"
		| undefined;
	const content = view.state.values.content_block.content_input.value;

	if (content && category) {
		const retro = await getOrCreateActiveRetro(teamId);
		await createDiscussionItem(retro.id, userId, userName, category, content);
		publishEvent(teamId, { type: "item:added", teamId, timestamp: Date.now() });
		await refreshHomeView(userId, teamId);
	}
}

async function handleEditDiscussionSubmission(
	// biome-ignore lint/suspicious/noExplicitAny: Slack view payloads are untyped
	view: any,
	userId: string,
	teamId: string,
) {
	const itemId = view.private_metadata;
	const content = view.state.values.content_block.content_input.value;

	if (content && itemId) {
		await updateDiscussionItem(itemId, userId, content);
		publishEvent(teamId, { type: "item:edited", teamId, timestamp: Date.now() });
		await refreshHomeView(userId, teamId);
	}
}

async function handleAddActionItemSubmission(
	// biome-ignore lint/suspicious/noExplicitAny: Slack view payloads are untyped
	view: any,
	userId: string,
	teamId: string,
) {
	const responsibleUserId = view.state.values.responsible_block.responsible_input.selected_user;
	const content = view.state.values.content_block.content_input.value;

	if (content && responsibleUserId) {
		const userInfo = await getSlackClient().users.info({ user: responsibleUserId });
		const responsibleUserName = userInfo.user?.real_name || userInfo.user?.name || "Unknown";

		const retro = await getOrCreateActiveRetro(teamId);
		await createActionItem(retro.id, userId, responsibleUserId, responsibleUserName, content);
		publishEvent(teamId, { type: "action:added", teamId, timestamp: Date.now() });
		await refreshHomeView(userId, teamId);
	}
}

async function handleEditInstructionsSubmission(
	// biome-ignore lint/suspicious/noExplicitAny: Slack view payloads are untyped
	view: any,
	userId: string,
	teamId: string,
) {
	const instructions = view.state.values.instructions_block.instructions_input.value;

	if (instructions !== null && instructions !== undefined) {
		await saveTeamInstructions(teamId, instructions);
		publishEvent(teamId, { type: "instructions:updated", teamId, timestamp: Date.now() });
		await refreshHomeView(userId, teamId);
	}
}

// biome-ignore lint/suspicious/noExplicitAny: Slack payloads are untyped
export async function processSlackEvent(payload: any) {
	try {
		if (payload.type === "event_callback") {
			await handleEventCallback(payload);
		}

		if (payload.type === "message_action") {
			await handleMessageAction(payload);
		}

		if (payload.type === "block_actions") {
			await handleBlockActions(payload);
		}

		if (payload.type === "view_submission") {
			await handleViewSubmission(payload);
		}
	} catch (error) {
		console.error("Error processing Slack event:", error);
	}
}
