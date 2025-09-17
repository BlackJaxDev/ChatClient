const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { createDefaultState } = require('./defaultState');

let dbInstance = null;
let initializedPath = null;

function mapBoolean(value) {
  return value ? 1 : 0;
}

function runMigrations(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      accent_color TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      accent_color TEXT DEFAULT '#5865F2',
      icon TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      topic TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      author_id TEXT,
      author_name TEXT NOT NULL,
      author_color TEXT,
      author_avatar_url TEXT,
      content TEXT NOT NULL,
      content_blocks TEXT NOT NULL DEFAULT '[]',
      mentions TEXT NOT NULL DEFAULT '[]',
      timestamp TEXT NOT NULL,
      transport TEXT NOT NULL,
      system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
      uploader_id TEXT NOT NULL,
      server_id TEXT,
      channel_id TEXT,
      type TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      url TEXT NOT NULL,
      thumbnail_url TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);
    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_server ON messages(server_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_uploader ON attachments(uploader_id);
  `);

  const messageColumns = db.prepare('PRAGMA table_info(messages)').all();
  const hasBlocks = messageColumns.some((column) => column.name === 'content_blocks');
  if (!hasBlocks) {
    db.exec("ALTER TABLE messages ADD COLUMN content_blocks TEXT NOT NULL DEFAULT '[]'");
  }
  const hasMentions = messageColumns.some((column) => column.name === 'mentions');
  if (!hasMentions) {
    db.exec("ALTER TABLE messages ADD COLUMN mentions TEXT NOT NULL DEFAULT '[]'");
  }
}

function seedInitialData(db) {
  const hasServers = db.prepare('SELECT COUNT(*) as count FROM servers').get();
  if (hasServers.count > 0) {
    return;
  }

  const state = createDefaultState();
  const insertServer = db.prepare(
    'INSERT INTO servers (id, name, description, accent_color, icon) VALUES (@id, @name, @description, @accentColor, @icon)'
  );
  const insertChannel = db.prepare(
    'INSERT INTO channels (id, server_id, name, topic) VALUES (@id, @serverId, @name, @topic)'
  );
  const insertMessage = db.prepare(
    `INSERT INTO messages (
      id, server_id, channel_id, author_id, author_name, author_color, author_avatar_url,
      content, content_blocks, mentions, timestamp, transport, system
    ) VALUES (
      @id, @serverId, @channelId, @authorId, @authorName, @authorColor, @authorAvatarUrl,
      @content, @contentBlocks, @mentions, @timestamp, @transport, @system
    )`
  );

  const insertState = db.transaction(() => {
    for (const server of state.servers) {
      insertServer.run({
        id: server.id,
        name: server.name,
        description: server.description || '',
        accentColor: server.accentColor || '#5865F2',
        icon: server.icon || '',
      });
      for (const channel of server.channels) {
        insertChannel.run({
          id: channel.id,
          serverId: server.id,
          name: channel.name,
          topic: channel.topic || '',
        });
        for (const message of channel.messages) {
          const blocks = Array.isArray(message.blocks)
            ? message.blocks
            : [
                {
                  type: 'paragraph',
                  text: message.content,
                },
              ];
          insertMessage.run({
            id: message.id,
            serverId: server.id,
            channelId: channel.id,
            authorId: message.author?.id || null,
            authorName: message.author?.name || 'System',
            authorColor: message.author?.color || '#94a3b8',
            authorAvatarUrl: message.author?.avatarUrl || '',
            content: message.content,
            contentBlocks: JSON.stringify(blocks),
            mentions: JSON.stringify(message.mentions || []),
            timestamp: message.timestamp,
            transport: message.transport,
            system: mapBoolean(message.system),
          });
        }
      }
    }
  });

  insertState();
}

function getDb(databaseFile) {
  if (dbInstance && initializedPath === databaseFile) {
    return dbInstance;
  }

  const targetPath = databaseFile || path.join(process.cwd(), 'chatclient.sqlite');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  dbInstance = new Database(targetPath);
  initializedPath = targetPath;
  dbInstance.pragma('journal_mode = WAL');
  runMigrations(dbInstance);
  seedInitialData(dbInstance);
  return dbInstance;
}

module.exports = {
  getDb,
};
