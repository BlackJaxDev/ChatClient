const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const { Store } = require('./store');
const { UserStore } = require('./userStore');
const { SessionStore } = require('./sessionStore');
const { createAuthHandlers } = require('./auth');

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, '..', 'data', 'servers.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'sessions.json');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const store = new Store(DATA_FILE);
const userStore = new UserStore(USERS_FILE);
const sessionStore = new SessionStore(SESSIONS_FILE);
const auth = createAuthHandlers({ userStore, sessionStore });

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

app.post('/api/auth/register', (req, res) => {
  const { email, password, displayName, avatarUrl, accentColor } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  const normalizedDisplayName = normalizeString(displayName);
  const normalizedAvatar = normalizeString(avatarUrl);
  try {
    const created = userStore.createUser({
      email,
      password,
      displayName: normalizedDisplayName,
      avatarUrl: normalizedAvatar,
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

app.post('/api/auth/login', (req, res) => {
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

app.post('/api/servers/:serverId/channels/:channelId/messages', (req, res) => {
  const { serverId, channelId } = req.params;
  const { author, content, transport, timestamp, id } = req.body || {};
  if (!author || !author.name || !author.id) {
    return res.status(400).json({ error: 'Author information is required' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }
  try {
    const message = store.addMessage(serverId, channelId, {
      id: id || nanoid(),
      author: {
        id: author.id,
        name: author.name,
        color: author.color || '#5865F2',
      },
      content: content.trim(),
      transport: transport || 'server',
      timestamp,
    });
    res.status(201).json({ message });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const clients = new Map(); // socketId -> profile
const channelMembers = new Map(); // room -> Set<socketId>

function roomKey(serverId, channelId) {
  return `${serverId}:${channelId}`;
}

function ensureRoomSet(room) {
  if (!channelMembers.has(room)) {
    channelMembers.set(room, new Set());
  }
  return channelMembers.get(room);
}

function getMemberProfile(socketId) {
  const profile = clients.get(socketId);
  if (!profile) {
    return {
      socketId,
      userId: socketId,
      username: 'Guest',
      color: '#5865F2',
    };
  }
  return {
    socketId,
    userId: profile.userId,
    username: profile.username,
    color: profile.color,
  };
}

function emitPresence(room) {
  const members = Array.from(channelMembers.get(room) || []).map(getMemberProfile);
  io.to(room).emit('presence-update', { room, members });
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
  const members = channelMembers.get(currentRoom);
  if (members) {
    members.delete(socket.id);
    if (members.size === 0) {
      channelMembers.delete(currentRoom);
    }
  }
  const profile = getMemberProfile(socket.id);
  broadcastChannelEvent(currentRoom, {
    type: 'user-left',
    user: profile,
    reason,
  });
  socket.to(currentRoom).emit('p2p-teardown', { peerId: socket.id });
  socket.data.currentRoom = null;
  socket.data.currentChannel = null;
  emitPresence(currentRoom);
}

io.on('connection', (socket) => {
  socket.data = {
    currentRoom: null,
    currentChannel: null,
  };

  socket.on('register', (payload = {}, ack) => {
    const username = typeof payload.username === 'string' ? payload.username.trim() : '';
    if (!username) {
      if (ack) ack({ ok: false, error: 'Username is required' });
      return;
    }
    const profile = {
      socketId: socket.id,
      userId: payload.userId || nanoid(),
      username,
      color: payload.color || randomAccent(),
    };
    clients.set(socket.id, profile);
    if (ack) ack({ ok: true, profile });
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

    if (socket.data.currentRoom === roomKey(serverId, channelId)) {
      if (ack) ack({ ok: true, alreadyJoined: true });
      return;
    }

    leaveRoom(socket, 'moved');

    const room = roomKey(serverId, channelId);
    socket.join(room);
    ensureRoomSet(room).add(socket.id);
    socket.data.currentRoom = room;
    socket.data.currentChannel = { serverId, channelId };

    const profile = getMemberProfile(socket.id);
    broadcastChannelEvent(room, {
      type: 'user-joined',
      user: profile,
    });

    emitPresence(room);

    if (ack) {
      ack({
        ok: true,
        members: Array.from(channelMembers.get(room) || []).map(getMemberProfile),
      });
    }
  });

  socket.on('leave-channel', () => {
    leaveRoom(socket, 'left');
  });

  socket.on('server-message', (payload = {}, ack) => {
    const { serverId, channelId, content, tempId } = payload;
    if (!serverId || !channelId || !content || !content.trim()) {
      if (ack) ack({ ok: false, error: 'Missing message fields' });
      return;
    }
    if (socket.data.currentRoom !== roomKey(serverId, channelId)) {
      if (ack) ack({ ok: false, error: 'Join the channel before sending messages' });
      return;
    }
    const authorProfile = getMemberProfile(socket.id);
    try {
      const message = store.addMessage(serverId, channelId, {
        author: {
          id: authorProfile.userId,
          name: authorProfile.username,
          color: authorProfile.color,
        },
        content: content.trim(),
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
    const { serverId, channelId, message } = payload;
    if (!serverId || !channelId || !message) {
      if (ack) ack({ ok: false, error: 'Invalid payload' });
      return;
    }
    try {
      const stored = store.addMessage(serverId, channelId, message);
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
    const peers = Array.from(channelMembers.get(room) || []).filter((id) => id !== socket.id);
    const selfProfile = getMemberProfile(socket.id);

    peers.forEach((peerId) => {
      const peerProfile = getMemberProfile(peerId);
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
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

function randomAccent() {
  const palette = ['#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A855F7', '#F472B6'];
  return palette[Math.floor(Math.random() * palette.length)];
}
