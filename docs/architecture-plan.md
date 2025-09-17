# ChatClient Architecture Expansion Plan

## 1. Purpose and context
This plan translates the high-level feature wishlist into a sequenced architecture and delivery roadmap. It assumes the current stack:

- **Frontend** – React 18 + Vite + TypeScript, Socket.IO client, WebRTC helpers, global state held in React context/hooks.
- **Backend** – Node.js + Express REST API, Socket.IO server, in-memory JSON persistence synced to `server/data/servers.json`.
- **Realtime** – Socket.IO for server relays, WebRTC data channels for peer-to-peer messaging within a channel.

The goal is to evolve the application toward production-ready collaboration features while maintaining incremental delivery and keeping the hybrid transport concept intact.

## 2. Guiding principles
1. **Progressive hardening** – introduce durable storage, authentication, and moderation guardrails before expanding surface area.
2. **API-first evolution** – design REST/Socket contracts that work for both classic relay and future P2P transports.
3. **Backward compatibility** – migrations should keep existing demo data operational and allow feature flags/toggles.
4. **Incremental rollout** – every milestone delivers a vertical slice that can be merged, tested, and demoed independently.
5. **Observability & quality** – add metrics/logging/test coverage alongside new capabilities.

## 3. High-level target architecture
- **Identity & accounts** – replace anonymous `username/color` pairs with authenticated user accounts backed by a database (initially SQLite or Postgres via Prisma/TypeORM). Support session tokens/JWT.
- **Media storage** – introduce object storage abstraction (local disk in dev, S3-compatible in prod) for attachments and avatars.
- **Extended message schema** – normalize messages to capture content blocks, attachments, reactions, edit history, and system metadata.
- **Realtime event fabric** – extend Socket.IO events (and align WebRTC data payloads) for typing, read receipts, message edits/deletes, and moderation signals.
- **Notification plumbing** – track per-user unread counts/mentions, enabling server-side push (web notifications/email later).
- **A/V rooms** – upgrade WebRTC setup to support SFU-ready session negotiation for audio/video, with signalling via Socket.IO and optional TURN.

## 4. Roadmap by feature

### 4.1 Persistent accounts & synchronized profiles
**Objective**: Allow users to create accounts, authenticate, and carry profile data (display name, avatar, accent color) across devices.

**Key user stories**
- As a visitor, I can sign up with email/password (or OAuth) and receive a persistent identity.
- As a returning user, I can sign in and my profile/settings load automatically.
- As a moderator/admin, I can see accurate authorship for every message.

**Architecture changes**
- ~~**Data model**: Introduce `User` table with fields: `id`, `email`, `passwordHash`, `displayName`, `avatarUrl`, `accentColor`, `createdAt`, `updatedAt`, `status`.~~
- ~~**Auth**: Implement sessions with JWT (HTTP-only cookies) or session store. Add password hashing (bcrypt/argon2) and validation middleware.~~
- ~~**API**:~~
  - ~~`POST /api/auth/register`~~
  - ~~`POST /api/auth/login`~~
  - ~~`POST /api/auth/logout`~~
  - ~~`GET /api/me` – returns profile + preferences.~~
- **Socket**: Authenticate connections via token; include `userId` in `register` payloads. Maintain presence keyed by user ID.
- **Frontend**: Add auth routes (sign-in/up forms), global auth context, secure storage of tokens, profile settings page.
- **Persistence**: Replace JSON file with relational DB. Provide migration script to import existing demo users (optional).
- **Security**: Rate-limit auth endpoints, sanitize avatar uploads.

**Incremental milestones**
1. Introduce database layer (ORM config, migrations) and port existing server/channel/message schema.
2. Implement auth endpoints + password-based login (UI + API).
3. Replace client-side localStorage identity with authenticated session; update Socket.IO handshake.
4. Add profile editing UI (avatar upload, theme color) and persist to DB/storage.
5. Update message attribution to use `userId`/`displayName` from accounts.

**Dependencies**: Database infrastructure must land before richer message payloads or moderation tooling to ensure referential integrity.

**Testing**: Integration tests for auth flow, JWT middleware, and regression tests for message retrieval under authenticated context.

**Suggested task prompts**
- "Introduce Prisma with SQLite, migrate existing data models, and adjust REST controllers to use the database."
- "Build email/password auth endpoints with hashed passwords and session cookies, plus matching React login/register forms."
- "Replace localStorage-based identity with authenticated sessions in the Socket.IO client/server handshake."

