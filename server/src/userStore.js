const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const crypto = require('crypto');

const ACCENT_COLORS = ['#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A855F7', '#F472B6', '#6366F1'];

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadUsers(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      ensureDirectory(filePath);
      const defaults = { users: [] };
      fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2));
      return defaults.users;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.users || !Array.isArray(parsed.users)) {
      throw new Error('Malformed user store');
    }
    return parsed.users;
  } catch (error) {
    console.error('Failed to load users store. Resetting to empty list.', error);
    ensureDirectory(filePath);
    const fallback = { users: [] };
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return fallback.users;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

function verifyPassword(password, encoded) {
  try {
    const [saltHex, hashHex] = encoded.split(':');
    if (!saltHex || !hashHex) {
      return false;
    }
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const candidate = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(candidate, expected);
  } catch (error) {
    return false;
  }
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function deriveDisplayName(email) {
  return email.split('@')[0];
}

function randomAccent() {
  return ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
}

class UserStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.users = loadUsers(filePath);
  }

  persist() {
    try {
      ensureDirectory(this.filePath);
      fs.writeFileSync(
        this.filePath,
        JSON.stringify({ users: this.users }, null, 2)
      );
    } catch (error) {
      console.error('Failed to persist user store', error);
    }
  }

  findByEmail(email) {
    const normalized = normalizeEmail(email);
    return this.users.find((user) => user.email === normalized) || null;
  }

  findById(id) {
    return this.users.find((user) => user.id === id) || null;
  }

  createUser({ email, password, displayName, avatarUrl, accentColor }) {
    const normalizedEmail = normalizeEmail(email);
    if (this.findByEmail(normalizedEmail)) {
      throw new Error('Email already registered');
    }
    const now = new Date().toISOString();
    const user = {
      id: nanoid(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      displayName: displayName ? displayName.trim() : deriveDisplayName(normalizedEmail),
      avatarUrl: avatarUrl ? avatarUrl.trim() : '',
      accentColor: accentColor || randomAccent(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    this.persist();
    return this.toPublic(user);
  }

  updateProfile(userId, updates = {}) {
    const user = this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const { displayName, avatarUrl, accentColor, status } = updates;
    if (typeof displayName === 'string') {
      user.displayName = displayName.trim();
    }
    if (typeof avatarUrl === 'string') {
      user.avatarUrl = avatarUrl.trim();
    }
    if (typeof accentColor === 'string') {
      user.accentColor = accentColor.trim();
    }
    if (typeof status === 'string') {
      user.status = status;
    }
    user.updatedAt = new Date().toISOString();
    this.persist();
    return this.toPublic(user);
  }

  verifyCredentials(email, password) {
    const user = this.findByEmail(email);
    if (!user) {
      return null;
    }
    return verifyPassword(password, user.passwordHash) ? user : null;
  }

  touch(userId) {
    const user = this.findById(userId);
    if (user) {
      user.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  toPublic(user) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
  }
}

module.exports = {
  UserStore,
};
