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

export type TopicSourceKind = 'latest' | 'hot' | 'node';

export interface TopicSource {
  kind: TopicSourceKind;
  node?: V2exNode;
}
