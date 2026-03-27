import type { View } from "@slack/web-api";
import type { ActionItem, DiscussionItem, Retrospective } from "@/types";

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

type Category = keyof typeof CATEGORY_EMOJI;

// biome-ignore lint/suspicious/noExplicitAny: Slack Block Kit element type
type SlackElement = any;
// biome-ignore lint/suspicious/noExplicitAny: Slack Block Kit block type
type SlackBlock = any;

function makeBoldHeader(headerText: string): SlackBlock {
	return {
		type: "rich_text",
		elements: [
			{
				type: "rich_text_section",
				elements: [{ type: "text", text: headerText, style: { bold: true } }],
			},
		],
	};
}

function makeBulletList(items: SlackElement[]): SlackBlock {
	return {
		type: "rich_text",
		elements: [{ type: "rich_text_list", style: "bullet", elements: items }],
	};
}

function makeParagraph(elements: SlackElement[]): SlackBlock {
	return {
		type: "rich_text",
		elements: [{ type: "rich_text_section", elements }],
	};
}

function lineAt(lines: string[], idx: number): string {
	return lines[idx] ?? "";
}

function isListLine(line: string): boolean {
	return /^[-*\u2022] /.test(line);
}

function isHeaderLine(line: string): boolean {
	return /^#{1,3} /.test(line);
}

function isBlockStart(line: string): boolean {
	return isHeaderLine(line) || isListLine(line);
}

/**
 * Parses markdown text and converts it to Slack rich_text blocks.
 * Handles headers, paragraphs, lists, and links properly.
 * Slack's mrkdwn in section blocks has a bug with lists, so we use rich_text instead.
 */
function parseMarkdownToRichTextBlocks(text: string): SlackBlock[] {
	const blocks: SlackBlock[] = [];
	const lines = text.split("\n");
	let i = 0;

	while (i < lines.length) {
		const line = lineAt(lines, i);

		if (!line.trim()) {
			i++;
			continue;
		}

		if (isHeaderLine(line)) {
			const headerMatch = line.match(/^#{1,3} (.+)$/);
			if (headerMatch) {
				blocks.push(makeBoldHeader(headerMatch[1] ?? ""));
				i++;
				continue;
			}
		}

		if (isListLine(line)) {
			i = collectListItems(lines, i, blocks);
			continue;
		}

		i = collectParagraph(lines, i, line, blocks);
	}

	return blocks;
}

function collectListItems(lines: string[], startIdx: number, blocks: SlackBlock[]): number {
	let i = startIdx;
	const listItems: SlackElement[] = [];

	while (i < lines.length && isListLine(lineAt(lines, i))) {
		const itemText = lineAt(lines, i).replace(/^[-*\u2022] /, "");
		listItems.push({ type: "rich_text_section", elements: parseInlineMarkdown(itemText) });
		i++;
	}

	blocks.push(makeBulletList(listItems));
	return i;
}

function collectParagraph(
	lines: string[],
	startIdx: number,
	firstLine: string,
	blocks: SlackBlock[],
): number {
	let i = startIdx + 1;
	let paragraphText = firstLine;

	while (i < lines.length && lineAt(lines, i).trim() && !isBlockStart(lineAt(lines, i))) {
		paragraphText += `\n${lineAt(lines, i)}`;
		i++;
	}

	blocks.push(makeParagraph(parseInlineMarkdown(paragraphText)));
	return i;
}

/**
 * Converts a single regex match into a Slack rich_text element.
 */
function matchToElement(match: RegExpExecArray): SlackElement | null {
	// Link [text](url)
	if (match[1]) return { type: "link", url: match[3], text: match[2] };
	// Bold **text**
	if (match[4]) return { type: "text", text: match[5], style: { bold: true } };
	// Italic *text*
	if (match[6]) return { type: "text", text: match[7], style: { italic: true } };
	// Italic _text_
	if (match[8]) return { type: "text", text: match[9], style: { italic: true } };
	return null;
}

/**
 * Parses inline markdown (bold, italic, links) within text.
 */
function parseInlineMarkdown(text: string): SlackElement[] {
	const elements: SlackElement[] = [];
	const pattern = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)/g;
	let lastIndex = 0;

	for (const match of text.matchAll(pattern)) {
		if (match.index > lastIndex) {
			const beforeText = text.substring(lastIndex, match.index);
			if (beforeText) elements.push({ type: "text", text: beforeText });
		}

		const element = matchToElement(match as RegExpExecArray);
		if (element) elements.push(element);

		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < text.length) {
		const afterText = text.substring(lastIndex);
		if (afterText) elements.push({ type: "text", text: afterText });
	}

	if (elements.length === 0) {
		elements.push({ type: "text", text });
	}

	return elements;
}

