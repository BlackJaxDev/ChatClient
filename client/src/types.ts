export type TransportMode = 'server' | 'p2p';

export interface Member {
  socketId?: string;
  userId: string;
  username: string;
  color: string;
  avatarUrl?: string;
}

export interface MessageAuthor {
  id: string;
  name: string;
  color: string;
  socketId?: string;
  avatarUrl?: string;
}

export type MessageBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'code'; text: string; language?: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; style: 'bullet' | 'number'; items: string[] };

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file';
  mimeType: string;
  name: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
}

export interface ChannelSummary {
  id: string;
  name: string;
  topic: string;
  lastMessage?: Message | null;
  messageCount: number;
}

export interface ServerSummary {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  icon: string;
  channels: ChannelSummary[];
}

export interface Message {
  id: string;
  serverId: string;
  channelId: string;
  author: MessageAuthor;
  content: string;
  blocks: MessageBlock[];
  attachments: MessageAttachment[];
  mentions: string[];
  timestamp: string;
  transport: TransportMode;
  system?: boolean;
  transient?: boolean;
  pending?: boolean;
  error?: string;
}

export interface ChannelEvent {
  type: 'user-joined' | 'user-left';
  user: Member;
  reason?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  accentColor: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
