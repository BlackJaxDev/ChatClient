const { nanoid } = require('nanoid');
const { getDb } = require('./db');
const { MAX_MESSAGES_PER_CHANNEL } = require('./defaultState');

function mapMessageRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    serverId: row.server_id,
    channelId: row.channel_id,
    author: {
      id: row.author_id || 'system',
      name: row.author_name,
      color: row.author_color || '#5865F2',
      avatarUrl: row.author_avatar_url || '',
    },
    content: row.content,
    timestamp: row.timestamp,
    transport: row.transport,
    system: Boolean(row.system),
  };
}

class Store {
  constructor(databaseFile) {
    this.db = getDb(databaseFile);
    this.channelCountStmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE channel_id = ?');
    this.lastMessageStmt = this.db.prepare(
      'SELECT * FROM messages WHERE channel_id = ? ORDER BY timestamp DESC LIMIT 1'
    );
    this.serverOverviewStmt = this.db.prepare(
      'SELECT id, name, description, accent_color AS accentColor, icon FROM servers ORDER BY name'
    );
    this.serverByIdStmt = this.db.prepare(
      'SELECT id, name, description, accent_color AS accentColor, icon FROM servers WHERE id = ?'
    );
    this.channelsByServerStmt = this.db.prepare(
      'SELECT id, server_id AS serverId, name, topic FROM channels WHERE server_id = ? ORDER BY name'
    );
    this.channelByIdsStmt = this.db.prepare(
      'SELECT id, server_id AS serverId, name, topic FROM channels WHERE server_id = ? AND id = ?'
    );
    this.messagesForChannelStmt = this.db.prepare(
      'SELECT * FROM messages WHERE server_id = ? AND channel_id = ? ORDER BY timestamp DESC LIMIT ?'
    );
    this.insertServerStmt = this.db.prepare(
      'INSERT INTO servers (id, name, description, accent_color, icon) VALUES (@id, @name, @description, @accentColor, @icon)'
    );
    this.insertChannelStmt = this.db.prepare(
      'INSERT INTO channels (id, server_id, name, topic) VALUES (@id, @serverId, @name, @topic)'
    );
    this.insertMessageStmt = this.db.prepare(
      `INSERT INTO messages (
        id, server_id, channel_id, author_id, author_name, author_color, author_avatar_url,
        content, timestamp, transport, system
      ) VALUES (
        @id, @serverId, @channelId, @authorId, @authorName, @authorColor, @authorAvatarUrl,
        @content, @timestamp, @transport, @system
      )`
    );
    this.pruneMessagesStmt = this.db.prepare(
      `DELETE FROM messages WHERE id IN (
        SELECT id FROM messages WHERE channel_id = ? ORDER BY timestamp ASC LIMIT ?
      )`
    );
  }

  mapChannelRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      serverId: row.serverId,
      name: row.name,
      topic: row.topic || '',
    };
  }

  getServersOverview() {
    const servers = this.serverOverviewStmt.all();
    return servers.map((server) => ({
      ...server,
      channels: this.channelsByServerStmt.all(server.id).map((channel) => {
        const countRow = this.channelCountStmt.get(channel.id) || { count: 0 };
        const messageCount = countRow.count || 0;
        const lastMessage = mapMessageRow(this.lastMessageStmt.get(channel.id));
        return {
          id: channel.id,
          name: channel.name,
          topic: channel.topic || '',
          lastMessage,
          messageCount,
        };
      }),
    }));
  }

  getServerSummary(serverId) {
    const server = this.serverByIdStmt.get(serverId);
    if (!server) {
      return null;
    }
    const channels = this.channelsByServerStmt.all(serverId).map((channel) => {
      const countRow = this.channelCountStmt.get(channel.id) || { count: 0 };
      const messageCount = countRow.count || 0;
      const lastMessage = mapMessageRow(this.lastMessageStmt.get(channel.id));
      return {
        id: channel.id,
        name: channel.name,
        topic: channel.topic || '',
        lastMessage,
        messageCount,
      };
    });
    return {
      ...server,
      channels,
    };
  }

  getChannel(serverId, channelId) {
    const row = this.channelByIdsStmt.get(serverId, channelId);
    return this.mapChannelRow(row);
  }

  getMessages(serverId, channelId, limit = 50) {
    const rowLimit = Math.max(1, Math.min(limit || MAX_MESSAGES_PER_CHANNEL, MAX_MESSAGES_PER_CHANNEL));
    const rows = this.messagesForChannelStmt.all(serverId, channelId, rowLimit);
    return rows.reverse().map(mapMessageRow);
  }

  createServer({ name, description, accentColor, icon }) {
    const server = {
      id: nanoid(),
      name,
      description: description || '',
      accentColor: accentColor || '#5865F2',
      icon: icon || name.slice(0, 1).toUpperCase(),
    };
    this.insertServerStmt.run({
      id: server.id,
      name: server.name,
      description: server.description,
      accentColor: server.accentColor,
      icon: server.icon,
    });
    return { ...server, channels: [] };
  }

  createChannel(serverId, { name, topic }) {
    const server = this.serverByIdStmt.get(serverId);
    if (!server) {
      throw new Error('Server not found');
    }
    const channel = {
      id: nanoid(),
      serverId,
      name,
      topic: topic || '',
    };
    this.insertChannelStmt.run({
      id: channel.id,
      serverId,
      name: channel.name,
      topic: channel.topic,
    });
    return {
      id: channel.id,
      name: channel.name,
      topic: channel.topic,
    };
  }

  addMessage(serverId, channelId, message) {
    const channel = this.getChannel(serverId, channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }
    const now = new Date().toISOString();
    const record = {
      id: message.id || nanoid(),
      serverId,
      channelId,
      authorId: message.author?.id || null,
      authorName: message.author?.name || 'System',
      authorColor: message.author?.color || '#5865F2',
      authorAvatarUrl: message.author?.avatarUrl || '',
      content: message.content,
      timestamp: message.timestamp || now,
      transport: message.transport || 'server',
      system: message.system ? 1 : 0,
    };

    const insert = this.db.transaction((payload) => {
      this.insertMessageStmt.run(payload);
      const countRow = this.channelCountStmt.get(channelId) || { count: 0 };
      const currentCount = countRow.count || 0;
      if (currentCount > MAX_MESSAGES_PER_CHANNEL) {
        const toDelete = currentCount - MAX_MESSAGES_PER_CHANNEL;
        this.pruneMessagesStmt.run(channelId, toDelete);
      }
    });

    insert(record);
    const insertedRow = this.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(record.id);
    return mapMessageRow(insertedRow);
  }
}

module.exports = {
  Store,
};
