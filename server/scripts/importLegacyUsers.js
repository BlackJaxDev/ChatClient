#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { getDb } = require('../src/db');

function loadLegacyUsers(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.users)) {
      return parsed.users;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Failed to parse legacy user file', error);
    return [];
  }
  return [];
}

function importUsers(db, users) {
  if (!users || users.length === 0) {
    console.log('No legacy users to import.');
    return;
  }
  const insert = db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, avatar_url, accent_color, status, created_at, updated_at)
    VALUES (@id, @email, @passwordHash, @displayName, @avatarUrl, @accentColor, @status, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      password_hash = excluded.password_hash,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      accent_color = excluded.accent_color,
      status = excluded.status,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  `);
  const byEmail = db.prepare('SELECT id FROM users WHERE email = ?');

  const tx = db.transaction(() => {
    for (const user of users) {
      if (!user?.email || !user?.passwordHash) {
        continue;
      }
      const existing = byEmail.get(user.email);
      if (existing && existing.id !== user.id) {
        console.warn(`Skipping legacy user ${user.email} due to email conflict.`);
        continue;
      }
      insert.run({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName || user.email.split('@')[0],
        avatarUrl: user.avatarUrl || '',
        accentColor: user.accentColor || '',
        status: user.status || 'active',
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: user.updatedAt || user.createdAt || new Date().toISOString(),
      });
    }
  });

  tx();
  console.log(`Imported ${users.length} legacy user(s).`);
}

function main() {
  const dataDir = path.join(__dirname, '..', 'data');
  const legacyFile = path.join(dataDir, 'users.json');
  const databaseFile = path.join(dataDir, 'chatclient.sqlite');
  const users = loadLegacyUsers(legacyFile);
  if (users === null) {
    console.log('Legacy user file not found. Nothing to import.');
    return;
  }
  const db = getDb(databaseFile);
  importUsers(db, users);
}

if (require.main === module) {
  main();
}
