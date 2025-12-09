import { WebClient } from "@slack/web-api";
import {
  getOrCreateActiveRetro,
  getDiscussionItems,
  getActionItems,
  createDiscussionItem,
  updateDiscussionItem,
  deleteDiscussionItem,
  createActionItem,
  markActionItemComplete,
  markActionItemIncomplete,
  finishRetro,
  deleteAllDiscussionItems,
  getPastRetros,
  getAllActionItems,
  createRetro,
  migrateIncompleteActionItems,
} from "./queries";
import {
  buildHomeView,
  buildAddDiscussionItemModal,
  buildEditDiscussionItemModal,
  buildAddActionItemModal,
  buildPastRetrosModal,
  generateRetroSummary,
} from "./slack-ui";

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
    console.log(`[refreshHomeView] Starting for userId=${userId}, teamId=${teamId}`);

    const retro = await getOrCreateActiveRetro(teamId);
    console.log(`[refreshHomeView] Got retro:`, retro);

    const discussionItems = await getDiscussionItems(retro.id);
    console.log(`[refreshHomeView] Got ${discussionItems.length} discussion items`);

    const actionItems = await getActionItems(retro.id);
    console.log(`[refreshHomeView] Got ${actionItems.length} action items`);

    const view = buildHomeView(discussionItems, actionItems, userId);
    console.log(`[refreshHomeView] Built view with ${view.blocks.length} blocks`);

    const result = await getSlackClient().views.publish({
      user_id: userId,
      view: view as any,
    });
    console.log(`[refreshHomeView] Successfully published view:`, result.ok);
  } catch (error) {
    console.error("[refreshHomeView] Error refreshing home view:", error);
    if (error instanceof Error) {
      console.error("[refreshHomeView] Error message:", error.message);
      console.error("[refreshHomeView] Error stack:", error.stack);
    }
  }
}

export async function processSlackEvent(payload: any) {
  try {
    console.log("[processSlackEvent] Received event:", payload.type);

    // Handle different event types
    if (payload.type === "event_callback") {
      const event = payload.event;
      console.log("[processSlackEvent] Event callback type:", event.type);

      // Handle app_home_opened event
      if (event.type === "app_home_opened") {
        const userId = event.user;
        const teamId = payload.team_id;
        console.log(`[processSlackEvent] app_home_opened for userId=${userId}, teamId=${teamId}`);
        await refreshHomeView(userId, teamId);
      }
    }

    // Handle interactivity (button clicks, modal submissions, etc.)
    if (payload.type === "block_actions") {
      const action = payload.actions[0];
      const userId = payload.user.id;
      const teamId = payload.team?.id || payload.user.team_id;

      // Handle "Add Discussion Item" button
      if (action.action_id === "add_discussion_item") {
        await getSlackClient().views.open({
          trigger_id: payload.trigger_id,
          view: buildAddDiscussionItemModal() as any,
        });
      }

      // Handle "Add Action Item" button
      else if (action.action_id === "add_action_item") {
        await getSlackClient().views.open({
          trigger_id: payload.trigger_id,
          view: buildAddActionItemModal([]) as any,
        });
      }

      // Handle "Refresh" button
      else if (action.action_id === "refresh_home") {
        await refreshHomeView(userId, teamId);
      }

      // Handle "View Past Retros" button
      else if (action.action_id === "view_past_retros") {
        const retros = await getPastRetros(teamId);
        await getSlackClient().views.open({
          trigger_id: payload.trigger_id,
          view: buildPastRetrosModal(retros) as any,
        });
      }

      // Handle "Finish Retro" button
      else if (action.action_id === "finish_retro") {
        const retro = await getOrCreateActiveRetro(teamId);
        const discussionItems = await getDiscussionItems(retro.id);
        const actionItems = await getAllActionItems(retro.id);

        const summary = generateRetroSummary(discussionItems, actionItems);

        // Finish the current retro and clean up discussion items
        await finishRetro(retro.id, summary);
        await deleteAllDiscussionItems(retro.id);

        // Create a new retro and migrate incomplete action items
        const newRetro = await createRetro(teamId);
        await migrateIncompleteActionItems(retro.id, newRetro.id);

        await refreshHomeView(userId, teamId);
      }

      // Handle discussion item overflow menu actions
      else if (action.action_id.startsWith("discussion_overflow_")) {
        const selectedOption = action.selected_option?.value;
        if (!selectedOption) return;

        if (selectedOption.startsWith("edit_discussion_")) {
          const itemId = selectedOption.replace("edit_discussion_", "");
          const retro = await getOrCreateActiveRetro(teamId);
          const items = await getDiscussionItems(retro.id);
          const item = items.find((i) => i.id === itemId);

          if (item && item.user_id === userId) {
            await getSlackClient().views.open({
              trigger_id: payload.trigger_id,
              view: buildEditDiscussionItemModal(item) as any,
            });
          }
        } else if (selectedOption.startsWith("delete_discussion_")) {
          const itemId = selectedOption.replace("delete_discussion_", "");
          await deleteDiscussionItem(itemId, userId);
          await refreshHomeView(userId, teamId);
        }
      }

      // Handle action item toggle
      else if (action.action_id.startsWith("toggle_action_")) {
        const itemId = action.value;

        const retro = await getOrCreateActiveRetro(teamId);
        const actionItems = await getAllActionItems(retro.id);
        const item = actionItems.find((i) => i.id === itemId);

        if (item) {
          if (item.completed) {
            await markActionItemIncomplete(itemId);
          } else {
            await markActionItemComplete(itemId);
          }
          await refreshHomeView(userId, teamId);
        }
      }
    }

    // Handle view submissions (modals)
    if (payload.type === "view_submission") {
      const view = payload.view;
      const userId = payload.user.id;
      const teamId = payload.team?.id || payload.user.team_id;
      const userName = payload.user.name || payload.user.username;

      // Handle add discussion item modal submission
      if (view.callback_id === "add_discussion_item_modal") {
        const category = view.state.values.category_block.category_input
          .selected_option?.value as "good" | "bad" | "question";
        const content = view.state.values.content_block.content_input.value;

        if (content && category) {
          const retro = await getOrCreateActiveRetro(teamId);
          await createDiscussionItem(retro.id, userId, userName, category, content);
          await refreshHomeView(userId, teamId);
        }
      }

      // Handle edit discussion item modal submission
      else if (view.callback_id === "edit_discussion_item_modal") {
        const itemId = view.private_metadata;
        const content = view.state.values.content_block.content_input.value;

        if (content && itemId) {
          await updateDiscussionItem(itemId, userId, content);
          await refreshHomeView(userId, teamId);
        }
      }

      // Handle add action item modal submission
      else if (view.callback_id === "add_action_item_modal") {
        const responsibleUserId =
          view.state.values.responsible_block.responsible_input.selected_user;
        const content = view.state.values.content_block.content_input.value;

        if (content && responsibleUserId) {
          // Get the user's name
          const userInfo = await getSlackClient().users.info({ user: responsibleUserId });
          const responsibleUserName =
            userInfo.user?.real_name || userInfo.user?.name || "Unknown";

          const retro = await getOrCreateActiveRetro(teamId);
          await createActionItem(
            retro.id,
            userId,
            responsibleUserId,
            responsibleUserName,
            content
          );

          await refreshHomeView(userId, teamId);
        }
      }
    }
  } catch (error) {
    console.error("Error processing Slack event:", error);
  }
}
