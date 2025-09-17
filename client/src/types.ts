export type TransportMode = 'server' | 'p2p';

export interface Member {
  socketId?: string;
  userId: string;
  username: string;
  color: string;
}

export interface MessageAuthor {
  id: string;
  name: string;
  color: string;
  socketId?: string;
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
