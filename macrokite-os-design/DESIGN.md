# Macrokite OS: design and build spec

Macrokite OS is a minimal internal hub for the Macrokite team. It replaces scattered tools with one place for project work, meetings and decisions, and team conversation.

This file is the source of truth. The HTML files in `screens/` are visual references: copy their layout, spacing and colors, but build real components (see "About the screen files" at the end).

---

## 1. Product principles

1. **The project is the hub.** Tasks, meetings, decisions, chat and notes all belong to a project. Company-wide work goes in a project called **Internal**.
2. **Phases are the spine.** Every project moves through 7 fixed phases. Progress means "how far along the lifecycle", not a task percentage.
3. **Capture where it happens.** An action item typed in a meeting is a real task. A decision typed in a meeting lands in the project's decision log automatically.
4. **Minimal by default.** No clients, no priority, no custom fields, no kanban boards, no stat cards. Every feature on a page should be something people act on today.
5. **Empty things take no space.** Hide empty panels and empty sections instead of showing "nothing here" boxes.

## 2. Scope

### In v1
- Users with two roles: `admin`, `member`
- Projects with lifecycle phases, an on-hold flag and archiving
- Tasks inside a project and phase (status: todo, doing, done)
- Meetings: agenda, notes, decisions, action items
- Decision log per project (a view over meeting decisions)
- Conversations: project channels, one General channel, direct messages
- Notifications: mentions, task assignment, meeting invites, DMs
- Overview page

### Not in v1
Clients, priority, sales/invoicing, file uploads, reactions, threads, message search, group DMs, kanban board, custom fields, sub-tasks, time tracking, recordings or transcripts, per-agenda-item notes.

## 3. Suggested stack

Next.js (App Router) + TypeScript, MongoDB Atlas, Auth.js, deployed on Vercel. Real-time chat: start with polling every few seconds while a chat is open, switch to Pusher/Ably later without changing the data model.

## 4. Data model

```ts
type Role = "admin" | "member";
type Phase = "idea" | "planning" | "design" | "build" | "test" | "launch" | "maintain";
const PHASES: Phase[] = ["idea","planning","design","build","test","launch","maintain"];

interface User {
  _id: string;
  name: string;
  email: string;           // read-only in Settings, tied to sign-in
  avatarUrl?: string;
  role: Role;
  active: boolean;         // "remove" = deactivate; history is kept
  notificationPrefs: { mention: boolean; assignment: boolean; meetingInvite: boolean; dm: boolean };
  createdAt: Date;
}

interface Invite { _id: string; email: string; invitedBy: string; createdAt: Date; acceptedAt?: Date }

interface Project {
  _id: string;
  name: string;
  description: string;     // one line, shown under the name everywhere
  phase: Phase;
  onHold: boolean;         // a flag, not a phase
  archived: boolean;       // hidden from "All"
  deadline?: Date;
  memberIds: string[];
  notes: string;           // markdown: links, setup info, credentials location
  isInternal?: boolean;    // exactly one project, named "Internal"
  createdAt: Date;
}

interface Task {
  _id: string;
  projectId: string;       // required: no task without a project
  phase: Phase;            // defaults to project's current phase
  title: string;
  assigneeId: string;      // required
  status: "todo" | "doing" | "done";
  dueDate?: Date;
  source: "manual" | "meeting" | "message";
  meetingId?: string;      // set when created as a meeting action item
  messageId?: string;      // set when created via "Create task from message"
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
}

interface Meeting {
  _id: string;
  projectId: string;       // or the Internal project
  title: string;
  startsAt: Date;
  callUrl?: string;
  attendeeIds: string[];
  agenda: { _id: string; title: string; covered: boolean }[];
  notes: string;           // ONE notes field for the whole meeting
  decisions: { _id: string; text: string; createdBy: string; createdAt: Date }[];
  endedAt?: Date;
  createdBy: string;
}
// Action items are not stored on the meeting: they are Tasks with source "meeting" and meetingId.
// The decision log is a query: all meeting.decisions for a projectId, newest first.

interface Conversation {
  _id: string;
  type: "project" | "general" | "dm";
  projectId?: string;      // type "project": auto-created with the project
  memberIds: string[];     // "dm": exactly 2 people; "general": everyone
}

interface Message {
  _id: string;
  conversationId: string;
  authorId: string;
  body: string;            // plain text; links become link cards (see General)
  mentions: string[];      // userIds parsed from @name
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
}

interface ReadState { userId: string; conversationId: string; lastReadAt: Date }

interface Notification {
  _id: string;
  userId: string;
  type: "mention" | "assignment" | "meetingInvite" | "dm";
  targetType: "message" | "task" | "meeting";
  targetId: string;
  readAt?: Date;
  createdAt: Date;
}
```

