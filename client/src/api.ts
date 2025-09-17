import { Message, ServerSummary } from './types';

const API_BASE = '/api';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init && init.headers ? init.headers : {}),
    },
    ...init,
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

export async function persistMessage(serverId: string, channelId: string, message: Message) {
  return request<{ message: Message }>(
    `${API_BASE}/servers/${serverId}/channels/${channelId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify(message),
    }
  );
}
