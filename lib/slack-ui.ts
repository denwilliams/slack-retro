import type { View } from "@slack/web-api";
import type { DiscussionItem, ActionItem, Retrospective } from "@/types";

const CATEGORY_EMOJI = {
  good: ":slightly_smiling_face:",
  bad: ":slightly_frowning_face:",
  question: ":question:",
} as const;

const CATEGORY_LABELS = {
  good: "What went well",
  bad: "What could be improved",
  question: "Questions / Discussion topics",
} as const;

export function buildHomeView(
  discussionItems: DiscussionItem[],
  actionItems: ActionItem[],
  userId: string
): View {
  const goodItems = discussionItems.filter((item) => item.category === "good");
  const badItems = discussionItems.filter((item) => item.category === "bad");
  const questionItems = discussionItems.filter(
    (item) => item.category === "question"
  );

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Team Retrospective",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Share your thoughts about how the team is doing. Add discussion items and action items below.",
      },
    },
    {
      type: "divider",
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "➕ Add Discussion Item",
            emoji: true,
          },
          action_id: "add_discussion_item",
          style: "primary",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "✅ Add Action Item",
            emoji: true,
          },
          action_id: "add_action_item",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔄 Refresh",
            emoji: true,
          },
          action_id: "refresh_home",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📋 Past Retros",
            emoji: true,
          },
          action_id: "view_past_retros",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🏁 Finish Retro",
            emoji: true,
          },
          action_id: "finish_retro",
          style: "danger",
          confirm: {
            title: {
              type: "plain_text",
              text: "Finish Retrospective",
            },
            text: {
              type: "mrkdwn",
              text: "Are you sure you want to finish this retro? This will save a summary and clear all discussion items.",
            },
            confirm: {
              type: "plain_text",
              text: "Finish",
            },
            deny: {
              type: "plain_text",
              text: "Cancel",
            },
          },
        },
      ],
    },
    {
      type: "divider",
    },
  ];

  // Add discussion items sections
  [
    { category: "good" as const, items: goodItems },
    { category: "bad" as const, items: badItems },
    { category: "question" as const, items: questionItems },
  ].forEach(({ category, items }) => {
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: `${CATEGORY_EMOJI[category]} ${CATEGORY_LABELS[category]}`,
        emoji: true,
      },
    });

    if (items.length === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "_No items yet_",
        },
      });
    } else {
      items.forEach((item) => {
        const isOwner = item.user_id === userId;
        const block: any = {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${item.user_name}:* ${item.content}`,
          },
        };

        if (isOwner) {
          block.accessory = {
            type: "overflow",
            options: [
              {
                text: {
                  type: "plain_text",
                  text: "Edit",
                  emoji: true,
                },
                value: `edit_discussion_${item.id}`,
              },
              {
                text: {
                  type: "plain_text",
                  text: "Delete",
                  emoji: true,
                },
                value: `delete_discussion_${item.id}`,
              },
            ],
            action_id: `discussion_overflow_${item.id}`,
          };
        }

        blocks.push(block);
      });
    }

    blocks.push({ type: "divider" });
  });

  // Add action items section
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "🎯 Action Items",
      emoji: true,
    },
  });

  if (actionItems.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No action items yet_",
      },
    });
  } else {
    actionItems.forEach((item) => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${item.responsible_user_name}:* ${item.content}`,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: item.completed ? "✓ Done" : "Mark Complete",
            emoji: true,
          },
          value: item.id,
          action_id: `toggle_action_${item.id}`,
          style: item.completed ? "primary" : undefined,
        },
      });
    });
  }

  return {
    type: "home" as const,
    blocks,
  };
}

export function buildAddDiscussionItemModal() {
  return {
    type: "modal" as const,
    callback_id: "add_discussion_item_modal",
    title: {
      type: "plain_text",
      text: "Add Discussion Item",
    },
    submit: {
      type: "plain_text",
      text: "Add",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks: [
      {
        type: "input",
        block_id: "category_block",
        element: {
          type: "radio_buttons",
          action_id: "category_input",
          options: [
            {
              text: {
                type: "plain_text",
                text: `:slightly_smiling_face: ${CATEGORY_LABELS.good}`,
                emoji: true,
              },
              value: "good",
            },
            {
              text: {
                type: "plain_text",
                text: `:slightly_frowning_face: ${CATEGORY_LABELS.bad}`,
                emoji: true,
              },
              value: "bad",
            },
            {
              text: {
                type: "plain_text",
                text: `:question: ${CATEGORY_LABELS.question}`,
                emoji: true,
              },
              value: "question",
            },
          ],
          initial_option: {
            text: {
              type: "plain_text",
              text: `:slightly_smiling_face: ${CATEGORY_LABELS.good}`,
              emoji: true,
            },
            value: "good",
          },
        },
        label: {
          type: "plain_text",
          text: "Category",
        },
      },
      {
        type: "input",
        block_id: "content_block",
        element: {
          type: "plain_text_input",
          action_id: "content_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What would you like to discuss?",
          },
        },
        label: {
          type: "plain_text",
          text: "Your thoughts",
        },
      },
    ],
  };
}