## 5. Key behaviours

**Phases**
- Order is fixed (see `PHASES`). Shown everywhere as a 7-segment bar: segments before the current phase filled, current phase in the lighter accent, later phases empty.
- On-hold projects show the same bar in greys plus an amber "On hold" pill.
- "Move to <next phase>" on the project page advances the phase. If the current phase has open tasks, warn ("Build still has 3 open tasks") but allow it.

**Tasks**
- Every task has a project, phase, assignee and status. Completing = ticking the checkbox (sets `done` and `completedAt`).
- "Doing" is shown as a small pill only. There is no status dropdown on rows.
- New tasks default: assignee = me, phase = project's current phase.

**Meetings**
- Page order: basics → "still open from last meeting" banner (only if any) → Agenda → Notes → Decisions → Action items.
- The banner lists undone tasks whose `meetingId` is the previous meeting of the same project.
- Action items are typed as one line: `Task title @name day` (e.g. `Create prod database @Alex fri`). Parse `@name` against project members and the day/date into `dueDate`; if parsing fails, ask for the missing part inline.
- **End meeting:** set `endedAt`, notify each assignee once with a batched summary ("You got 2 action items from Jajabor weekly sync"), and email attendees a summary of decisions + action items.

**Conversations**
- Each project automatically gets a channel, shown in the project's Chat tab (not in the sidebar).
- General is a single team-wide channel in the sidebar. Pasted Facebook/Instagram links render as link cards (platform, title, "Open post"). Embeds are optional; never rely on them.
- Messages = 1-to-1 DMs only.
- Unread = messages newer than `ReadState.lastReadAt`. `@mention` creates a Notification and highlights the name.
- "Create task from message" creates a Task with `source: "message"`.

**Team**
- Admins invite by email, change roles, deactivate. You cannot change your own role.

## 6. Navigation

Sidebar (fixed order, separators between groups):

1. Overview
2. Projects (badge: total unread across project chats)
3. Meetings
4. My tasks (count of open tasks, muted)
5. — # General (unread badge)
6. — Messages (unread badge)
7. — Team, Settings

Routes suggestion: `/`, `/projects`, `/projects/[id]?tab=tasks|chat|meetings|decisions|notes`, `/meetings`, `/meetings/[id]`, `/tasks`, `/general`, `/messages/[userId]`, `/team`, `/settings`.

## 7. Screens

Reference file in brackets.

