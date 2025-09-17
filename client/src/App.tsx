import { CSSProperties, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { nanoid } from 'nanoid';
import { SocketProvider, useSocket } from './context/SocketContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { fetchServers, fetchMessages, createServer, createChannel, persistMessage } from './api';
import { Member, Message, MessageAuthor, ServerSummary, TransportMode } from './types';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { MessageList } from './components/MessageList';
import { MessageComposer } from './components/MessageComposer';
import { TransportToggle } from './components/TransportToggle';
import { MemberList } from './components/MemberList';
import { UserProfileModal } from './components/UserProfileModal';
import { P2PStatus } from './components/P2PStatus';
import { useP2P } from './hooks/useP2P';
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
  | { type: 'error'; serverId: string; channelId: string; id: string; error: string };

function channelKey(serverId: string, channelId: string) {
  return `${serverId}:${channelId}`;
}

function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
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
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, dispatchMessages] = useReducer(messagesReducer, {});
  const [members, setMembers] = useState<Member[]>([]);
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
  const [profile, setProfile] = useState<Member>(() => {
    const storedName = typeof window !== 'undefined' ? window.localStorage.getItem('chatclient.username') || '' : '';
    const storedColor =
      typeof window !== 'undefined' ? window.localStorage.getItem('chatclient.color') || '#7c3aed' : '#7c3aed';
    const storedUserId =
      typeof window !== 'undefined' ? window.localStorage.getItem('chatclient.userId') || nanoid() : nanoid();
    return {
      userId: storedUserId,
      username: storedName,
      color: storedColor,
    };
  });
  const [profileModalOpen, setProfileModalOpen] = useState(() => profile.username.trim().length === 0);
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
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('chatclient.username', profile.username);
    window.localStorage.setItem('chatclient.color', profile.color);
    window.localStorage.setItem('chatclient.userId', profile.userId);
  }, [profile.username, profile.color, profile.userId]);

  useEffect(() => {
    fetchServers()
      .then((data) => {
        setServers(data);
        if (!selectedServerId && data.length > 0) {
          setSelectedServerId(data[0].id);
          setSelectedChannelId(data[0].channels[0]?.id ?? null);
        }
      })
      .catch((error) => console.error('Failed to fetch servers', error));
  }, []);

  useEffect(() => {
    if (!selectedServerId) return;
    const server = servers.find((item) => item.id === selectedServerId);
    if (!server) return;
    if (!selectedChannelId || !server.channels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(server.channels[0]?.id ?? null);
    }
  }, [servers, selectedServerId, selectedChannelId]);

  useEffect(() => {
    if (!selectedServerId || !selectedChannelId) return;
    fetchMessages(selectedServerId, selectedChannelId)
      .then((items) => {
        dispatchMessages({ type: 'set-history', serverId: selectedServerId, channelId: selectedChannelId, messages: items });
      })
      .catch((error) => console.error('Failed to fetch messages', error));
  }, [selectedServerId, selectedChannelId]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setConnectionState('connected');
      if (profile.username.trim()) {
        socket.emit('register', {
          username: profile.username,
          userId: profile.userId,
          color: profile.color,
        });
      }
      if (selectedServerId && selectedChannelId) {
        socket.emit('join-channel', { serverId: selectedServerId, channelId: selectedChannelId });
      }
    };

    const handleDisconnect = () => {
      setConnectionState('disconnected');
    };

    const handleMessage = (payload: { type: string; message: Message }) => {
      const { message } = payload;
      dispatchMessages({ type: 'add', serverId: message.serverId, channelId: message.channelId, message });
    };

    const handlePresence = (payload: PresencePayload) => {
      if (payload.room !== currentRoom) return;
      setMembers(payload.members);
      const self = payload.members.find((member) => member.userId === profile.userId);
      if (self && self.socketId && self.socketId !== profile.socketId) {
        setProfile((prev) => ({ ...prev, socketId: self.socketId }));
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
        timestamp: new Date().toISOString(),
        transport: 'server',
        system: true,
        transient: true,
      };
      dispatchMessages({ type: 'add', serverId, channelId, message: eventMessage });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('message', handleMessage);
    socket.on('presence-update', handlePresence);
    socket.on('channel-event', handleChannelEvent);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message', handleMessage);
      socket.off('presence-update', handlePresence);
      socket.off('channel-event', handleChannelEvent);
    };
  }, [socket, profile.userId, profile.username, profile.color, profile.socketId, currentRoom, selectedServerId, selectedChannelId]);

  useEffect(() => {
    if (!socket || !profile.username.trim()) return;
    setConnectionState('connecting');
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('register', {
      username: profile.username,
      userId: profile.userId,
      color: profile.color,
    }, (response?: { ok: boolean; profile?: Member }) => {
      if (response?.ok && response.profile) {
        setProfile((prev) => ({ ...prev, ...response.profile }));
      }
    });
  }, [socket, profile.username, profile.userId, profile.color]);

  useEffect(() => {
    if (!socket || !socket.connected || !selectedServerId || !selectedChannelId) return;
    const room = channelKey(selectedServerId, selectedChannelId);
    socket.emit('join-channel', { serverId: selectedServerId, channelId: selectedChannelId }, (response?: { members?: Member[] }) => {
      if (response?.members) {
        setMembers(response.members);
        const self = response.members.find((member) => member.userId === profile.userId);
        if (self && self.socketId) {
          setProfile((prev) => ({ ...prev, socketId: self.socketId }));
        }
      }
    });
    setCurrentRoom(room);
    return () => {
      socket.emit('leave-channel');
      setMembers([]);
      setCurrentRoom(null);
    };
  }, [socket, selectedServerId, selectedChannelId, profile.userId]);

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

  const { peers: p2pPeers, sendMessage: sendPeerMessage, isActive: isP2PActive } = useP2P({
    socket,
    enabled: transportMode === 'p2p',
    serverId: selectedServerId,
    channelId: selectedChannelId,
    currentUser: profile.username ? profile : null,
    onMessage: handleIncomingPeerMessage,
    resolvePeerMeta,
  });

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!selectedServerId || !selectedChannelId || !profile.username.trim()) return;
      const timestamp = new Date().toISOString();
      const author: MessageAuthor = {
        id: profile.userId,
        name: profile.username,
        color: profile.color,
      };

      const baseMessage: Message = {
        id: nanoid(),
        serverId: selectedServerId,
        channelId: selectedChannelId,
        author,
        content,
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
            content,
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
        persistMessage(selectedServerId, selectedChannelId, baseMessage).catch((error) =>
          console.error('Failed to persist peer message', error)
        );
      }
    },
    [selectedServerId, selectedChannelId, profile, transportMode, socket, sendPeerMessage]
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

  const handleProfileSave = (name: string, color: string) => {
    setProfile((prev) => ({ ...prev, username: name, color }));
    setProfileModalOpen(false);
  };

  const transportLabel = transportMode === 'p2p' ? 'Sending via peer-to-peer WebRTC' : 'Sending via relay server';
  const composerDisabled = !selectedChannelId || !selectedServerId;
  const composerPlaceholder = currentChannel
    ? `Message #${currentChannel.name}`
    : 'Select a channel to start chatting';

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
        <MessageList messages={currentMessages} currentUserId={profile.userId} />
        <MessageComposer
          disabled={composerDisabled}
          onSend={handleSendMessage}
          transportLabel={transportLabel}
          placeholder={composerPlaceholder}
        />
      </section>
      <MemberList members={members} currentUserId={profile.userId} />
      <UserProfileModal
        open={profileModalOpen}
        initialName={profile.username}
        initialColor={profile.color}
        onSave={handleProfileSave}
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
