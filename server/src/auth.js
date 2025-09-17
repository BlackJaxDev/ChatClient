const AUTH_COOKIE_NAME = 'chat_session';
const DEFAULT_SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

function parseCookies(header) {
  if (!header) {
    return {};
  }
  return header.split(';').reduce((acc, part) => {
    const [rawKey, rawValue] = part.split('=');
    if (!rawKey || !rawValue) {
      return acc;
    }
    const key = rawKey.trim();
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(rawValue.trim());
    return acc;
  }, {});
}

function appendSetCookie(res, value) {
  const previous = res.getHeader('Set-Cookie');
  if (!previous) {
    res.setHeader('Set-Cookie', value);
  } else if (Array.isArray(previous)) {
    res.setHeader('Set-Cookie', [...previous, value]);
  } else {
    res.setHeader('Set-Cookie', [previous, value]);
  }
}

function buildCookie(name, value, { maxAge, expires, secure, sameSite = 'Lax', httpOnly = true, path = '/' } = {}) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${path}`);
  if (httpOnly) {
    parts.push('HttpOnly');
  }
  if (secure) {
    parts.push('Secure');
  }
  if (sameSite) {
    parts.push(`SameSite=${sameSite}`);
  }
  if (typeof maxAge === 'number') {
    parts.push(`Max-Age=${Math.floor(maxAge / 1000)}`);
  }
  if (expires) {
    parts.push(`Expires=${new Date(expires).toUTCString()}`);
  }
  return parts.join('; ');
}

function createAuthHandlers({ userStore, sessionStore, sessionTtl = DEFAULT_SESSION_TTL }) {
  const secureCookies = process.env.NODE_ENV === 'production';

  function issueSession(res, userId) {
    const session = sessionStore.createSession(userId, sessionTtl);
    appendSetCookie(
      res,
      buildCookie(AUTH_COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'Lax',
        path: '/',
        expires: session.expiresAt,
      })
    );
    return session;
  }

  function clearSession(res) {
    appendSetCookie(
      res,
      buildCookie(AUTH_COOKIE_NAME, '', {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'Lax',
        path: '/',
        maxAge: 0,
      })
    );
  }

  function attachUser(req, _res, next) {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[AUTH_COOKIE_NAME];
    if (!token) {
      return next();
    }
    const session = sessionStore.getSession(token);
    if (!session) {
      return next();
    }
    const user = userStore.findById(session.userId);
    if (!user) {
      sessionStore.deleteSession(token);
      return next();
    }
    req.user = userStore.toPublic(user);
    req.authToken = token;
    return next();
  }

  function requireAuth(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return next();
  }

  return {
    attachUser,
    requireAuth,
    issueSession,
    clearSession,
  };
}

module.exports = {
  AUTH_COOKIE_NAME,
  DEFAULT_SESSION_TTL,
  createAuthHandlers,
  parseCookies,
};
