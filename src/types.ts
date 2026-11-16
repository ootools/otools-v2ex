export interface V2exNode {
  id: number;
  name: string;
  title: string;
  title_alternative?: string;
  url?: string;
  topics?: number;
  header?: string;
  footer?: string;
  avatar_mini?: string;
  avatar_normal?: string;
  avatar_large?: string;
  parent_node_name?: string | null;
  root?: boolean;
  stars?: number;
}

export interface V2exMember {
  id: number;
  username: string;
  url?: string;
  tagline?: string;
  bio?: string;
  avatar_mini?: string;
  avatar_normal?: string;
  avatar_large?: string;
}

export interface V2exTopic {
  id: number;
  title: string;
  url?: string;
  content?: string;
  content_rendered?: string;
  replies?: number;
  created: number;
  last_modified?: number;
  last_touched?: number;
  member?: V2exMember;
  node?: V2exNode;
}

export interface V2exReply {
  id: number;
  content?: string;
  content_rendered?: string;
  created: number;
  member?: V2exMember;
  member_id?: number;
  topic_id?: number;
}

/** API 2.0 的 token 信息（GET /api/v2/token）。 */
export interface V2exTokenInfo {
  token?: string;
  scope?: string;
  created?: number;
  expiration?: number;
  good_for_days?: number;
}

/**
 * API 2.0 的通知（GET /api/v2/notifications）。
 * payload 形如 `topic:1257265` 或 `topic:1257265?reply=6`，点击后用于定位主题。
 */
export interface V2exNotification {
  id: number;
  member?: V2exMember;
  text?: string;
  payload?: string;
  created: number;
}

export type AuthStatus = 'anonymous' | 'checking' | 'authenticated' | 'invalid';

export type TopicSourceKind = 'latest' | 'hot' | 'node';

export interface TopicSource {
  kind: TopicSourceKind;
  node?: V2exNode;
}