### 4.2 Richer message composition (attachments, emoji, formatting)
**Objective**: Enhance messages beyond plain text, supporting uploads, inline emoji, and lightweight formatting.

**Key user stories**
- I can attach an image/file to a message and others can download or preview it.
- I can insert emojis via a picker and see them rendered consistently.
- I can apply markdown-style formatting (bold, italics, code blocks).

**Architecture changes**
- **Data model**: Extend `Message` schema with `blocks` (structured content), `attachments` (array of metadata), `mentions`. Create `Attachment` table with `id`, `messageId`, `type`, `url`, `thumbnailUrl`, `size`, `name`.
- **API**:
  - `POST /api/uploads` (authenticated, multipart) returning signed URLs.
  - `POST /api/servers/:serverId/channels/:channelId/messages` accepts structured payload (text + attachments).
  - `GET /api/attachments/:id` streaming via storage adapter.
- **Socket/WebRTC payloads**: Align message events to send structured objects. Ensure backwards compatibility by providing fallback for plain text clients (legacy).
- **Frontend**: Rich composer component with markdown preview, emoji picker, attachment manager (drag & drop). Render pipeline using markdown parser + attachment components.
- **Storage**: Abstract storage to support local disk vs. S3. Generate thumbnails asynchronously for images.
- **Validation**: Limit file types/sizes, virus scanning hook (future), mention resolution.

**Incremental milestones**
1. Define new message schema + migrations; update message retrieval endpoints to hydrate attachments.
2. Implement storage adapter + upload API with authenticated access control.
3. Update server relay and P2P payload formats to send/receive structured message objects.
4. Build frontend composer UI for attachments and markdown, update renderer.
5. Add emoji picker integration (use open-source library) and mention autocompletion.

**Dependencies**: Requires persistent accounts (for auth + storage access control). Database upgrade must be complete.

**Testing**: File upload integration tests, markdown rendering snapshot tests, WebRTC data channel compatibility tests.

**Suggested task prompts**
- "Add structured message schema (blocks + attachments) and update message REST/Socket payloads accordingly."
- "Implement attachment upload API with local disk storage adapter and secure download routes."
- "Build a React rich-text composer with markdown preview, emoji picker, and attachment previews."

### 4.3 Message lifecycle controls (edit, delete, pin, moderation)
**Objective**: Provide controls for users and moderators to manage message history and uphold community standards.

**Key user stories**
- Authors can edit or delete their own messages within configurable windows.
- Moderators can remove or pin messages, and every action is auditable.
- Channels can surface key information via pinned highlights.

**Architecture changes**
- **Data model**: Extend `Message` with `editedAt`, `deletedAt`, `pinnedAt`, `pinnedByUserId`, `moderationStatus`. Add `AuditLog` table tracking `id`, `actorId`, `action`, `entityType`, `entityId`, `metadata`, `createdAt`. Introduce `ServerMembership` with `role` (`owner`, `admin`, `moderator`, `member`), plus optional `Report` table for flagged content.
- **API/Socket**:
  - `PATCH /api/messages/:id` – edit text/attachments; emits `message-updated` (Socket.IO + P2P payloads).
  - `DELETE /api/messages/:id` – soft delete with tombstone option; emits `message-deleted`.
  - `POST /api/messages/:id/pin` / `DELETE /api/messages/:id/pin` – maintain channel pinned list; emits `message-pinned`/`message-unpinned`.
  - `POST /api/messages/:id/report` – create moderation report, notifying admins.
  - `GET /api/moderation/reports` – secure endpoint powering dashboard.
- **Permissions**: Middleware that derives capabilities from membership roles; enforce edit window for authors and elevated privileges for moderators/admins.
- **Frontend**: Contextual action menus, inline edit mode with change highlighting, delete confirmation + undo toast, pinned message tray in channel header, moderation dashboard (table + filters) for admins.
- **P2P considerations**: Propagate lifecycle events over data channels and reconcile with server state when peers reconnect.

**Incremental milestones**
1. Implement membership roles/authorization middleware and migrate join/create flows to assign roles.
2. Deliver edit/delete endpoints with optimistic React UI and realtime broadcasts.
3. Build pin/unpin APIs and UI surfaces (header tray + channel metadata).
4. Introduce moderation reporting workflow and admin dashboard using audit log entries.

**Dependencies**: Requires persistent accounts, database-backed storage, and rich message schema to avoid rework.

