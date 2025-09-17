const { nanoid } = require('nanoid');
const { getDb } = require('./db');
const { MAX_MESSAGES_PER_CHANNEL } = require('./defaultState');

function safeJsonParse(value, fallback) {
  if (typeof value !== 'string') {
    return Array.isArray(fallback) || typeof fallback === 'object' ? fallback : [];
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return Array.isArray(fallback) || typeof fallback === 'object' ? fallback : [];
  }
}

function normalizeBlocks(blocks, fallbackText) {
  if (!Array.isArray(blocks)) {
    return [
      {
        type: 'paragraph',
        text: fallbackText || '',
      },
    ];
  }
  return blocks.map((block) => {
    if (!block || typeof block !== 'object') {
      return {
        type: 'paragraph',
        text: fallbackText || '',
      };
    }
    if (typeof block.text !== 'string') {
      return {
        type: 'paragraph',
        text: fallbackText || '',
      };
    }
    const normalized = { ...block };
    normalized.type = typeof block.type === 'string' ? block.type : 'paragraph';
    normalized.text = block.text;
    return normalized;
  });
}

function mapAttachmentRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    type: row.type,
    mimeType: row.mime_type,
    name: row.name,
    size: typeof row.size === 'number' ? row.size : Number(row.size) || 0,
    url: row.url,
    thumbnailUrl: row.thumbnail_url || '',
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
        content, content_blocks, mentions, timestamp, transport, system
      ) VALUES (
        @id, @serverId, @channelId, @authorId, @authorName, @authorColor, @authorAvatarUrl,
        @content, @contentBlocks, @mentions, @timestamp, @transport, @system
      )`
    );
    this.pruneMessagesStmt = this.db.prepare(
      `DELETE FROM messages WHERE id IN (
        SELECT id FROM messages WHERE channel_id = ? ORDER BY timestamp ASC LIMIT ?
      )`
    );
    this.attachmentsForMessageStmt = this.db.prepare(
      'SELECT * FROM attachments WHERE message_id = ? ORDER BY created_at'
    );
    this.attachmentByIdStmt = this.db.prepare('SELECT * FROM attachments WHERE id = ?');
    this.insertAttachmentStmt = this.db.prepare(
      `INSERT INTO attachments (
        id, message_id, uploader_id, server_id, channel_id, type, mime_type, name, size, storage_key, url, thumbnail_url,
        created_at, updated_at
      ) VALUES (
        @id, @messageId, @uploaderId, @serverId, @channelId, @type, @mimeType, @name, @size, @storageKey, @url, @thumbnailUrl,
        @createdAt, @updatedAt
      )`
    );
    this.updateAttachmentAssociationStmt = this.db.prepare(
      `UPDATE attachments
       SET message_id = @messageId,
           server_id = @serverId,
           channel_id = @channelId,
           updated_at = @updatedAt
       WHERE id = @id`
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

  mapMessageRow(row) {
    if (!row) {
      return null;
    }
    const attachments = this.attachmentsForMessageStmt
      .all(row.id)
      .map(mapAttachmentRow)
      .filter(Boolean);
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
      blocks: safeJsonParse(row.content_blocks, [
        {
          type: 'paragraph',
          text: row.content,
        },
      ]),
      mentions: safeJsonParse(row.mentions, []),
      attachments,
      timestamp: row.timestamp,
      transport: row.transport,
      system: Boolean(row.system),
    };
  }

  mapAttachment(row) {
    return mapAttachmentRow(row);
  }

  getAttachmentById(id) {
    const row = this.attachmentByIdStmt.get(id);
    if (!row) {
      return null;
    }
    return row;
  }

  createUpload({ id, uploaderId, type, mimeType, name, size, storageKey, url, thumbnailUrl }) {
    const now = new Date().toISOString();
    const payload = {
      id: id || nanoid(),
      messageId: null,
      uploaderId,
      serverId: null,
      channelId: null,
      type,
      mimeType,
      name,
      size,
      storageKey,
      url,
      thumbnailUrl: thumbnailUrl || '',
      createdAt: now,
      updatedAt: now,
    };
    this.insertAttachmentStmt.run(payload);
    return this.attachmentByIdStmt.get(payload.id);
  }

  attachUploadsToMessage({ messageId, serverId, channelId, attachmentIds, authorId }) {
    if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) {
      return [];
    }
    const now = new Date().toISOString();
    const rows = [];
    const assign = this.db.transaction(() => {
      for (const id of attachmentIds) {
        const existing = this.attachmentByIdStmt.get(id);
        if (!existing) {
          throw new Error('Attachment not found');
        }
        if (existing.message_id && existing.message_id !== messageId) {
          throw new Error('Attachment already assigned to a message');
        }
        if (authorId && existing.uploader_id && existing.uploader_id !== authorId) {
          throw new Error('Attachment does not belong to the current user');
        }
        this.updateAttachmentAssociationStmt.run({
          id,
          messageId,
          serverId,
          channelId,
          updatedAt: now,
        });
        rows.push(this.attachmentByIdStmt.get(id));
      }
    });
    assign();
    return rows.map(mapAttachmentRow);
  }

  getServersOverview() {
    const servers = this.serverOverviewStmt.all();
    return servers.map((server) => ({
      ...server,
      channels: this.channelsByServerStmt.all(server.id).map((channel) => {
        const countRow = this.channelCountStmt.get(channel.id) || { count: 0 };
        const messageCount = countRow.count || 0;
        const lastRow = this.lastMessageStmt.get(channel.id);
        const lastMessage = lastRow ? this.mapMessageRow(lastRow) : null;
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
      const lastRow = this.lastMessageStmt.get(channel.id);
      const lastMessage = lastRow ? this.mapMessageRow(lastRow) : null;
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
    return rows
      .reverse()
      .map((row) => this.mapMessageRow(row))
      .filter(Boolean);
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
    const blocks = normalizeBlocks(message.blocks, message.content || '');
    const mentions = Array.isArray(message.mentions)
      ? message.mentions.filter((mention) => typeof mention === 'string')
      : [];
    const plainContent = typeof message.content === 'string' && message.content.trim().length > 0
      ? message.content
      : blocks.map((block) => block.text).join('\n').trim();
    const record = {
      id: message.id || nanoid(),
      serverId,
      channelId,
      authorId: message.author?.id || null,
      authorName: message.author?.name || 'System',
      authorColor: message.author?.color || '#5865F2',
      authorAvatarUrl: message.author?.avatarUrl || '',
      content: plainContent,
      contentBlocks: JSON.stringify(blocks),
      mentions: JSON.stringify(mentions),
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
    let attachments = [];
    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      const attachmentIds = message.attachments
        .map((attachment) => attachment && attachment.id)
        .filter((value) => typeof value === 'string');
      attachments = this.attachUploadsToMessage({
        messageId: record.id,
        serverId,
        channelId,
        attachmentIds,
        authorId: record.authorId,
      });
    }
    const insertedRow = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(record.id);
    const mapped = this.mapMessageRow(insertedRow);
    if (mapped) {
      mapped.attachments = attachments.length > 0 ? attachments : mapped.attachments;
    }
    return mapped;
  }
}

module.exports = {
  Store,
};