function buildDiscussionCategoryBlocks(
	items: DiscussionItem[],
	category: Category,
	userId: string,
): SlackBlock[] {
	const blocks: SlackBlock[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: `${CATEGORY_EMOJI[category]} ${CATEGORY_LABELS[category]}`,
				emoji: true,
			},
		},
	];

	if (items.length === 0) {
		blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No items yet_" } });
	} else {
		for (const item of items) {
			blocks.push(buildDiscussionItemBlock(item, item.userId === userId));
		}
	}

	blocks.push({ type: "divider" });
	return blocks;
}

function buildDiscussionItemBlock(item: DiscussionItem, isOwner: boolean): SlackBlock {
	const block: SlackBlock = {
		type: "section",
		text: { type: "mrkdwn", text: `*${item.userName}:* ${item.content}` },
	};

	if (isOwner) {
		block.accessory = {
			type: "overflow",
			options: [
				{
					text: { type: "plain_text", text: "Edit", emoji: true },
					value: `edit_discussion_${item.id}`,
				},
				{
					text: { type: "plain_text", text: "Delete", emoji: true },
					value: `delete_discussion_${item.id}`,
				},
			],
			action_id: `discussion_overflow_${item.id}`,
		};
	}

	return block;
}

function buildActionItemBlocks(actionItems: ActionItem[]): SlackBlock[] {
	const blocks: SlackBlock[] = [
		{
			type: "header",
			text: { type: "plain_text", text: "\u{1F3AF} Action Items", emoji: true },
		},
	];

	if (actionItems.length === 0) {
		blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No action items yet_" } });
	} else {
		for (const item of actionItems) {
			blocks.push({
				type: "section",
				text: { type: "mrkdwn", text: `*${item.responsibleUserName}:* ${item.content}` },
				accessory: {
					type: "button",
					text: {
						type: "plain_text",
						text: item.completed ? "\u2713 Done" : "Mark Complete",
						emoji: true,
					},
					value: item.id,
					action_id: `toggle_action_${item.id}`,
					style: item.completed ? "primary" : undefined,
				},
			});
		}
	}

	return blocks;
}

export function buildHomeView(
	discussionItems: DiscussionItem[],
	actionItems: ActionItem[],
	userId: string,
): View {
	const goodItems = discussionItems.filter((item) => item.category === "good");
	const badItems = discussionItems.filter((item) => item.category === "bad");
	const questionItems = discussionItems.filter((item) => item.category === "question");

	const blocks: SlackBlock[] = [
		{
			type: "header",
			text: { type: "plain_text", text: "Team Retrospective", emoji: true },
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: { type: "plain_text", text: "\u{1F310} Open in Browser", emoji: true },
					action_id: "open_in_browser",
					style: "primary",
				},
				{
					type: "button",
					text: { type: "plain_text", text: "\u{1F4DD} Edit Instructions", emoji: true },
					action_id: "edit_instructions",
				},
				{
					type: "button",
					text: { type: "plain_text", text: "\u{1F441}\uFE0F View Instructions", emoji: true },
					action_id: "view_instructions",
				},
			],
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: "Share your thoughts about how the team is doing. Add discussion items and action items below.",
			},
		},
		{ type: "divider" },
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: { type: "plain_text", text: "\u2795 Add Discussion Item", emoji: true },
					action_id: "add_discussion_item",
					style: "primary",
				},
				{
					type: "button",
					text: { type: "plain_text", text: "\u2705 Add Action Item", emoji: true },
					action_id: "add_action_item",
				},
				{
					type: "button",
					text: { type: "plain_text", text: "\u{1F504} Refresh", emoji: true },
					action_id: "refresh_home",
				},
				{
					type: "button",
					text: { type: "plain_text", text: "\u{1F4CB} Past Retros", emoji: true },
					action_id: "view_past_retros",
				},
				{
					type: "button",
					text: { type: "plain_text", text: "\u{1F3C1} Finish Retro", emoji: true },
					action_id: "finish_retro",
					style: "danger",
					confirm: {
						title: { type: "plain_text", text: "Finish Retrospective" },
						text: {
							type: "mrkdwn",
							text: "Are you sure you want to finish this retro? This will save a summary and clear all discussion items.",
						},
						confirm: { type: "plain_text", text: "Finish" },
						deny: { type: "plain_text", text: "Cancel" },
					},
				},
			],
		},
		{ type: "divider" },
		...buildDiscussionCategoryBlocks(goodItems, "good", userId),
		...buildDiscussionCategoryBlocks(badItems, "bad", userId),
		...buildDiscussionCategoryBlocks(questionItems, "question", userId),
		...buildActionItemBlocks(actionItems),
	];

	return { type: "home" as const, blocks };
}

