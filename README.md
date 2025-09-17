# ChatClient

A full-stack, Discord-inspired chat experience that can switch between classic server relays and direct peer-to-peer (P2P) messaging. The app ships with a real-time Node.js backend, an in-memory JSON persistence layer, and a modern React interface that mimics the multi-column Discord layout.

## Highlights

- **Discord-like UX** – server rail, channel list, message view, and member panel.
- **Hybrid transports** – toggle between Socket.IO relay and WebRTC data channels per channel.
- **Instant presence** – see who is online in the current channel and receive join/leave events.
- **Server + channel management** – create new spaces and rooms on the fly.
- **Durable demo data** – the backend persists state to `server/data/servers.json` so restarts keep history.
- **TypeScript-ready client** – built with Vite, React 18, and modern hooks.

## Getting started

```bash
# Install dependencies for the root helper scripts, the client, and the server
npm run install-all

# Start the Socket.IO server (port 3001) and the Vite dev server (port 5173)
npm run dev
```

Open `http://localhost:5173` in a browser, pick a display name, and invite a second browser window (or another machine) to test the P2P flow. The transport toggle in the chat header determines how new messages travel.

### Production-style build

```bash
# Create an optimized client build in client/dist
cd client
npm run build
```

The server serves only the API and Socket.IO endpoints, so production deployments should host the built client with a static host of your choice.

## Project structure

```
client/  → React + Vite front-end
server/  → Express + Socket.IO backend with JSON persistence
```

## Backend API & realtime contracts

- `GET /api/servers` – list servers with channel summaries and last activity.
- `POST /api/servers` – create a server (`name`, optional `description`, `accentColor`).
- `POST /api/servers/:id/channels` – add a channel to a server.
- `GET /api/servers/:id/channels/:channelId/messages?limit=50` – fetch channel history.
- `POST /api/servers/:id/channels/:channelId/messages` – persist a message (used for P2P mode).

Realtime (Socket.IO):

- `register` – identify the current socket with username/color.
- `join-channel` / `leave-channel` – manage channel presence and receive `presence-update` broadcasts.
- `server-message` – relay messages via the server.
- `p2p-ready`, `p2p-signal`, `p2p-teardown` – WebRTC signaling helpers.
- `channel-event` – join/leave notifications converted into inline system messages.

## Peer-to-peer transport

When P2P mode is enabled:

1. Each participant announces readiness with `p2p-ready`.
2. The server introduces peers in the room and relays signaling data only during setup.
3. Messages travel through WebRTC data channels and are optionally persisted through the REST API so newcomers can catch up.
4. Dropping back to "Server Relay" tears down the peer mesh and resumes classic Socket.IO broadcasting.

## Environment

- Node.js 18+
- npm 9+

Feel free to extend the schema, connect to a database, or style the interface further—the project is structured for quick iteration on both the backend and frontend layers.
