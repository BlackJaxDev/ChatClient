const { nanoid } = require('nanoid');
const crypto = require('crypto');
const { getDb } = require('./db');

const ACCENT_COLORS = ['#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A855F7', '#F472B6', '#6366F1'];

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

function sanitizeAvatarUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return url.toString();
  } catch (error) {
    return '';
  }
}

function mapUserRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || '',
    accentColor: row.accent_color || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class UserStore {
  constructor(databaseFile) {
    this.db = getDb(databaseFile);
    this.findByEmailStmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    this.findByIdStmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    this.insertUserStmt = this.db.prepare(
      `INSERT INTO users (
        id, email, password_hash, display_name, avatar_url, accent_color, status, created_at, updated_at
      ) VALUES (
        @id, @email, @passwordHash, @displayName, @avatarUrl, @accentColor, @status, @createdAt, @updatedAt
      )`
    );
  }

  findByEmail(email) {
    const normalized = normalizeEmail(email);
    return mapUserRow(this.findByEmailStmt.get(normalized));
  }

  findById(id) {
    return mapUserRow(this.findByIdStmt.get(id));
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
      avatarUrl: sanitizeAvatarUrl(avatarUrl),
      accentColor: accentColor || randomAccent(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.insertUserStmt.run({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      accentColor: user.accentColor,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    return this.toPublic(user);
  }

  updateProfile(userId, updates = {}) {
    const user = this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const fields = [];
    const params = { id: userId };
    if (typeof updates.displayName === 'string') {
      params.displayName = updates.displayName.trim();
      fields.push('display_name = @displayName');
    }
    if (typeof updates.avatarUrl === 'string') {
      params.avatarUrl = sanitizeAvatarUrl(updates.avatarUrl);
      fields.push('avatar_url = @avatarUrl');
    }
    if (typeof updates.accentColor === 'string') {
      params.accentColor = updates.accentColor.trim();
      fields.push('accent_color = @accentColor');
    }
    if (typeof updates.status === 'string') {
      params.status = updates.status;
      fields.push('status = @status');
    }
    if (fields.length === 0) {
      return this.toPublic(user);
    }
    params.updatedAt = new Date().toISOString();
    fields.push('updated_at = @updatedAt');
    const statement = `UPDATE users SET ${fields.join(', ')} WHERE id = @id`;
    this.db.prepare(statement).run(params);
    return this.toPublic(this.findById(userId));
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
    if (!user) {
      return;
    }
    const updatedAt = new Date().toISOString();
    this.db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(updatedAt, userId);
  }

  toPublic(user) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
  }
}

module.exports = {
  UserStore,
  sanitizeAvatarUrl,
};
