const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadSessions(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      ensureDirectory(filePath);
      const defaults = { sessions: [] };
      fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2));
      return defaults.sessions;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.sessions || !Array.isArray(parsed.sessions)) {
      throw new Error('Malformed session store');
    }
    return parsed.sessions;
  } catch (error) {
    console.error('Failed to load session store. Resetting to empty list.', error);
    ensureDirectory(filePath);
    const fallback = { sessions: [] };
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return fallback.sessions;
  }
}

class SessionStore {
  constructor(filePath) {
    this.filePath = filePath;
    const existing = loadSessions(filePath);
    this.sessions = new Map();
    existing.forEach((session) => {
      if (session && session.token && session.userId) {
        this.sessions.set(session.token, session);
      }
    });
    this.pruneExpired();
  }

  createSession(userId, ttlMs) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const session = {
      token,
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
    this.sessions.set(token, session);
    this.persist();
    return session;
  }

  getSession(token) {
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.sessions.delete(token);
      this.persist();
      return null;
    }
    return session;
  }

  deleteSession(token) {
    if (this.sessions.delete(token)) {
      this.persist();
    }
  }

  pruneExpired() {
    let changed = false;
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt).getTime() <= now) {
        this.sessions.delete(token);
        changed = true;
      }
    }
    if (changed) {
      this.persist();
    }
  }

  persist() {
    try {
      ensureDirectory(this.filePath);
      const serialized = {
        sessions: Array.from(this.sessions.values()),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(serialized, null, 2));
    } catch (error) {
      console.error('Failed to persist session store', error);
    }
  }
}

module.exports = {
  SessionStore,
};
