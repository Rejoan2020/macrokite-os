# Macrokite OS

A minimal internal hub for the Macrokite team: project work, meetings and decisions, and team conversation in one place.

- **The project is the hub.** Tasks, meetings, decisions, chat and notes all belong to a project. Company-wide work goes in the **Internal** project.
- **Phases are the spine.** Every project moves through seven fixed phases: Idea, Planning, Design, Build, Test, Launch, Maintain.
- **Capture where it happens.** An action item typed in a meeting is a real task, and a decision typed in a meeting lands in the project's decision log.

The design spec and screen references live in [`macrokite-os-design/`](macrokite-os-design/DESIGN.md).

> **Status: local MVP, not production-authenticated.** There is no sign-in. Everyone who can reach the app acts as one configured identity. Run it locally or on a private network only.

## Quick start

Requirements: Node.js 20.9+ (tested with Node 24) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

With no configuration the app starts in **demo mode**: a sample workspace is seeded into your browser's `localStorage`. Changes survive refreshes but stay in that browser. Reset it from the bottom of **Settings**.

### Enable MongoDB (database mode)

```bash
cp .env.example .env.local
# then set, for example:
# MONGODB_URI=mongodb://127.0.0.1:27017
# MONGODB_DB=macrokite_os
npm run dev
```

When `MONGODB_URI` is set, all reads and writes go through the server to MongoDB, and the `macrokite` workspace is seeded on first run. Open chats poll for new messages every few seconds. If the database is unreachable, the app shows an error with a retry button; it never quietly falls back to demo data.

A database created by the previous version of the app (clients, inbox) is not migrated. Point `MONGODB_DB` at a new database, or drop the old one.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Enables database mode. Server-only; never sent to the browser. |
| `MONGODB_DB` | Optional database name. |
| `MACROKITE_ORG_SLUG` | Workspace to serve (default `macrokite`, which is seeded if missing). |
| `MACROKITE_ACTING_USER_EMAIL` | Which active member the server acts as (defaults to the first admin). |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | Domain-engine checks (validation, permissions, phases, meetings, mentions, unread state, text parsing) |

## Screens

| Route | What's there |
| --- | --- |
| `/` | Overview: my top tasks, unread (projects, General, messages), meetings today, recent decisions, my projects |
| `/projects` | Table or cards, search, phase filter tabs plus On hold and Archived |
| `/projects/[id]?tab=` | Phase card with "Move to next phase", and tabs for Tasks, Chat, Meetings, Decisions and Notes. Put on hold, archive (no delete) |
| `/meetings`, `/meetings/[id]` | Upcoming and past meetings. A meeting has agenda, notes, decisions and one-line action items (`Task @name fri`) |
| `/tasks` | My tasks grouped by Overdue, Today, This week, Later and No due date, plus completed this week |
| `/general` | Team-wide channel. Facebook and Instagram links render as cards, and `@name` mentions notify |
| `/messages/[userId]` | One-to-one messages, with "Create task from message" |
| `/team`, `/settings` | Invites, roles and deactivation (admins). Profile, email notification preferences, workspace name |

## Architecture

```
src/
  lib/
    engine.js        # Pure domain engine: every mutation, validation, permissions, notifications
    schemas.js       # Zod input schemas (shared by browser and server)
    selectors.js     # Derived data (unread counts, task groups, meeting buckets, decision log)
    text.js          # @mentions, action-item and day parsing, social link detection
    seed.js          # Sample data (dates relative to today)
    client/          # Storage adapters (demo: localStorage; database: fetch → API) and hooks
    server/          # MongoDB connection, Mongoose models, org-scoped repository (server-only)
  app/               # App Router pages, plus /api/workspace and /api/actions
  components/        # UI primitives, shell, dialogs, chat, task rows, page views
```

**One engine, two storage modes.** `applyAction(snapshot, action, context)` is a pure function. It validates input, enforces permissions (for example, only admins invite or change roles), checks that referenced records exist in the same organization, creates notifications, and returns the new snapshot plus a changeset.

- Demo mode runs the engine in the browser and saves the snapshot to `localStorage`.
- Database mode runs the same engine on the server against a snapshot loaded with `orgId` filters, then persists the changeset with `orgId`-scoped writes.

**Data model.** Users (with `role` and `active`), invites, projects (`phase`, `onHold`, `archived`, `isInternal`), tasks (always with a project, phase and assignee), meetings (agenda, notes and decisions embedded), conversations (`project`, `general` or `dm`), messages, read states and notifications. Action items are tasks with `source: "meeting"` and a `meetingId`. The decision log is a query over meeting decisions. See `macrokite-os-design/DESIGN.md` §4.

### API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/workspace` | Storage mode, plus the workspace snapshot in database mode |
| POST | `/api/actions` | Run one domain action: `{ "type": "task.create", "id"?: "...", "data"?: { ... } }` |

Action types are the keys of the `handlers` map in `src/lib/engine.js`. The server resolves the organization and acting user from its own configuration and never from the request.

Write requests must send `Content-Type: application/json` and may not come from another origin; rejected requests get 415 or 403. Other errors: 400 for validation (with `fieldErrors`), 403 for permission, 404 for missing records, 409 when database mode is off or the database is from an older version, and 503 when the database is unreachable.

## Known limitations

- **No authentication.** One configured identity is used. Invites are recorded but no email is sent, and nobody can accept them yet. There is no "Sign out".
- **Notifications are in-app records only.** Email preferences are saved but no email is sent, including the end-of-meeting summary.
- Database mode loads the organization's snapshot per request and serializes writes per server process. This is fine for a small team, not for large datasets or several server instances.
- Chat updates use polling (database mode) and cross-tab sync (demo mode), not push.
- Profile photos are image links. File uploads are out of scope for v1.
