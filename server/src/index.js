const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { buffer: consumeBuffer } = require('node:stream/consumers');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const { Store } = require('./store');
const { UserStore, sanitizeAvatarUrl } = require('./userStore');
const { SessionStore } = require('./sessionStore');
const { AUTH_COOKIE_NAME, createAuthHandlers, parseCookies } = require('./auth');
const { ensureUploadDir, saveBuffer, openReadStream, fileStat } = require('./storage');

const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, '..', 'data', 'chatclient.sqlite');
const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'sessions.json');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);

const store = new Store(DB_FILE);
const userStore = new UserStore(DB_FILE);
const sessionStore = new SessionStore(SESSIONS_FILE);
const auth = createAuthHandlers({ userStore, sessionStore });
ensureUploadDir();

function parseContentDisposition(value = '') {
  return value
    .split(';')
    .map((part) => part.trim())
    .reduce(
      (acc, part) => {
        const [key, raw] = part.split('=');
        if (!raw) {
          return acc;
        }
        const normalizedKey = key.toLowerCase();
        const trimmed = raw.trim().replace(/^"|"$/g, '');
        acc[normalizedKey] = trimmed;
        return acc;
      },
      { name: '', filename: '' }
    );
}

async function extractMultipartFile(req) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:(?:"([^"\\]+)")|([^;]+))/i);
  if (!boundaryMatch) {
    throw new Error('Missing multipart boundary');
  }
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const rawBody = await consumeBuffer(req);
  if (rawBody.length > MAX_UPLOAD_BYTES) {
    const error = new Error('File too large');
    error.statusCode = 413;
    throw error;
  }
  const marker = `--${boundary}`;
  const text = rawBody.toString('latin1');
  const segments = text.split(marker);
  for (const segment of segments) {
    if (!segment || segment === '--' || segment === '--\r\n') {
      continue;
    }
    const cleaned = segment.replace(/^\r\n/, '').replace(/\r\n$/, '');
    if (cleaned === '--') {
      continue;
    }
    const headerEnd = cleaned.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      continue;
    }
    const headerSection = cleaned.slice(0, headerEnd);
    let bodySection = cleaned.slice(headerEnd + 4);
    if (bodySection.endsWith('\r\n')) {
      bodySection = bodySection.slice(0, -2);
    }
    const headers = headerSection.split('\r\n').reduce((acc, line) => {
      const [key, ...rest] = line.split(':');
      if (!key || rest.length === 0) {
        return acc;
      }
      acc[key.trim().toLowerCase()] = rest.join(':').trim();
      return acc;
    }, {});
    const disposition = parseContentDisposition(headers['content-disposition'] || '');
    if (!disposition || !disposition.name || !disposition.filename) {
      continue;
    }
    const contentTypeHeader = headers['content-type'] || 'application/octet-stream';
    const buffer = Buffer.from(bodySection, 'latin1');
    return {
      fieldName: disposition.name,
      filename: disposition.filename,
      contentType: contentTypeHeader,
      buffer,
    };
  }
  throw new Error('No file field found');
}

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(auth.attachUser);

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAccent(color) {
  if (typeof color !== 'string') return undefined;
  const trimmed = color.trim();
  if (!trimmed) return undefined;
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

app.post('/api/auth/register', authLimiter, (req, res) => {
  const { email, password, displayName, avatarUrl, accentColor } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  const normalizedDisplayName = normalizeString(displayName);
  const sanitizedAvatar = sanitizeAvatarUrl(typeof avatarUrl === 'string' ? avatarUrl : '');
  try {
    const created = userStore.createUser({
      email,
      password,
      displayName: normalizedDisplayName,
      avatarUrl: sanitizedAvatar,
      accentColor: normalizeAccent(accentColor),
    });
    auth.issueSession(res, created.id);
    return res.status(201).json({ user: created });
  } catch (error) {
    if (error.message === 'Email already registered') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to create user' });
  }
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = userStore.verifyCredentials(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  auth.issueSession(res, user.id);
  return res.json({ user: userStore.toPublic(user) });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.authToken) {
    sessionStore.deleteSession(req.authToken);
  }
  auth.clearSession(res);
  return res.json({ ok: true });
});

app.get('/api/me', auth.requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

app.patch('/api/me', auth.requireAuth, (req, res) => {
  const { displayName, avatarUrl, accentColor, status } = req.body || {};
  try {
    const updates = {};
    if (typeof displayName === 'string') {
      updates.displayName = normalizeString(displayName);
    }
    if (typeof avatarUrl === 'string') {
      updates.avatarUrl = sanitizeAvatarUrl(avatarUrl);
    }
    const normalizedAccent = normalizeAccent(accentColor);
    if (normalizedAccent) {
      updates.accentColor = normalizedAccent;
    }
    if (typeof status === 'string') {
      updates.status = status;
    }
    const updated = userStore.updateProfile(req.user.id, updates);
    return res.json({ user: updated });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to update profile' });
  }
});

app.get('/api/servers', (req, res) => {
  res.json({ servers: store.getServersOverview() });
});

app.get('/api/servers/:serverId', (req, res) => {
  const summary = store.getServerSummary(req.params.serverId);
  if (!summary) {
    return res.status(404).json({ error: 'Server not found' });
  }
  res.json({ server: summary });
});

app.post('/api/servers', (req, res) => {
  const { name, description, accentColor, icon } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Server name is required' });
  }
  const server = store.createServer({
    name: name.trim(),
    description: description ? description.trim() : '',
    accentColor,
    icon,
  });
  res.status(201).json({ server });
});

app.post('/api/servers/:serverId/channels', (req, res) => {
  const { serverId } = req.params;
  const { name, topic } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Channel name is required' });
  }
  try {
    const channel = store.createChannel(serverId, {
      name: name.trim(),
      topic: topic ? topic.trim() : '',
    });
    res.status(201).json({ channel });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/servers/:serverId/channels/:channelId/messages', (req, res) => {
  const { serverId, channelId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
  const messages = store.getMessages(serverId, channelId, limit);
  res.json({ messages });
});

app.post('/api/servers/:serverId/channels/:channelId/messages', auth.requireAuth, (req, res) => {
  const { serverId, channelId } = req.params;
  const { content, transport, timestamp, id, blocks, attachments, mentions } = req.body || {};
  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const attachmentList = Array.isArray(attachments) ? attachments : [];
  const hasAttachments = attachmentList.length > 0;
  if (!normalizedContent && !hasAttachments) {
    return res.status(400).json({ error: 'Message content or attachment is required' });
  }
  try {
    const message = store.addMessage(serverId, channelId, {
      id: id || nanoid(),
      author: buildAuthorFromUser(req.user),
      content: normalizedContent,
      blocks,
      attachments: attachmentList,
      mentions,
      transport: transport || 'server',
      timestamp,
    });
    res.status(201).json({ message });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.post('/api/uploads', auth.requireAuth, async (req, res) => {
  try {
    const file = await extractMultipartFile(req);
    if (!file || file.fieldName !== 'file') {
      return res.status(400).json({ error: 'File is required' });
    }
    const originalName = path.basename(file.filename || 'upload');
    const type = file.contentType && file.contentType.startsWith('image/') ? 'image' : 'file';
    const { key } = saveBuffer(file.buffer, {
      originalName,
      mimeType: file.contentType,
    });
    const attachmentId = nanoid();
    const row = store.createUpload({
      id: attachmentId,
      uploaderId: req.user.id,
      type,
      mimeType: file.contentType || 'application/octet-stream',
      name: originalName || `${attachmentId}.${type === 'image' ? 'png' : 'bin'}`,
      size: file.buffer.length,
      storageKey: key,
      url: `/api/attachments/${attachmentId}`,
      thumbnailUrl: '',
    });
    return res.status(201).json({ attachment: store.mapAttachment(row) });
  } catch (error) {
    if (error.statusCode === 413) {
      return res.status(413).json({ error: 'File too large' });
    }
    console.error('Failed to store upload', error);
    return res.status(400).json({ error: error.message || 'Failed to store upload' });
  }
});

app.get('/api/attachments/:id', auth.requireAuth, (req, res) => {
  const { id } = req.params;
  const row = store.getAttachmentById(id);
  if (!row) {
    return res.status(404).json({ error: 'Attachment not found' });
  }
  if (!row.message_id && row.uploader_id !== req.user.id) {
    return res.status(403).json({ error: 'Attachment not available' });
  }
  const stats = fileStat(row.storage_key);
  if (!stats) {
    return res.status(404).json({ error: 'Attachment file missing' });
  }
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  const dispositionName = row.name || 'attachment';
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(dispositionName)}"`);
  const stream = openReadStream(row.storage_key);
  stream.on('error', () => {
    res.destroy();
  });
  stream.pipe(res);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const clients = new Map(); // socketId -> member profile
const socketsByUser = new Map(); // userId -> Set<socketId>
const channelMembers = new Map(); // room -> Map<userId, Set<socketId>>

io.use((socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie || '');
    const token = cookies[AUTH_COOKIE_NAME];
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const session = sessionStore.getSession(token);
    if (!session) {
      return next(new Error('Authentication required'));
    }
    const user = userStore.findById(session.userId);
    if (!user) {
      sessionStore.deleteSession(token);
      return next(new Error('User not found'));
    }
    socket.data = socket.data || {};
    socket.data.user = userStore.toPublic(user);
    socket.data.authToken = token;
    return next();
  } catch (error) {
    return next(error);
  }
});

function roomKey(serverId, channelId) {
  return `${serverId}:${channelId}`;
}

function ensureRoomMap(room) {
  if (!channelMembers.has(room)) {
    channelMembers.set(room, new Map());
  }
  return channelMembers.get(room);
}

function listRoomSocketIds(room) {
  const membership = channelMembers.get(room);
  if (!membership) {
    return [];
  }
  const sockets = [];
  for (const socketIds of membership.values()) {
    socketIds.forEach((id) => sockets.push(id));
  }
  return sockets;
}

function buildAuthorFromUser(user) {
  if (!user) {
    return {
      id: 'system',
      name: 'System',
      color: '#94a3b8',
    };
  }
  return {
    id: user.id,
    name: user.displayName || user.email,
    color: user.accentColor || '#5865F2',
    avatarUrl: user.avatarUrl || '',
  };
}

function buildMemberFromUser(user, socketId) {
  if (!user) {
    return null;
  }
  const author = buildAuthorFromUser(user);
  return {
    socketId,
    userId: author.id,
    username: author.name,
    color: author.color,
    avatarUrl: author.avatarUrl,
  };
}

function refreshSocketProfile(socket) {
  const userId = socket?.data?.user?.id;
  if (!userId) {
    return null;
  }
  const user = userStore.findById(userId);
  if (!user) {
    return null;
  }
  const publicUser = userStore.toPublic(user);
  socket.data.user = publicUser;
  let socketSet = socketsByUser.get(publicUser.id);
  if (!socketSet) {
    socketSet = new Set();
    socketsByUser.set(publicUser.id, socketSet);
  }
  socketSet.add(socket.id);
  const profile = buildMemberFromUser(publicUser, socket.id);
  if (profile) {
    clients.set(socket.id, profile);
  }
  return profile;
}

function getMemberProfile(socketId) {
  const profile = clients.get(socketId);
  if (profile) {
    return profile;
  }
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) {
    return null;
  }
  return refreshSocketProfile(socket);
}

function getPresenceMembers(room) {
  const membership = channelMembers.get(room);
  if (!membership) {
    return [];
  }
  const members = [];
  for (const [userId, socketIds] of membership.entries()) {
    let member = null;
    for (const socketId of socketIds) {
      member = getMemberProfile(socketId);
      if (member) {
        break;
      }
    }
    if (!member) {
      const user = userStore.findById(userId);
      if (user) {
        member = buildMemberFromUser(userStore.toPublic(user), socketIds.values().next().value);
      }
    }
    if (member) {
      members.push(member);
    }
  }
  return members;
}

function emitPresence(room) {
  io.to(room).emit('presence-update', { room, members: getPresenceMembers(room) });
}

function broadcastChannelEvent(room, payload) {
  io.to(room).emit('channel-event', { room, ...payload });
}

function leaveRoom(socket, reason = 'left') {
  const { currentRoom } = socket.data;
  if (!currentRoom) {
    return;
  }
  socket.leave(currentRoom);
  const membership = channelMembers.get(currentRoom);
  let userLeft = false;
  if (membership && socket.data.user) {
    const sockets = membership.get(socket.data.user.id);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        membership.delete(socket.data.user.id);
        userLeft = true;
      }
    }
    if (membership.size === 0) {
      channelMembers.delete(currentRoom);
    }
  }
  const profile = getMemberProfile(socket.id);
  if (userLeft && profile) {
    broadcastChannelEvent(currentRoom, {
      type: 'user-left',
      user: profile,
      reason,
    });
  }
  socket.to(currentRoom).emit('p2p-teardown', { peerId: socket.id });
  socket.data.currentRoom = null;
  socket.data.currentChannel = null;
  emitPresence(currentRoom);
}

io.on('connection', (socket) => {
  socket.data = socket.data || {};
  socket.data.currentRoom = null;
  socket.data.currentChannel = null;

  const profile = refreshSocketProfile(socket);
  if (!profile) {
    socket.disconnect(true);
    return;
  }

  socket.on('register', (_payload = {}, ack) => {
    const refreshed = refreshSocketProfile(socket);
    if (!refreshed) {
      if (ack) ack({ ok: false, error: 'Unable to load profile' });
      socket.disconnect(true);
      return;
    }
    if (ack) ack({ ok: true, profile: refreshed });
    if (socket.data.currentRoom) {
      emitPresence(socket.data.currentRoom);
    }
  });

  socket.on('join-channel', (payload = {}, ack) => {
    const { serverId, channelId } = payload;
    if (!serverId || !channelId) {
      if (ack) ack({ ok: false, error: 'Server and channel are required' });
      return;
    }
    const channel = store.getChannel(serverId, channelId);
    if (!channel) {
      if (ack) ack({ ok: false, error: 'Channel not found' });
      return;
    }

    const room = roomKey(serverId, channelId);
    if (socket.data.currentRoom === room) {
      if (ack) {
        ack({ ok: true, alreadyJoined: true, members: getPresenceMembers(room) });
      }
      return;
    }

    leaveRoom(socket, 'moved');

    socket.join(room);
    const membership = ensureRoomMap(room);
    if (!socket.data.user) {
      if (ack) ack({ ok: false, error: 'Authentication required' });
      socket.disconnect(true);
      return;
    }
    let socketSet = membership.get(socket.data.user.id);
    const firstJoin = !socketSet || socketSet.size === 0;
    if (!socketSet) {
      socketSet = new Set();
      membership.set(socket.data.user.id, socketSet);
    }
    socketSet.add(socket.id);
    socket.data.currentRoom = room;
    socket.data.currentChannel = { serverId, channelId };

    const memberProfile = getMemberProfile(socket.id);
    if (firstJoin && memberProfile) {
      broadcastChannelEvent(room, {
        type: 'user-joined',
        user: memberProfile,
      });
    }

    emitPresence(room);

    if (ack) {
      ack({ ok: true, members: getPresenceMembers(room) });
    }
  });

  socket.on('leave-channel', () => {
    leaveRoom(socket, 'left');
  });

  socket.on('server-message', (payload = {}, ack) => {
    const { serverId, channelId, content, tempId, attachments, blocks, mentions } = payload;
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    const attachmentList = Array.isArray(attachments) ? attachments : [];
    const hasAttachments = attachmentList.length > 0;
    if (!serverId || !channelId || (!normalizedContent && !hasAttachments)) {
      if (ack) ack({ ok: false, error: 'Missing message fields' });
      return;
    }
    if (socket.data.currentRoom !== roomKey(serverId, channelId)) {
      if (ack) ack({ ok: false, error: 'Join the channel before sending messages' });
      return;
    }
    if (!socket.data.user) {
      if (ack) ack({ ok: false, error: 'Authentication required' });
      socket.disconnect(true);
      return;
    }
    try {
      const message = store.addMessage(serverId, channelId, {
        author: buildAuthorFromUser(socket.data.user),
        content: normalizedContent,
        blocks,
        attachments: attachmentList,
        mentions,
        transport: 'server',
      });
      io.to(roomKey(serverId, channelId)).emit('message', {
        type: 'chat',
        message,
      });
      if (ack) {
        ack({ ok: true, message, tempId });
      }
    } catch (error) {
      if (ack) ack({ ok: false, error: error.message });
    }
  });

  socket.on('store-message', (payload = {}, ack) => {
    const { serverId, channelId, content, id, transport, timestamp, attachments, blocks, mentions } = payload;
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    const attachmentList = Array.isArray(attachments) ? attachments : [];
    const hasAttachments = attachmentList.length > 0;
    if (!serverId || !channelId || (!normalizedContent && !hasAttachments)) {
      if (ack) ack({ ok: false, error: 'Invalid payload' });
      return;
    }
    if (!socket.data.user) {
      if (ack) ack({ ok: false, error: 'Authentication required' });
      socket.disconnect(true);
      return;
    }
    try {
      const stored = store.addMessage(serverId, channelId, {
        id: id || nanoid(),
        author: buildAuthorFromUser(socket.data.user),
        content: normalizedContent,
        blocks,
        attachments: attachmentList,
        mentions,
        transport: transport || 'p2p',
        timestamp,
      });
      if (ack) ack({ ok: true, message: stored });
    } catch (error) {
      if (ack) ack({ ok: false, error: error.message });
    }
  });

  socket.on('p2p-ready', (payload = {}) => {
    const { serverId, channelId } = payload;
    if (!serverId || !channelId) {
      return;
    }
    const room = roomKey(serverId, channelId);
    if (socket.data.currentRoom !== room) {
      return;
    }
    const peers = listRoomSocketIds(room).filter((id) => id !== socket.id);
    const selfProfile = getMemberProfile(socket.id);
    if (!selfProfile) {
      return;
    }

    peers.forEach((peerId) => {
      const peerProfile = getMemberProfile(peerId);
      if (!peerProfile) {
        return;
      }
      io.to(peerId).emit('p2p-init', {
        room,
        peerId: socket.id,
        peer: selfProfile,
        initiator: true,
      });
      socket.emit('p2p-init', {
        room,
        peerId,
        peer: peerProfile,
        initiator: false,
      });
    });
  });

  socket.on('p2p-signal', (payload = {}) => {
    const { target, data, serverId, channelId } = payload;
    if (!target || !data) {
      return;
    }
    const room = roomKey(serverId, channelId);
    if (socket.data.currentRoom !== room) {
      return;
    }
    io.to(target).emit('p2p-signal', {
      from: socket.id,
      data,
    });
  });

  socket.on('p2p-teardown', (payload = {}) => {
    const { serverId, channelId } = payload;
    const room = roomKey(serverId, channelId);
    if (socket.data.currentRoom === room) {
      socket.to(room).emit('p2p-teardown', { peerId: socket.id });
    }
  });

  socket.on('disconnect', () => {
    leaveRoom(socket, 'disconnected');
    clients.delete(socket.id);
    const userId = socket.data?.user?.id;
    if (userId && socketsByUser.has(userId)) {
      const socketSet = socketsByUser.get(userId);
      socketSet.delete(socket.id);
      if (socketSet.size === 0) {
        socketsByUser.delete(userId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