**Testing**: Unit tests for authorization middleware, integration tests covering edit/delete/pin flows, frontend E2E tests verifying UI states, audit log verification tests.

**Suggested task prompts**
- "Implement server membership roles, authorization middleware, and audit logging for message actions."
- "Add message edit/delete REST endpoints, wire up Socket/WebRTC broadcasts, and update the React UI with optimistic flows."
- "Create pin/unpin APIs and render pinned messages in the channel header and sidebar surfaces."
- "Build a moderation dashboard that displays reports and audit trail entries for admins."

### 4.4 Unread state, mentions, and notifications
**Objective**: Track per-user read state, mention alerts, and notifications to drive engagement.

**Key user stories**
- I can see which channels have unread messages and jump to the latest unread position.
- When someone mentions me, I receive an in-app badge/notification.
- My read state synchronizes across devices.

**Architecture changes**
- **Data model**: `ChannelReadState` (userId, channelId, lastReadMessageId, lastReadAt), `Mention` entries referencing messages/users, optional `Notification` table.
- **API**:
  - `POST /api/channels/:id/read-state` – update read pointer.
  - `GET /api/users/me/unreads` – aggregated unread counts.
  - `GET /api/notifications` – list mention/alert items.
- **Socket**: Emit `channel-read`, `mention`, `notification` events. Update presence payloads to include unread counters.
- **Frontend**: Client-side store for read state, badges on channel list/server icons, toast or inbox for mentions, highlight message on jump.
- **Background jobs**: Cron/queue to send email/web push (future). For now, in-app only.

**Incremental milestones**
1. Add read-state tables + APIs; update message fetch to include `lastReadMessageId` per channel.
2. Update client to send read acknowledgements when viewing channels and render badges.
3. Implement mention detection in composer (based on user list) and notifications feed UI.
4. Add optional browser notifications (requires HTTPS + service worker) in later iteration.

**Dependencies**: Requires persistent accounts, message schema with mentions, membership roster for mention suggestions.

**Testing**: Backend unit tests for unread aggregation, frontend tests for badge rendering, load tests for notification fan-out.

**Suggested task prompts**
- "Persist per-user channel read state and expose unread counts via REST + Socket events."
- "Update the React client to sync read state, show unread badges, and jump to first unread message."
- "Implement mention detection, notifications API, and in-app notification center UI."

### 4.5 Realtime feedback enhancements (typing indicators, read receipts)
**Objective**: Make conversations feel alive with presence cues for typing and delivery/read confirmation.

**Key user stories**
- I can see when others are typing in the current channel.
- I know when my message was delivered and read by participants.

**Architecture changes**
- **Socket events**:
  - `typing-start` / `typing-stop` (channel-scoped).
  - `message-delivered` / `message-read` events per message.
- **Data model**: Reuse `ChannelReadState` plus add `MessageDelivery` table for per-user message status if needed.
- **Rate limiting**: Debounce typing events on client; server enforces throttling.
- **Frontend**: Typing indicator UI under message list; delivery ticks (sent, delivered, read) on message bubble.
- **P2P**: Mirror events over data channel for P2P mode with fallback to server relay when peers offline.

**Incremental milestones**
1. Define socket contracts and shared TypeScript types for typing events.
2. Implement backend handling (server + P2P) with rate limits and store last typing status in memory per channel.
3. Build client typing indicator component and integrate with composer focus events.
4. Extend message status UI using `ChannelReadState` data for read receipts.

**Dependencies**: Builds on unread state infrastructure.

**Testing**: Websocket contract tests, UI snapshot tests, end-to-end scenario verifying typing + read receipts.

**Suggested task prompts**
- "Add Socket.IO events and handlers for typing indicators with rate limiting and shared TypeScript contracts."
- "Render live typing indicators in the React channel footer and integrate with the composer state."
- "Display per-message delivery/read status leveraging the unread/read-state infrastructure."

### 4.6 Upgrade “voice-text” channels into true A/V rooms
**Objective**: Deliver actual audio/video rooms with proper signalling, TURN support, and UI.

**Key user stories**
- Users joining a voice-text channel automatically connect to a group audio room with mute/deafen controls.
- Users can optionally enable video and see other participants.
- The system handles network traversal via TURN and scales beyond simple mesh.