export function buildAddDiscussionItemModal(initialContent?: string) {
	// biome-ignore lint/suspicious/noExplicitAny: Slack Block Kit types are loosely typed
	const contentElement: any = {
		type: "plain_text_input",
		action_id: "content_input",
		multiline: true,
		placeholder: { type: "plain_text", text: "What would you like to discuss?" },
	};

	if (initialContent) {
		contentElement.initial_value = initialContent;
	}

	return {
		type: "modal" as const,
		callback_id: "add_discussion_item_modal",
		title: { type: "plain_text", text: "Add Discussion Item" },
		submit: { type: "plain_text", text: "Add" },
		close: { type: "plain_text", text: "Cancel" },
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
				label: { type: "plain_text", text: "Category" },
			},
			{
				type: "input",
				block_id: "content_block",
				element: contentElement,
				label: { type: "plain_text", text: "Your thoughts" },
			},
		],
	};
}

export function buildEditDiscussionItemModal(item: DiscussionItem) {
	return {
		type: "modal" as const,
		callback_id: "edit_discussion_item_modal",
		private_metadata: item.id,
		title: { type: "plain_text", text: "Edit Discussion Item" },
		submit: { type: "plain_text", text: "Save" },
		close: { type: "plain_text", text: "Cancel" },
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
				label: { type: "plain_text", text: "Your thoughts" },
			},
		],
	};
}

export function buildAddActionItemModal(_teamMembers: Array<{ id: string; name: string }>) {
	return {
		type: "modal" as const,
		callback_id: "add_action_item_modal",
		title: { type: "plain_text", text: "Add Action Item" },
		submit: { type: "plain_text", text: "Add" },
		close: { type: "plain_text", text: "Cancel" },
		blocks: [
			{
				type: "input",
				block_id: "responsible_block",
				element: {
					type: "users_select",
					action_id: "responsible_input",
					placeholder: { type: "plain_text", text: "Select a team member" },
				},
				label: { type: "plain_text", text: "Responsible person" },
			},
			{
				type: "input",
				block_id: "content_block",
				element: {
					type: "plain_text_input",
					action_id: "content_input",
					multiline: true,
					placeholder: { type: "plain_text", text: "What needs to be done?" },
				},
				label: { type: "plain_text", text: "Action item" },
			},
		],
	};
}

export function buildPastRetrosModal(retros: Retrospective[]) {
	const blocks: SlackBlock[] = [
		{ type: "section", text: { type: "mrkdwn", text: "*Past Retrospectives*" } },
		{ type: "divider" },
	];

	if (retros.length === 0) {
		blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No past retros yet_" } });
	} else {
		for (const retro of retros) {
			const date = retro.finishedAt ? new Date(retro.finishedAt).toLocaleDateString() : "Unknown";
			blocks.push({
				type: "section",
				text: { type: "mrkdwn", text: `*${date}*\n${retro.summary || "_No summary available_"}` },
			});
			blocks.push({ type: "divider" });
		}
	}

	return {
		type: "modal" as const,
		callback_id: "past_retros_modal",
		title: { type: "plain_text", text: "Past Retros" },
		close: { type: "plain_text", text: "Close" },
		blocks,
	};
}

