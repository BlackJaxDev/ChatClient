const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');

const MAX_MESSAGES_PER_CHANNEL = 200;

function createDefaultState() {
  const now = new Date().toISOString();
  const systemAuthor = {
    id: 'system',
    name: 'System',
    color: '#94a3b8',
  };

  const welcomeMessage = (content, channelId, serverId) => ({
    id: nanoid(),
    serverId,
    channelId,
    author: systemAuthor,
    content,
    timestamp: now,
    transport: 'server',
    system: true,
  });

  const communityId = nanoid();
  const collabId = nanoid();

  return {
    servers: [
      {
        id: communityId,
        name: 'Welcome Hub',
        description: 'A friendly place to meet everyone trying the demo.',
        accentColor: '#5865F2',
        icon: 'W',
        channels: [
          {
            id: nanoid(),
            name: 'general',
            topic: 'Chat about anything and meet new friends',
            messages: [
              welcomeMessage('Welcome to the ChatClient demo! This space is powered by the built-in real-time server.', 'general', communityId),
              welcomeMessage('Switch the transport toggle to try pure peer-to-peer messaging with WebRTC data channels.', 'general', communityId),
            ],
          },
          {
            id: nanoid(),
            name: 'help-desk',
            topic: 'Ask questions about the project or share feedback',
            messages: [
              welcomeMessage('Need help getting started? Drop a message in here.', 'help-desk', communityId),
            ],
          },
        ],
      },
      {
        id: collabId,
        name: 'Collaboration Lab',
        description: 'A sandbox server where you can experiment with channels and peer-to-peer rooms.',
        accentColor: '#2F3136',
        icon: 'C',
        channels: [
          {
            id: nanoid(),
            name: 'ideas',
            topic: 'Share ideas and inspiration',
            messages: [
              welcomeMessage('Invite a teammate and brainstorm together in peer-to-peer mode!', 'ideas', collabId),
            ],
          },
          {
            id: nanoid(),
            name: 'voice-text',
            topic: 'Coordinate audio/video sessions (text only in this demo)',
            messages: [],
          },
        ],
      },
    ],
  };
}

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = loadState(filePath);
  }

  getServersOverview() {
    return this.state.servers.map((server) => ({
      id: server.id,
      name: server.name,
      description: server.description,
      accentColor: server.accentColor,
      icon: server.icon,
      channels: server.channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        topic: channel.topic,
        lastMessage: channel.messages[channel.messages.length - 1] || null,
        messageCount: channel.messages.length,
      })),
    }));
  }

  getServerSummary(serverId) {
    const server = this.state.servers.find((s) => s.id === serverId);
    if (!server) return null;
    return {
      id: server.id,
      name: server.name,
      description: server.description,
      accentColor: server.accentColor,
      icon: server.icon,
      channels: server.channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        topic: channel.topic,
        lastMessage: channel.messages[channel.messages.length - 1] || null,
        messageCount: channel.messages.length,
      })),
    };
  }

  getChannel(serverId, channelId) {
    const server = this.state.servers.find((s) => s.id === serverId);
    if (!server) return null;
    const channel = server.channels.find((c) => c.id === channelId);
    if (!channel) return null;
    return channel;
  }

  getMessages(serverId, channelId, limit = 50) {
    const channel = this.getChannel(serverId, channelId);
    if (!channel) return [];
    if (!limit || channel.messages.length <= limit) {
      return channel.messages.slice();
    }
    return channel.messages.slice(channel.messages.length - limit);
  }

  createServer({ name, description, accentColor, icon }) {
    const server = {
      id: nanoid(),
      name,
      description: description || '',
      accentColor: accentColor || '#5865F2',
      icon: icon || name.slice(0, 1).toUpperCase(),
      channels: [],
    };
    this.state.servers.push(server);
    this.persist();
    return server;
  }

  createChannel(serverId, { name, topic }) {
    const server = this.state.servers.find((s) => s.id === serverId);
    if (!server) {
      throw new Error('Server not found');
    }
    const channel = {
      id: nanoid(),
      name,
      topic: topic || '',
      messages: [],
    };
    server.channels.push(channel);
    this.persist();
    return channel;
  }

  addMessage(serverId, channelId, message) {
    const channel = this.getChannel(serverId, channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }
    const enriched = {
      id: message.id || nanoid(),
      serverId,
      channelId,
      author: message.author,
      content: message.content,
      timestamp: message.timestamp || new Date().toISOString(),
      transport: message.transport || 'server',
      system: Boolean(message.system),
    };
    channel.messages.push(enriched);
    if (channel.messages.length > MAX_MESSAGES_PER_CHANNEL) {
      channel.messages.splice(0, channel.messages.length - MAX_MESSAGES_PER_CHANNEL);
    }
    this.persist();
    return enriched;
  }

  persist() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('Failed to persist chat state', error);
    }
  }
}

function loadState(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      const defaultState = createDefaultState();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(defaultState, null, 2));
      return defaultState;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.servers) {
      throw new Error('Malformed state file');
    }
    return parsed;
  } catch (error) {
    console.error('Failed to load state file. Falling back to defaults.', error);
    const fallback = createDefaultState();
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    } catch (persistError) {
      console.error('Failed to persist fallback state', persistError);
    }
    return fallback;
  }
}

module.exports = {
  Store,
  createDefaultState,
};