**Architecture changes**
- **Signalling**: Extend Socket.IO namespace for A/V channels, negotiating roles (publisher/subscriber). Consider using simple SFU (Mediasoup/LiveKit) or start with mesh for small rooms.
- **TURN/STUN**: Provide configuration for ICE servers (e.g., coturn). Manage credentials securely.
- **Media server (optional)**: Decide between hosted SFU or integrate open-source (e.g., Mediasoup) into backend.
- **Frontend**: Dedicated voice/video panel with participant tiles, controls (mute, deaf, screen share), device settings modal.
- **State management**: Track media session state per channel, integrate with existing presence list.
- **Persistence**: Store channel media settings, optionally record sessions.

**Incremental milestones**
1. Stabilize current WebRTC signalling layer; abstract into reusable module with TypeScript types.
2. Add TURN server configuration and fallback logic for unreliable P2P connections.
3. Implement audio-only rooms with participant controls (mute/unmute) using mesh for <=4 users.
4. Integrate optional video tracks and responsive UI grid.
5. Evaluate/introduce SFU for scalability (Mediasoup or external service) and update signalling accordingly.
6. Add moderation controls (force mute, move to other channel) leveraging role permissions.

**Dependencies**: Requires persistent accounts and moderation roles for participant controls. Benefit from unread/notification infrastructure for call invites.

**Testing**: WebRTC integration tests (canary browsers), automated signalling tests, manual QA across network types.

**Suggested task prompts**
- "Refactor WebRTC signalling into a dedicated module and add TURN server configuration with env-driven credentials."
- "Build audio room UI for voice-text channels with mute/deafen controls and participant tiles."
- "Integrate video tracks and evaluate SFU adoption (Mediasoup) for multi-party performance."

## 5. Cross-cutting engineering concerns
- **Configuration management**: Centralize env vars (database URL, storage bucket, JWT secret, TURN credentials) using `.env` + typed config loader.
- **Type sharing**: Create shared `types/` package consumed by client/server to keep API contracts aligned.
- **Error handling & logging**: Adopt structured logging (pino/winston) and consistent error format for REST + Socket events.
- **Testing strategy**: Expand automated tests (unit + integration + end-to-end). Consider Playwright/Cypress for client flows; supertest for API.
- **Dev experience**: Introduce seed scripts, fixtures, and Storybook for UI components as features grow.
- **Observability**: Add metrics instrumentation (Prometheus/Grafana) and tracing (OpenTelemetry) in later phases.

## 6. Sequencing overview
1. **Foundation**: Database integration, auth scaffolding, shared type definitions.
2. **Identity**: Persistent accounts and profile sync (Feature 4.1).
3. **Messaging depth**: Richer message schema/composer (Feature 4.2).
4. **Governance**: Message lifecycle controls + moderation (Feature 4.3).
5. **Engagement**: Unread state, mentions, notifications (Feature 4.4) followed by realtime feedback (Feature 4.5).
6. **Realtime media**: Voice/video room upgrades (Feature 4.6).
7. **Polish & scale**: Performance tuning, deployment pipelines, observability.

Each stage should culminate in a deployable release with feature toggles where appropriate to reduce risk.

## 7. Task launch prompt checklist
For each milestone, create a standalone task using prompts modeled like:

1. **Foundation**
   - "Set up Prisma with SQLite/Postgres, migrate existing data models, and update server controllers to use the ORM."
   - "Create a shared TypeScript types package consumed by both client and server."

2. **Persistent accounts**
   - "Implement secure email/password authentication (register/login/logout endpoints) and corresponding React forms."
   - "Update Socket.IO handshake to use authenticated user IDs instead of localStorage username/color."

3. **Rich messaging**
   - "Design and persist structured message content with attachment support; update REST and realtime payloads."
   - "Build a rich message composer with markdown preview, emoji picker, and attachment uploads."

4. **Message lifecycle & moderation**
   - "Introduce role-based permissions for servers/channels and add message edit/delete/pin APIs plus UI controls."
   - "Create a moderation dashboard displaying audit logs and reported messages."

5. **Unread + notifications**
   - "Persist per-user channel read state, surface unread badges, and implement mention notifications end-to-end."

6. **Realtime feedback**
   - "Add typing indicators and read receipts across server relay and P2P transports, with corresponding UI."

7. **A/V rooms**
   - "Upgrade voice-text channels into functional audio rooms with TURN support and participant controls."
   - "Extend audio rooms with optional video tiles and evaluate SFU integration for scalability."

Use these prompts sequentially, ensuring each completed task leaves the system in a releasable state before moving to the next.
