// Database models

export interface Retrospective {
  id: string;
  team_id: string;
  status: "active" | "finished";
  created_at: Date;
  finished_at: Date | null;
  summary: string | null;
}

export interface DiscussionItem {
  id: string;
  retro_id: string;
  user_id: string;
  user_name: string;
  category: "good" | "bad" | "question";
  content: string;
  created_at: Date;
}

export interface ActionItem {
  id: string;
  retro_id: string;
  user_id: string;
  responsible_user_id: string;
  responsible_user_name: string;
  content: string;
  completed: boolean;
  created_at: Date;
  completed_at: Date | null;
}

export interface Installation {
  id: string;
  team_id: string;
  access_token: string;
  bot_user_id: string;
  created_at: Date;
}

// Slack event types

export interface SlackUser {
  id: string;
  username: string;
  name: string;
}

export interface DiscussionItemWithRetro extends DiscussionItem {
  retrospective: Retrospective;
}

export interface ActionItemWithRetro extends ActionItem {
  retrospective: Retrospective;
}