### Overview `[01-overview.html]`
- Header: date, "Good morning, <name>", one summary line (overdue in red, meetings today, unread count).
- Grid of panels (2 columns, stacks on mobile): **My tasks** (top 3 by urgency, checkbox to complete), **Unread** (three collapsible groups: Projects, General, Messages; each heading shows its count; remember collapsed state per user), **Meetings today**, **Recent decisions** (last 3 across my projects).
- Full width: **My projects** (projects I'm a member of, sorted by deadline, with phase bar and deadline).
- Cap each list at 3–5 items with a link to the full page. Hide a panel when it's empty.

### Projects `[02-projects-table.html, 03-projects-cards.html]`
- Header: "8 active · 1 on hold · 1 past deadline", "+ New project".
- Search + Cards/Table toggle.
- Filter tabs: All, Idea, Planning, Design, Build, Test, Launch, Maintain, then (spaced apart) On hold, Archived. Each with a count. Archived is excluded from All.
- Table columns: Project (name + description, on-hold pill) · Phase (name, n/7, 7-segment bar) · Deadline (red when past) · Team (avatars) · Unread chat count.
- Card: name, on-hold pill, description, phase + bar, footer with deadline text ("Due Nov 30" / "Past deadline · Oct 8" / "No deadline"), unread count, avatars. Past-deadline cards get a red border.

### Project page `[04-project.html]`
- Breadcrumb Projects / <name>. Header: name, description, "Due <date> · <members>", Edit and "+ Add task".
- Phase card: "Phase 4 of 7 · Build", "6 of 9 Build tasks done", "Move to Test →", 7 labelled segments.
- Tabs: Tasks (count) · Chat (unread badge) · Meetings · Decisions · Notes.
- Tasks tab: current phase section expanded (open tasks, "Show n done"), other phases as collapsed rows with counts.
- Footer actions: "Put on hold", "Archive". No delete.

### My tasks `[05-my-tasks.html]`
- Groups: Overdue (red outline), Today, This week, Later, No due date. Completed collapsed at the bottom ("Completed this week · n").
- Controls: search + project filter only.
- Row: checkbox · title (+ "Doing" pill) · "Project · Phase" (+ "from <meeting>, <date>" link for action items) · due.

### Meetings `[06-meetings.html]`
- Header: "2 today · 3 this week · 4 open action items", "+ New meeting".
- Upcoming list (time, title, project, agenda count, open items, avatars). Past list with outcomes ("2 decisions · 3 action items").

### Meeting detail `[07-meeting.html]`
- See Meetings behaviour above. Agenda = checklist of topics with an inline "Add a topic". Decisions in a green block. Action items one line each with "Name · day".
- Footer hint explains what End meeting does.

### General `[08-general.html]`
- Header "# General", "Whole team · announcements, news, memes and posts", member count.
- Day dividers, messages with avatar, name, time. Link cards for FB/Instagram. Mentions highlighted.
- Composer with hint: "Paste a Facebook or Instagram link to share a post · @ to mention someone".

### Messages `[09-messages.html]`
- Two panes: conversation list (search people, "+" new message, unread badges) and open conversation (bubbles: mine right in accent tint, theirs left).
- "Create task from message" action on a message.

### Team `[10-team.html]`
- "+ Invite member". Table: member (avatar, name, email) · role (badge for me, dropdown for others, admin only) · working on (project names) · Message link. Pending invite row with "Resend".
- Note: removing someone deactivates their account; history stays.

### Settings `[11-settings.html]`
- Profile (photo, name, email read-only) · Email notifications (4 toggles; in-app always on) · Workspace (admins only: name, lifecycle phases shown read-only) · Sign out, Save changes.

## 8. Visual design

Dark UI. Full tokens in `tokens.css`.

- **Font:** Geist (UI) and Geist Mono (dates, times, counts like 4/7). Google Fonts.
- **Sizes:** page title 28px/600, section title 14–16px/600, body 14px, meta 12–13px, group labels 11–12px uppercase with 0.06em tracking.
- **Surfaces:** page `#0b0c0e`, sidebar `#0e1012`, cards `#121417`, inputs `#0e1012`, hover/selected `#1a1d21`/`#1f2226`.
- **Borders:** `#24272c` default, `#1c1f23` row dividers.
- **Text:** `#e7e8ea` primary, `#a7abb3` secondary, `#8a8f98` muted, `#6f747c` faint.
- **Accent (teal):** `#3fe0b5` primary/buttons/badges (text on it `#062a20`), `#8af0d3` light accent, `#0f2e27` accent tint, `#0d1f1b` decision block bg with `#1f4a3f` border.
- **Status:** danger `#ff8f7a` (overdue, past deadline; border `#4a2a25`), warning `#ffd7a1` on `#33260f` (on hold, pending; banner bg `#17140d`, border `#3d3218`).
- **Radius:** 8px controls, 10px tab groups, 12px cards, pills 10px.
- **Spacing:** page padding 48px 32px, card padding 18–20px, row padding 12–16px × 18px, gaps 16–24px between blocks.
- **Hit targets:** at least 44px for buttons and inputs.
- **Avatars:** initials in circles, 28px in lists (overlapping by 8px), 36px in chat. Per-person tint (e.g. teal, violet, amber).
- **Layout:** sidebar 220–260px, content max-width 760–1040px centred. Everything stacks at phone width (sidebar on top, grids to one column, wide tables scroll inside their card).
- No gradients, no emoji, no stat cards. Icons: simple outline icons (e.g. lucide).

## 9. Build order

1. Auth, users, roles, invites (Team + Settings)
2. Projects, phases, Internal project (Projects list + project page shell)
3. Tasks (project Tasks tab + My tasks)
4. Meetings, decisions, action items (Meetings + meeting page + decision log)
5. Conversations: project chat, General, Messages, unread state
6. Notifications + Overview

## About the screen files

`screens/*.html` were made in a design canvas. They use a small template syntax you should translate, not copy:

- `{{value}}` = data binding. The sample data and derived styles are in the `<script type="text/x-dc">` block at the bottom (`renderVals()`).
- `<sc-for list="{{items}}" as="item">` = a loop; `<sc-if value="{{cond}}">` = a conditional.
- `<x-dc>`, `<helmet>` and `support.js` belong to the canvas runtime; ignore them.
- Inline styles hold the exact colors and spacing; move them into Tailwind classes or CSS modules using `tokens.css`.
- Names and data in the screens are samples.