export function buildEditDiscussionItemModal(item: DiscussionItem) {
  return {
    type: "modal" as const,
    callback_id: "edit_discussion_item_modal",
    private_metadata: item.id,
    title: {
      type: "plain_text",
      text: "Edit Discussion Item",
    },
    submit: {
      type: "plain_text",
      text: "Save",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks: [
      {
        type: "input",
        block_id: "content_block",
        element: {
          type: "plain_text_input",
          action_id: "content_input",
          multiline: true,
          initial_value: item.content,
        },
        label: {
          type: "plain_text",
          text: "Your thoughts",
        },
      },
    ],
  };
}

export function buildAddActionItemModal(teamMembers: Array<{ id: string; name: string }>) {
  return {
    type: "modal" as const,
    callback_id: "add_action_item_modal",
    title: {
      type: "plain_text",
      text: "Add Action Item",
    },
    submit: {
      type: "plain_text",
      text: "Add",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks: [
      {
        type: "input",
        block_id: "responsible_block",
        element: {
          type: "users_select",
          action_id: "responsible_input",
          placeholder: {
            type: "plain_text",
            text: "Select a team member",
          },
        },
        label: {
          type: "plain_text",
          text: "Responsible person",
        },
      },
      {
        type: "input",
        block_id: "content_block",
        element: {
          type: "plain_text_input",
          action_id: "content_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What needs to be done?",
          },
        },
        label: {
          type: "plain_text",
          text: "Action item",
        },
      },
    ],
  };
}

export function buildPastRetrosModal(retros: Retrospective[]) {
  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Past Retrospectives*",
      },
    },
    {
      type: "divider",
    },
  ];

  if (retros.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No past retros yet_",
      },
    });
  } else {
    retros.forEach((retro) => {
      const date = retro.finished_at
        ? new Date(retro.finished_at).toLocaleDateString()
        : "Unknown";
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${date}*\n${retro.summary || "_No summary available_"}`,
        },
      });
      blocks.push({
        type: "divider",
      });
    });
  }

  return {
    type: "modal" as const,
    callback_id: "past_retros_modal",
    title: {
      type: "plain_text",
      text: "Past Retros",
    },
    close: {
      type: "plain_text",
      text: "Close",
    },
    blocks,
  };
}

export function generateRetroSummary(
  discussionItems: DiscussionItem[],
  actionItems: ActionItem[]
): string {
  const goodItems = discussionItems.filter((item) => item.category === "good");
  const badItems = discussionItems.filter((item) => item.category === "bad");
  const questionItems = discussionItems.filter(
    (item) => item.category === "question"
  );

  let summary = "*Retrospective Summary*\n\n";
  summary += `_Completed on ${new Date().toLocaleDateString()}_\n\n`;

  // Good items
  summary += `*${CATEGORY_EMOJI.good} What went well*\n\n`;
  if (goodItems.length === 0) {
    summary += "_No items_\n\n";
  } else {
    goodItems.forEach((item) => {
      summary += `• *${item.user_name}:* ${item.content}\n`;
    });
    summary += "\n";
  }

  // Bad items
  summary += `*${CATEGORY_EMOJI.bad} What could be improved*\n\n`;
  if (badItems.length === 0) {
    summary += "_No items_\n\n";
  } else {
    badItems.forEach((item) => {
      summary += `• *${item.user_name}:* ${item.content}\n`;
    });
    summary += "\n";
  }

  // Question items
  summary += `*${CATEGORY_EMOJI.question} Questions / Discussion topics*\n\n`;
  if (questionItems.length === 0) {
    summary += "_No items_\n\n";
  } else {
    questionItems.forEach((item) => {
      summary += `• *${item.user_name}:* ${item.content}\n`;
    });
    summary += "\n";
  }

  // Action items
  summary += `*🎯 Action Items*\n\n`;
  if (actionItems.length === 0) {
    summary += "_No action items_\n\n";
  } else {
    const completedItems = actionItems.filter((item) => item.completed);
    const outstandingItems = actionItems.filter((item) => !item.completed);

    if (outstandingItems.length > 0) {
      summary += "*Outstanding:*\n";
      outstandingItems.forEach((item) => {
        summary += `• ☐ *${item.responsible_user_name}:* ${item.content}\n`;
      });
      summary += "\n";
    }

    if (completedItems.length > 0) {
      summary += "*Completed:*\n";
      completedItems.forEach((item) => {
        summary += `• ☑ *${item.responsible_user_name}:* ${item.content}\n`;
      });
      summary += "\n";
    }
  }

  return summary;
}
