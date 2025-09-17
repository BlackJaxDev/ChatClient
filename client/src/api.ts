import { AuthUser, Message, ServerSummary, TransportMode } from './types';

const API_BASE = '/api';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init && init.headers ? init.headers : {}),
    },
    ...init,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  return response.json() as Promise<T>;
}

export async function fetchServers(): Promise<ServerSummary[]> {
  const data = await request<{ servers: ServerSummary[] }>(`${API_BASE}/servers`);
  return data.servers;
}

export async function fetchMessages(serverId: string, channelId: string, limit = 50): Promise<Message[]> {
  const data = await request<{ messages: Message[] }>(
    `${API_BASE}/servers/${serverId}/channels/${channelId}/messages?limit=${limit}`
  );
  return data.messages;
}

export async function createServer(payload: {
  name: string;
  description?: string;
  accentColor?: string;
  icon?: string;
}) {
  return request<{ server: ServerSummary }>(`${API_BASE}/servers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createChannel(serverId: string, payload: { name: string; topic?: string }) {
  return request<{ channel: { id: string; name: string; topic: string } }>(
    `${API_BASE}/servers/${serverId}/channels`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function persistMessage(
  serverId: string,
  channelId: string,
  payload: { id?: string; content: string; transport?: TransportMode; timestamp?: string }
) {
  return request<{ message: Message }>(`${API_BASE}/servers/${serverId}/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function registerAccount(payload: {
  email: string;
  password: string;
  displayName?: string;
  avatarUrl?: string;
  accentColor?: string;
}): Promise<AuthUser> {
  const { user } = await request<{ user: AuthUser }>(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return user;
}

export async function login(payload: { email: string; password: string }): Promise<AuthUser> {
  const { user } = await request<{ user: AuthUser }>(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return user;
}

export async function logout(): Promise<void> {
  await request<{ ok: boolean }>(`${API_BASE}/auth/logout`, { method: 'POST' });
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE}/me`, { credentials: 'include' });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  const data = (await response.json()) as { user: AuthUser };
  return data.user;
}

export async function updateProfile(payload: {
  displayName?: string;
  avatarUrl?: string;
  accentColor?: string;
}): Promise<AuthUser> {
  const { user } = await request<{ user: AuthUser }>(`${API_BASE}/me`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return user;
}