function formatCategoryItems(items: DiscussionItem[], emoji: string, label: string): string {
	let section = `*${emoji} ${label}*\n\n`;
	if (items.length === 0) {
		section += "_No items_\n\n";
	} else {
		for (const item of items) {
			section += `\u2022 *${item.userName}:* ${item.content}\n`;
		}
		section += "\n";
	}
	return section;
}

function formatActionItems(actionItems: ActionItem[]): string {
	let section = "*\u{1F3AF} Action Items*\n\n";
	if (actionItems.length === 0) {
		return `${section}_No action items_\n\n`;
	}

	const completedItems = actionItems.filter((item) => item.completed);
	const outstandingItems = actionItems.filter((item) => !item.completed);

	if (outstandingItems.length > 0) {
		section += "*Outstanding:*\n";
		for (const item of outstandingItems) {
			section += `\u2022 \u2610 *${item.responsibleUserName}:* ${item.content}\n`;
		}
		section += "\n";
	}

	if (completedItems.length > 0) {
		section += "*Completed:*\n";
		for (const item of completedItems) {
			section += `\u2022 \u2611 *${item.responsibleUserName}:* ${item.content}\n`;
		}
		section += "\n";
	}

	return section;
}

export function generateRetroSummary(
	discussionItems: DiscussionItem[],
	actionItems: ActionItem[],
): string {
	const goodItems = discussionItems.filter((item) => item.category === "good");
	const badItems = discussionItems.filter((item) => item.category === "bad");
	const questionItems = discussionItems.filter((item) => item.category === "question");

	let summary = "*Retrospective Summary*\n\n";
	summary += `_Completed on ${new Date().toLocaleDateString()}_\n\n`;
	summary += formatCategoryItems(goodItems, CATEGORY_EMOJI.good, "What went well");
	summary += formatCategoryItems(badItems, CATEGORY_EMOJI.bad, "What could be improved");
	summary += formatCategoryItems(
		questionItems,
		CATEGORY_EMOJI.question,
		"Questions / Discussion topics",
	);
	summary += formatActionItems(actionItems);

	return summary;
}

export function buildEditInstructionsModal(currentInstructions?: string) {
	return {
		type: "modal" as const,
		callback_id: "edit_instructions_modal",
		title: { type: "plain_text", text: "Edit Retro Instructions" },
		submit: { type: "plain_text", text: "Save" },
		close: { type: "plain_text", text: "Cancel" },
		blocks: [
			{
				type: "input",
				block_id: "instructions_block",
				element: {
					type: "plain_text_input",
					action_id: "instructions_input",
					multiline: true,
					initial_value: currentInstructions || "",
					placeholder: { type: "plain_text", text: "Enter instructions in markdown format..." },
				},
				label: { type: "plain_text", text: "Instructions (Markdown)" },
				hint: {
					type: "plain_text",
					text: "Use markdown formatting. These instructions will be displayed to your team.",
				},
			},
		],
	};
}

export function buildViewInstructionsModal(instructions?: string) {
	let blocks: SlackBlock[] = [];

	if (!instructions || instructions.trim() === "") {
		blocks.push({
			type: "rich_text",
			elements: [
				{
					type: "rich_text_section",
					elements: [
						{
							type: "text",
							text: "No instructions have been set yet. Click 'Edit Instructions' to add some.",
							style: { italic: true },
						},
					],
				},
			],
		});
	} else {
		blocks = parseMarkdownToRichTextBlocks(instructions);
	}

	return {
		type: "modal" as const,
		callback_id: "view_instructions_modal",
		title: { type: "plain_text", text: "Retro Instructions" },
		close: { type: "plain_text", text: "Close" },
		blocks,
	};
}

export function buildOpenInBrowserModal(authUrl: string) {
	return {
		type: "modal" as const,
		callback_id: "open_in_browser_modal",
		title: { type: "plain_text", text: "Open in Browser" },
		close: { type: "plain_text", text: "Close" },
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "\u{1F310} *Open Retro in Browser*\n\nClick the button below to open the retro board in your browser. This link will expire in 5 minutes.",
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: { type: "plain_text", text: "Open Browser View", emoji: true },
						url: authUrl,
						action_id: "open_browser_link",
						style: "primary",
					},
				],
			},
		],
	};
}
