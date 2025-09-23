const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatclient-test-'));
process.env.CHATCLIENT_DB_FILE = path.join(tmpDir, 'database.sqlite');
process.env.CHATCLIENT_SESSIONS_FILE = path.join(tmpDir, 'sessions.json');

const { server } = require('../src/index');

let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function requestJson(pathname, { method = 'GET', body, headers = {}, cookie } = {}) {
  if (!baseUrl) {
    throw new Error('Server not initialized');
  }
  const finalHeaders = { ...headers };
  let payload = body;
  if (payload !== undefined && typeof payload !== 'string') {
    payload = JSON.stringify(payload);
    if (!finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }
  }
  if (cookie) {
    finalHeaders.Cookie = cookie;
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: finalHeaders,
    body: payload,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      data = text;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
    cookies: response.headers.getSetCookie?.() || [],
  };
}

async function registerAndGetCookie(suffix) {
  const email = `user-${suffix}@example.com`;
  const result = await requestJson('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'Password123!', displayName: `Test ${suffix}` },
  });
  assert.strictEqual(result.status, 201);
  const sessionCookie = result.cookies.find((value) => value.startsWith('chat_session='));
  assert.ok(sessionCookie, 'Expected authentication cookie to be issued');
  return sessionCookie.split(';')[0];
}

test('POST /api/servers rejects unauthenticated requests', async () => {
  const result = await requestJson('/api/servers', {
    method: 'POST',
    body: { name: 'Unauthorized server' },
  });
  assert.strictEqual(result.status, 401);
  assert.deepStrictEqual(result.data, { error: 'Authentication required' });
});

test('POST /api/servers allows authenticated users to create servers', async () => {
  const cookie = await registerAndGetCookie('server-create');
  const result = await requestJson('/api/servers', {
    method: 'POST',
    body: { name: 'Authorized Server', description: 'Created in tests' },
    cookie,
  });
  assert.strictEqual(result.status, 201);
  assert.ok(result.data?.server?.id);
  assert.strictEqual(result.data.server.name, 'Authorized Server');
});

test('POST /api/servers/:serverId/channels rejects unauthenticated requests', async () => {
  const overview = await requestJson('/api/servers');
  assert.strictEqual(overview.status, 200);
  const [firstServer] = overview.data?.servers || [];
  assert.ok(firstServer, 'Expected at least one server in seed data');

  const result = await requestJson(`/api/servers/${firstServer.id}/channels`, {
    method: 'POST',
    body: { name: 'Restricted channel' },
  });
  assert.strictEqual(result.status, 401);
  assert.deepStrictEqual(result.data, { error: 'Authentication required' });
});

test('POST /api/servers/:serverId/channels allows authenticated users to create channels', async () => {
  const cookie = await registerAndGetCookie('channel-create');
  const serverResult = await requestJson('/api/servers', {
    method: 'POST',
    body: { name: 'Channel Parent' },
    cookie,
  });
  assert.strictEqual(serverResult.status, 201);
  const serverId = serverResult.data?.server?.id;
  assert.ok(serverId, 'Expected server id from creation response');

  const channelResult = await requestJson(`/api/servers/${serverId}/channels`, {
    method: 'POST',
    body: { name: 'Announcements' },
    cookie,
  });
  assert.strictEqual(channelResult.status, 201);
  assert.ok(channelResult.data?.channel?.id);
  assert.strictEqual(channelResult.data.channel.name, 'Announcements');
});
