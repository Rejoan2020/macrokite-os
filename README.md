# Macrokite OS

A minimal internal hub for the Macrokite team: project work, meetings and decisions, and team conversation in one place.

- **The project is the hub.** Tasks, meetings, decisions, chat and notes all belong to a project. Company-wide work goes in the **Internal** project.
- **Phases are the spine.** Every project moves through seven fixed phases: Idea, Planning, Design, Build, Test, Launch, Maintain.
- **Capture where it happens.** An action item typed in a meeting is a real task, and a decision typed in a meeting lands in the project's decision log.

The design spec and screen references live in [`macrokite-os-design/`](macrokite-os-design/DESIGN.md).

> **Status: MVP with sign-in.** Database mode requires signing in (WorkOS: Google or email + password), and each account only sees its own workspace. Invite emails are sent by WorkOS; other email (notifications, meeting summaries), rate limiting and security headers are still to do before a public launch.

## Quick start

Requirements: Node.js 20.9+ (tested with Node 24) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

With no configuration the app starts in **demo mode**: a sample workspace is seeded into your browser's `localStorage`. Changes survive refreshes but stay in that browser. Reset it from the bottom of **Settings**.

### Database mode (MongoDB + sign-in)

1. **MongoDB.** Use a local server or a MongoDB Atlas cluster.
2. **WorkOS.** Create a free account at [dashboard.workos.com](https://dashboard.workos.com), then:
   - Under **Authentication**, turn on **Google OAuth** and **Email + Password**.
   - Under **Redirects**, add the redirect URI `http://localhost:3000/auth/callback`, set the sign-in endpoint (initiate login URI) and the **User invitation URL** to `http://localhost:3000/auth/sign-in`, and set the sign-out redirect to `http://localhost:3000/`. In production use your app URL instead; each of these takes one URL, so point them at production.
   - Copy the client ID and API key.
3. **Configure** `.env.local`:

```bash
cp .env.example .env.local
# MONGODB_URI=mongodb://127.0.0.1:27017
# MONGODB_DB=macrokite_os
# WORKOS_CLIENT_ID=client_...
# WORKOS_API_KEY=sk_test_...
# WORKOS_COOKIE_PASSWORD=<openssl rand -base64 32>
# NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
# MACROKITE_WORKSPACE_CREATORS=you@yourcompany.com
npm run dev
```

4. **Sign in** with the email listed in `MACROKITE_WORKSPACE_CREATORS` and create your workspace; you become its admin. Invite teammates from **Team**. WorkOS emails them a link, and they join the first time they sign up or sign in with the invited email.

How accounts map to workspaces:

- Every page and API call needs a signed-in account. Signed-out visitors are sent to sign-in, and the API answers 401.
- A member record is linked to the sign-in account on first sign-in, matched by **verified** email. After that, only that account can use it.
- Workspace data is always scoped by the member's organization. Removed (deactivated) members lose access straight away.
- An admin can then delete a removed member permanently. Their profile is erased and their history shows "Former member". The record keeps only their email, so inviting that email again brings back the same member with their history.
- Someone with no workspace and no invite sees a "not on a team yet" screen. Only emails in `MACROKITE_WORKSPACE_CREATORS` can create workspaces; set it to `*` for open sign-up.
- If MongoDB is configured but the WorkOS settings are missing, the app refuses to serve data rather than running without sign-in. If the database is unreachable, it shows an error with a retry button.

Database mode no longer seeds sample data. A database created by an earlier version of the app is not migrated: point `MONGODB_DB` at a new database, or drop the old one.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Enables database mode. Server-only; never sent to the browser. |
| `MONGODB_DB` | Optional database name. |
| `WORKOS_CLIENT_ID`, `WORKOS_API_KEY` | WorkOS application credentials. |
| `WORKOS_COOKIE_PASSWORD` | 32+ character secret that encrypts the session cookie. |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Sign-in callback, `<app url>/auth/callback`. Must be added in WorkOS. |
| `MACROKITE_WORKSPACE_CREATORS` | Emails allowed to create workspaces (comma-separated), or `*`. Empty means nobody. |

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
| `/team`, `/settings` | Invites, roles, removing and deleting members (admins). Profile, email notification preferences, workspace name |

## Architecture

```
src/
  lib/
    engine.js        # Pure domain engine: every mutation, validation, permissions, notifications
    schemas.js       # Zod input schemas (shared by browser and server)
    selectors.js     # Derived data (unread counts, task groups, meeting buckets, decision log)
    text.js          # @mentions, action-item and day parsing, social link detection
    seed.js          # Sample data (dates relative to today)
    membership.js    # Sign-in account → member rules, new workspaces
    client/          # Storage adapters (demo: localStorage; database: fetch → API) and hooks
    server/          # MongoDB, Mongoose models, sign-in check, org-scoped repository (server-only)
  proxy.js           # Refreshes the WorkOS session; sends signed-out visitors to sign-in
  app/               # App Router pages, /auth/* sign-in routes, /api/workspace and /api/actions
  components/        # UI primitives, shell, dialogs, chat, task rows, page views
```

**One engine, two storage modes.** `applyAction(snapshot, action, context)` is a pure function. It validates input, enforces permissions (for example, only admins invite or change roles), checks that referenced records exist in the same organization, creates notifications, and returns the new snapshot plus a changeset.

- Demo mode runs the engine in the browser and saves the snapshot to `localStorage`.
- Database mode runs the same engine on the server against a snapshot loaded with `orgId` filters, then persists the changeset with `orgId`-scoped writes.

**Data model.** Users (with `role` and `active`), invites, projects (`phase`, `onHold`, `archived`, `isInternal`), tasks (always with a project, phase and assignee), meetings (agenda, notes and decisions embedded), conversations (`project`, `general` or `dm`), messages, read states and notifications. Action items are tasks with `source: "meeting"` and a `meetingId`. The decision log is a query over meeting decisions. See `macrokite-os-design/DESIGN.md` §4.

### API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/workspace` | Storage mode. In database mode: the signed-in account, plus the workspace snapshot (`status: "member"`) or `status: "onboarding"` |
| POST | `/api/workspace` | Create a workspace: `{ "name": "..." }` (only for `MACROKITE_WORKSPACE_CREATORS`) |
| POST | `/api/actions` | Run one domain action: `{ "type": "task.create", "id"?: "...", "data"?: { ... } }` |

Action types are the keys of the `handlers` map in `src/lib/engine.js`. The server resolves the organization and acting member from the signed-in session, never from the request body.

Write requests must send `Content-Type: application/json` and may not come from another origin; rejected requests get 415 or 403. Other errors: 401 when signed out, 400 for validation (with `fieldErrors`), 403 for permission, 404 for missing records, 409 when database mode is off or the database is from an older version, and 503 when the database is unreachable.

## Known limitations

- **Only invites send email**, through WorkOS and its email template. If WorkOS can't send one, the invite is still saved, the admin sees a warning, and that person still joins by signing in with the invited email.
- **One workspace at a time.** Someone in several workspaces opens the oldest one; there is no workspace switcher yet.
- **Notifications are in-app records only.** Email preferences are saved but no email is sent, including the end-of-meeting summary.
- Database mode loads the organization's snapshot per request and serializes writes per server process. This is fine for a small team, not for large datasets or several server instances.
- Chat updates use polling (database mode) and cross-tab sync (demo mode), not push.
- Profile photos are image links. File uploads are out of scope for v1.
