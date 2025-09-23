import { CSSProperties, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { nanoid } from 'nanoid';
import { SocketProvider, useSocket } from './context/SocketContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { fetchServers, fetchMessages, createServer, createChannel, persistMessage } from './api';
import { Member, Message, MessageAuthor, MessageAttachment, MessageBlock, ServerSummary, TransportMode } from './types';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { MessageList } from './components/MessageList';
import { MessageComposer, ComposerPayload } from './components/MessageComposer';
import { TypingIndicator } from './components/TypingIndicator';
import { TransportToggle } from './components/TransportToggle';
import { MemberList } from './components/MemberList';
import { UserProfileModal } from './components/UserProfileModal';
import { P2PStatus } from './components/P2PStatus';
import { useP2P } from './hooks/useP2P';
import { useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import './styles/App.css';

interface PresencePayload {
  room: string;
  members: Member[];
}

interface ChannelEventPayload {
  room: string;
  type: 'user-joined' | 'user-left';
  user: Member;
  reason?: string;
}

type MessagesState = Record<string, Message[]>;

type MessagesAction =
  | { type: 'set-history'; serverId: string; channelId: string; messages: Message[] }
  | { type: 'add'; serverId: string; channelId: string; message: Message }
  | { type: 'replace'; serverId: string; channelId: string; tempId: string; message: Message }
  | { type: 'error'; serverId: string; channelId: string; id: string; error: string }
  | { type: 'reset' };

function channelKey(serverId: string, channelId: string) {
  return `${serverId}:${channelId}`;
}

function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  if (action.type === 'reset') {
    return {};
  }
  const key = channelKey(action.serverId, action.channelId);
  const existing = state[key] ?? [];

  switch (action.type) {
    case 'set-history': {
      return {
        ...state,
        [key]: dedupeMessages(action.messages),
      };
    }
    case 'add': {
      if (existing.some((message) => message.id === action.message.id)) {
        return state;
      }
      return {
        ...state,
        [key]: [...existing, action.message],
      };
    }
    case 'replace': {
      const hasTemp = existing.some((message) => message.id === action.tempId);
      if (!hasTemp) {
        return {
          ...state,
          [key]: [...existing, action.message],
        };
      }
      return {
        ...state,
        [key]: existing.map((message) => (message.id === action.tempId ? action.message : message)),
      };
    }
    case 'error': {
      return {
        ...state,
        [key]: existing.map((message) =>
          message.id === action.id ? { ...message, error: action.error, pending: false } : message
        ),
      };
    }
    default:
      return state;
  }
}

function dedupeMessages(messages: Message[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

function ChatApp() {
  const socket = useSocket();
  const { theme, toggleTheme, accentColor, setAccentColor } = useTheme();
  const { user, initializing, pending: authPending, signOut, updateProfile } = useAuth();
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, dispatchMessages] = useReducer(messagesReducer, {});
  const [members, setMembers] = useState<Member[]>([]);
  const [typingByRoom, setTypingByRoom] = useState<Record<string, Member[]>>({});
  const [transportMode, setTransportMode] = useState<TransportMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('chatclient.transport');
      return stored === 'p2p' ? 'p2p' : 'server';
    }
    return 'server';
  });
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>(
    'disconnected'
  );
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [selfMember, setSelfMember] = useState<Member | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);

  const currentServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId) ?? null,
    [servers, selectedServerId]
  );

  const currentChannel = useMemo(() => {
    if (!currentServer || !selectedChannelId) return null;
    return currentServer.channels.find((channel) => channel.id === selectedChannelId) ?? null;
  }, [currentServer, selectedChannelId]);

  const currentMessages = useMemo(() => {
    if (!selectedServerId || !selectedChannelId) return [] as Message[];
    return messages[channelKey(selectedServerId, selectedChannelId)] ?? [];
  }, [messages, selectedServerId, selectedChannelId]);

  const typingMembers = useMemo(() => {
    if (!selectedServerId || !selectedChannelId) return [] as Member[];
    const key = channelKey(selectedServerId, selectedChannelId);
    const roomTypers = typingByRoom[key] ?? [];
    if (!user?.id) {
      return roomTypers;
    }
    return roomTypers.filter((member) => member.userId !== user.id);
  }, [typingByRoom, selectedServerId, selectedChannelId, user?.id]);

  const serverAccent = currentServer?.accentColor || accentColor;

  const serverBannerStyle = useMemo(() => {
    const style: BannerStyle = {
      '--server-banner-color': serverAccent,
      '--server-banner-shade': darkenColor(serverAccent, 0.35),
    };
    return style;
  }, [serverAccent]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('chatclient.transport', transportMode);
  }, [transportMode]);

  useEffect(() => {
    if (!user) {
      setServers([]);
      setSelectedServerId(null);
      setSelectedChannelId(null);
      setMembers([]);
      setSelfMember(null);
      setCurrentRoom(null);
      setTypingByRoom({});
      dispatchMessages({ type: 'reset' });
      return;
    }
    fetchServers()
      .then((data) => {
        setServers(data);
        if (!selectedServerId && data.length > 0) {
          setSelectedServerId(data[0].id);
          setSelectedChannelId(data[0].channels[0]?.id ?? null);
        }
      })
      .catch((error) => console.error('Failed to fetch servers', error));
  }, [user]);

  useEffect(() => {
    if (!user || !selectedServerId) return;
    const server = servers.find((item) => item.id === selectedServerId);
    if (!server) return;
    if (!selectedChannelId || !server.channels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(server.channels[0]?.id ?? null);
    }
  }, [servers, selectedServerId, selectedChannelId, user]);

  useEffect(() => {
    if (!user || !selectedServerId || !selectedChannelId) return;
    fetchMessages(selectedServerId, selectedChannelId)
      .then((items) => {
        dispatchMessages({ type: 'set-history', serverId: selectedServerId, channelId: selectedChannelId, messages: items });
      })
      .catch((error) => console.error('Failed to fetch messages', error));
  }, [user, selectedServerId, selectedChannelId]);

  useEffect(() => {
    if (user?.accentColor) {
      setAccentColor(user.accentColor);
    }
  }, [user?.accentColor, setAccentColor]);

  useEffect(() => {
    if (!socket) return;
    if (!user) {
      if (socket.connected) {
        socket.disconnect();
      }
      setConnectionState('disconnected');
      return;
    }

    const handleConnect = () => {
      setConnectionState('connected');
      socket.emit('register', {}, (response?: { ok: boolean; profile?: Member }) => {
        if (response?.ok && response.profile) {
          setSelfMember(response.profile);
        }
      });
      if (selectedServerId && selectedChannelId) {
        socket.emit('join-channel', { serverId: selectedServerId, channelId: selectedChannelId });
      }
    };

    const handleDisconnect = () => {
      setConnectionState('disconnected');
      setTypingByRoom({});
    };

    const handleMessage = (payload: { type: string; message: Message }) => {
      const { message } = payload;
      dispatchMessages({ type: 'add', serverId: message.serverId, channelId: message.channelId, message });
    };

    const handlePresence = (payload: PresencePayload) => {
      if (payload.room !== currentRoom) return;
      setMembers(payload.members);
      if (user) {
        const self = payload.members.find((member) => member.userId === user.id);
        if (self) {
          setSelfMember(self);
        }
      }
    };

    const handleChannelEvent = (payload: ChannelEventPayload) => {
      const [serverId, channelId] = payload.room.split(':');
      const content =
        payload.type === 'user-joined'
          ? `${payload.user.username} joined the channel`
          : `${payload.user.username} left the channel`;
      const eventMessage: Message = {
        id: `event-${payload.user.userId}-${Date.now()}`,
        serverId,
        channelId,
        author: {
          id: 'system',
          name: 'System',
          color: '#94a3b8',
        },
        content,
        blocks: [
          {
            type: 'paragraph',
            text: content,
          },
        ],
        attachments: [],
        mentions: [],
        timestamp: new Date().toISOString(),
        transport: 'server',
        system: true,
        transient: true,
      };
      dispatchMessages({ type: 'add', serverId, channelId, message: eventMessage });
    };

    const handleConnectError = (error: unknown) => {
      console.error('Socket connection error', error);
      setConnectionState('disconnected');
    };

    const handleTypingUpdate = (payload: { room: string; serverId: string; channelId: string; typers: Member[] }) => {
      if (!payload?.serverId || !payload?.channelId) {
        return;
      }
      const key = channelKey(payload.serverId, payload.channelId);
      setTypingByRoom((prev) => {
        if (!payload.typers || payload.typers.length === 0) {
          if (!prev[key]) {
            return prev;
          }
          const { [key]: _removed, ...rest } = prev;
          return rest;
        }
        const next = { ...prev, [key]: payload.typers };
        return next;
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('message', handleMessage);
    socket.on('presence-update', handlePresence);
    socket.on('channel-event', handleChannelEvent);
    socket.on('connect_error', handleConnectError);
    socket.on('typing-update', handleTypingUpdate);

    if (socket.connected) {
      handleConnect();
    } else {
      setConnectionState('connecting');
      socket.connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message', handleMessage);
      socket.off('presence-update', handlePresence);
      socket.off('channel-event', handleChannelEvent);
      socket.off('connect_error', handleConnectError);
      socket.off('typing-update', handleTypingUpdate);
    };
  }, [socket, user, selectedServerId, selectedChannelId, currentRoom]);

  useEffect(() => {
    if (!socket || !socket.connected || !user) return;
    socket.emit('register', {}, (response?: { ok: boolean; profile?: Member }) => {
      if (response?.ok && response.profile) {
        setSelfMember(response.profile);
      }
    });
  }, [socket, user?.displayName, user?.accentColor, user?.avatarUrl]);

  useEffect(() => {
    if (!selectedServerId || !selectedChannelId) {
      setTypingByRoom({});
      return;
    }
    const key = channelKey(selectedServerId, selectedChannelId);
    setTypingByRoom((prev) => {
      const existing = prev[key];
      return existing ? { [key]: existing } : {};
    });
  }, [selectedServerId, selectedChannelId]);

  useEffect(() => {
    if (!socket || !socket.connected || !user || !selectedServerId || !selectedChannelId) return;
    const room = channelKey(selectedServerId, selectedChannelId);
    socket.emit('join-channel', { serverId: selectedServerId, channelId: selectedChannelId }, (response?: { members?: Member[] }) => {
      if (response?.members) {
        setMembers(response.members);
        const self = response.members.find((member) => member.userId === user.id);
        if (self) {
          setSelfMember(self);
        }
      }
    });
    setCurrentRoom(room);
    return () => {
      socket.emit('leave-channel');
      setMembers([]);
      setCurrentRoom(null);
      setTypingByRoom({});
    };
  }, [socket, user, selectedServerId, selectedChannelId]);

  useEffect(() => {
    if (user && !user.displayName.trim()) {
      setProfileModalOpen(true);
    }
  }, [user]);

  const resolvePeerMeta = useCallback(
    (peerId: string) => members.find((member) => member.socketId === peerId),
    [members]
  );

  const handleIncomingPeerMessage = useCallback((message: Message) => {
    const normalized: Message = {
      ...message,
      transport: 'p2p',
      pending: false,
    };
    dispatchMessages({ type: 'add', serverId: normalized.serverId, channelId: normalized.channelId, message: normalized });
  }, []);

  const handleTypingStart = useCallback(() => {
    if (!socket || !socket.connected) return;
    if (!selectedServerId || !selectedChannelId) return;
    socket.emit('typing-start', { serverId: selectedServerId, channelId: selectedChannelId });
  }, [socket, selectedServerId, selectedChannelId]);

  const handleTypingStop = useCallback(() => {
    if (!socket || !socket.connected) return;
    if (!selectedServerId || !selectedChannelId) return;
    socket.emit('typing-stop', { serverId: selectedServerId, channelId: selectedChannelId });
  }, [socket, selectedServerId, selectedChannelId]);

  const { peers: p2pPeers, sendMessage: sendPeerMessage, isActive: isP2PActive } = useP2P({
    socket,
    enabled: transportMode === 'p2p',
    serverId: selectedServerId,
    channelId: selectedChannelId,
    currentUser: selfMember,
    onMessage: handleIncomingPeerMessage,
    resolvePeerMeta,
  });

  const handleSendMessage = useCallback(
    ({ content, blocks, attachments, mentions }: ComposerPayload) => {
      if (!selectedServerId || !selectedChannelId || !user) return;
      const trimmed = content.trim();
      const preparedAttachments: MessageAttachment[] = Array.isArray(attachments)
        ? attachments.map((attachment) => ({ ...attachment }))
        : [];
      if (!trimmed && preparedAttachments.length === 0) {
        return;
      }
      const timestamp = new Date().toISOString();
      const author: MessageAuthor = {
        id: user.id,
        name: user.displayName,
        color: selfMember?.color || user.accentColor || '#6366f1',
        avatarUrl: user.avatarUrl || undefined,
        socketId: selfMember?.socketId,
      };

      const normalizedBlocks: MessageBlock[] =
        Array.isArray(blocks) && blocks.length > 0
          ? blocks
          : trimmed
          ? [
              {
                type: 'paragraph',
                text: trimmed,
              },
            ]
          : [];

      const baseMessage: Message = {
        id: nanoid(),
        serverId: selectedServerId,
        channelId: selectedChannelId,
        author,
        content: trimmed,
        blocks: normalizedBlocks,
        attachments: preparedAttachments,
        mentions: Array.isArray(mentions) ? mentions : [],
        timestamp,
        transport: transportMode,
        pending: transportMode === 'server',
      };

      dispatchMessages({ type: 'add', serverId: selectedServerId, channelId: selectedChannelId, message: baseMessage });

      if (transportMode === 'server') {
        socket?.emit(
          'server-message',
          {
            serverId: selectedServerId,
            channelId: selectedChannelId,
            content: trimmed,
            blocks: normalizedBlocks,
            attachments: preparedAttachments.map((attachment) => ({ id: attachment.id })),
            mentions: baseMessage.mentions,
            tempId: baseMessage.id,
          },
          (response?: { ok: boolean; message?: Message; error?: string; tempId?: string }) => {
            if (response?.ok && response.message) {
              dispatchMessages({
                type: 'replace',
                serverId: selectedServerId,
                channelId: selectedChannelId,
                tempId: baseMessage.id,
                message: response.message,
              });
            } else if (response?.error) {
              dispatchMessages({
                type: 'error',
                serverId: selectedServerId,
                channelId: selectedChannelId,
                id: baseMessage.id,
                error: response.error,
              });
            }
          }
        );
      } else {
        sendPeerMessage({ ...baseMessage, pending: false });
        persistMessage(selectedServerId, selectedChannelId, {
          id: baseMessage.id,
          content: trimmed,
          blocks: normalizedBlocks,
          attachments: preparedAttachments.map((attachment) => ({ id: attachment.id })),
          mentions: baseMessage.mentions,
          transport: 'p2p',
          timestamp,
        }).catch((error) => console.error('Failed to persist peer message', error));
      }
    },
    [
      selectedServerId,
      selectedChannelId,
      user,
      transportMode,
      socket,
      sendPeerMessage,
      selfMember,
    ]
  );

  const handleCreateServer = async () => {
    const name = window.prompt('Server name');
    if (!name) return;
    try {
      await createServer({ name, accentColor: randomAccent(), description: '' });
      const updated = await fetchServers();
      setServers(updated);
    } catch (error) {
      window.alert('Failed to create server. See console for details.');
      console.error(error);
    }
  };

  const handleCreateChannel = async () => {
    if (!selectedServerId) return;
    const name = window.prompt('Channel name');
    if (!name) return;
    try {
      await createChannel(selectedServerId, { name });
      const updated = await fetchServers();
      setServers(updated);
    } catch (error) {
      window.alert('Failed to create channel. See console for details.');
      console.error(error);
    }
  };

  const handleProfileSave = useCallback(
    async (name: string, color: string) => {
      setProfileSaving(true);
      try {
        const updated = await updateProfile({ displayName: name, accentColor: color });
        setAccentColor(updated.accentColor);
        socket?.emit('register', {}, (response?: { ok: boolean; profile?: Member }) => {
          if (response?.ok && response.profile) {
            setSelfMember(response.profile);
          }
        });
        setProfileModalOpen(false);
      } catch (error) {
        console.error('Failed to update profile', error);
        throw error instanceof Error ? error : new Error('Failed to update profile');
      } finally {
        setProfileSaving(false);
      }
    },
    [updateProfile, setAccentColor, socket]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out', error);
    }
  }, [signOut]);

  const transportLabel = transportMode === 'p2p' ? 'Sending via peer-to-peer WebRTC' : 'Sending via relay server';
  const composerDisabled = !selectedChannelId || !selectedServerId || connectionState !== 'connected';
  const composerPlaceholder = currentChannel
    ? `Message #${currentChannel.name}`
    : 'Select a channel to start chatting';

  if (initializing) {
    return (
      <div className="auth-screen auth-screen--loading">
        <div className="auth-card">
          <h1>ChatClient</h1>
          <p className="auth-card__subtitle">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="app-shell">
      <ServerSidebar
        servers={servers}
        selectedServerId={selectedServerId}
        onSelect={(serverId) => setSelectedServerId(serverId)}
        onCreateServer={handleCreateServer}
      />
      <ChannelSidebar
        server={currentServer}
        selectedChannelId={selectedChannelId}
        onSelectChannel={(channelId) => setSelectedChannelId(channelId)}
        onCreateChannel={handleCreateChannel}
      />
      <section className="chat-area">
        <div className="server-banner" style={serverBannerStyle}>
          <div className="server-banner__content">
            <div className="server-banner__primary">
              <span className="server-banner__label">Server</span>
              <h1>{currentServer?.name ?? 'Welcome to ChatClient'}</h1>
              <p>{currentServer?.description?.trim() || 'Create or join a server to start chatting in real time.'}</p>
            </div>
            <div className="server-banner__channel">
              <span className="server-banner__label">Current channel</span>
              <h2>{currentChannel ? `#${currentChannel.name}` : 'No channel selected'}</h2>
              <p>{currentChannel?.topic?.trim() || 'Select a channel to view its conversation.'}</p>
            </div>
            <div className="server-banner__actions">
              <button
                type="button"
                className="server-banner__theme-toggle"
                onClick={toggleTheme}
                title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                aria-label="Toggle theme"
              >
                {theme === 'light' ? '🌞' : '🌙'}
              </button>
              <label className="server-banner__accent-picker">
                <span>Accent</span>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(event) => setAccentColor(event.target.value)}
                  aria-label="Choose accent color"
                />
              </label>
              <div className="server-banner__account">
                <button
                  type="button"
                  className="server-banner__profile"
                  onClick={() => setProfileModalOpen(true)}
                >
                  <span
                    className="server-banner__avatar"
                    style={{ backgroundColor: selfMember?.color || user.accentColor || '#6366f1' }}
                    aria-hidden={true}
                  >
                    {initials(user.displayName)}
                  </span>
                  <div className="server-banner__profile-meta">
                    <strong>{user.displayName}</strong>
                    <span>{user.email}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="server-banner__signout"
                  onClick={handleSignOut}
                  disabled={authPending}
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
        <header className="chat-header">
          <div className="chat-header__title">
            <span>#</span>
            <strong>{currentChannel?.name || 'Select a channel'}</strong>
          </div>
          <p className="chat-header__topic">{currentChannel?.topic?.trim() || 'No topic set'}</p>
          <div className="chat-header__meta">
            <TransportToggle mode={transportMode} onChange={setTransportMode} />
            <P2PStatus peers={p2pPeers} active={transportMode === 'p2p'} />
            <span className="p2p-status">
              Connection: {connectionState === 'connected' ? 'Connected' : connectionState === 'connecting' ? 'Connecting…' : 'Offline'}
            </span>
          </div>
        </header>
        <MessageList messages={currentMessages} currentUserId={user.id} />
        <TypingIndicator typers={typingMembers} />
        <MessageComposer
          disabled={composerDisabled}
          onSend={handleSendMessage}
          transportLabel={transportLabel}
          placeholder={composerPlaceholder}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
        />
      </section>
      <MemberList members={members} currentUserId={user.id} />
      <UserProfileModal
        open={profileModalOpen}
        initialName={user.displayName}
        initialColor={user.accentColor}
        onSave={handleProfileSave}
        onClose={() => setProfileModalOpen(false)}
        saving={profileSaving}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SocketProvider>
        <ChatApp />
      </SocketProvider>
    </ThemeProvider>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .padEnd(2, '∙');
}

function randomAccent() {
  const palette = ['#ef4444', '#f97316', '#facc15', '#34d399', '#60a5fa', '#a855f7'];
  return palette[Math.floor(Math.random() * palette.length)];
}

type BannerStyle = CSSProperties & {
  '--server-banner-color'?: string;
  '--server-banner-shade'?: string;
};

function darkenColor(color: string, amount: number) {
  return mixColor(color, '#000000', amount);
}

function mixColor(color: string, target: string, amount: number) {
  const source = hexToRgbSafe(color);
  const dest = hexToRgbSafe(target);
  const mix = {
    r: source.r + (dest.r - source.r) * amount,
    g: source.g + (dest.g - source.g) * amount,
    b: source.b + (dest.b - source.b) * amount,
  };
  return rgbToHex(mix);
}

function hexToRgbSafe(color: string) {
  const normalized = color?.replace('#', '') ?? '000000';
  const padded = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => char + char)
        .join('')
    : normalized.padEnd(6, '0');
  const int = Number.parseInt(padded.slice(0, 6), 16) || 0;
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(value)));
  const toHex = (value: number) => clamp(value).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
