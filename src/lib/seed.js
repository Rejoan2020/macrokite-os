import { COMPANY_PROJECT, DEFAULT_NOTIFICATION_PREFS } from "./constants";
import { addDaysISO, todayISO } from "./format";
import { readStateId } from "./selectors";

// Fictional, interconnected demo data for the Macrokite workspace.
// Dates are generated relative to `now` so deadlines, meetings and chat always look current.

export const SEED_ORG_ID = "org_macrokite";
export const SEED_OWNER_ID = "usr_alex";
export const SCHEMA_VERSION = 2;

export function buildSeed(now = new Date()) {
  const orgId = SEED_ORG_ID;
  const today = todayISO(now);
  const day = (offset) => addDaysISO(today, offset);
  /** A moment `offset` days from today at a local clock time (may be in the future). */
  const on = (offset, hour, minute = 0) => {
    const d = new Date(`${day(offset)}T00:00:00`);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  /** A moment `minutes` before now: keeps "today" chat in order whatever the time of day. */
  const ago = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const created = on(-120, 9);

  const org = { _id: orgId, name: "Macrokite", slug: "macrokite", schemaVersion: SCHEMA_VERSION, createdAt: created, updatedAt: created };

  const user = (_id, name, email, role, avatarColor) => ({
    _id, orgId, name, email, role, avatarColor, avatarUrl: "", active: true, notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS }, createdAt: created, updatedAt: created,
  });
  const users = [
    user("usr_alex", "Alex Morgan", "alex@macrokite.dev", "admin", "teal"),
    user("usr_sara", "Sara Rahman", "sara@macrokite.dev", "member", "violet"),
    user("usr_tanvir", "Tanvir Karim", "tanvir@macrokite.dev", "member", "amber"),
    user("usr_nadia", "Nadia Hossain", "nadia@macrokite.dev", "member", "blue"),
  ];
  const everyone = users.map((u) => u._id);
  const [A, S, T, N] = everyone;

  const invites = [{ _id: "inv_rafi", orgId, email: "rafi@macrokite.dev", invitedBy: A, createdAt: on(-2, 10), sentAt: on(-2, 10), acceptedAt: null }];

  const project = (_id, name, description, phase, deadline, memberIds, extra = {}) => ({
    _id, orgId, name, description, phase, deadline: deadline === null ? "" : day(deadline), memberIds, notes: "",
    onHold: false, archived: false, isInternal: false, createdBy: A, createdAt: created, updatedAt: created, ...extra,
  });
  const projects = [
    project("prj_fleet", "Fleet Tracker MVP", "Dispatcher dashboard with live vehicle positions and delivery exceptions.", "build", -6, [A], { onHold: true }),
    project("prj_jajabor", "Jajabor", "Travel planning app for domestic trips in Bangladesh.", "build", 47, [A, S, T], {
      notes:
        "Repo: https://github.com/macrokite/jajabor\nStaging: https://staging.jajabor.app\nDesign: https://www.figma.com/file/jajabor\n\nDatabase on MongoDB Atlas (one cluster, dev and prod databases). Credentials live in the team password manager, not here.",
    }),
    project("prj_storefront", "Storefront Relaunch", "New product pages, checkout and a seasonal campaign page.", "test", 3, [A, S]),
    project("prj_portal", "Patient Portal v2", "Appointment booking, secure documents and a new sign-in flow.", "launch", 11, [A, S]),
    project("prj_lumen", "Analytics Dashboard Redesign", "Information architecture, component library and high-fidelity designs.", "design", 24, [S]),
    project("prj_site", "Macrokite Website", "Our studio site: services, case studies and contact flow.", "build", 29, [S, N]),
    project("prj_billing", "Subscription Billing Flow", "Pause and skip, a billing portal and payment reminder emails.", "planning", 44, [A, T]),
    project("prj_migration", "Website Migration", "Content moved and redirects live; now monitoring.", "maintain", null, [A, S]),
    project("prj_internal", COMPANY_PROJECT, "Company-wide work: hiring, operations, tooling and team rituals.", "maintain", null, everyone, {
      isInternal: true,
      notes: "Team handbook: https://macrokite.notion.site/handbook\nFridays are no-meeting days.",
    }),
    project("prj_popup", "Coffee Pop-up Site", "One-page site for a weekend coffee pop-up.", "maintain", -60, [S], { archived: true }),
    project("prj_quill", "Quill Legal Site", "Marketing site migration to a modern CMS.", "maintain", -90, [A, S], { archived: true }),
  ];

  const meeting = (_id, projectId, title, startsAt, attendeeIds, extra = {}) => ({
    _id, orgId, projectId, title, startsAt, callUrl: "", attendeeIds, agenda: [], notes: "", decisions: [], endedAt: null,
    createdBy: A, createdAt: created, updatedAt: created, ...extra,
  });
  const topic = (_id, title, covered = false) => ({ _id, title, covered });
  const decision = (_id, text, at, by = A) => ({ _id, text, createdBy: by, createdAt: at });
  const meetings = [
    meeting("mtg_jaj_prev", "prj_jajabor", "Jajabor weekly sync", on(-7, 15), [A, S, T], {
      agenda: [topic("agd_1", "Trip data model", true), topic("agd_2", "Database hosting", true)],
      notes: "Agreed to keep one Atlas cluster for now and revisit before launch.",
      decisions: [decision("dec_1", "One Atlas cluster with separate dev and prod databases until launch", on(-7, 15, 40))],
      endedAt: on(-7, 15, 45),
    }),
    meeting("mtg_jaj_today", "prj_jajabor", "Jajabor weekly sync", on(0, 15), [A, S, T], {
      callUrl: "https://meet.google.com/abc-defg-hij",
      agenda: [topic("agd_3", "Database setup"), topic("agd_4", "Ready to move to Test?")],
    }),
    meeting("mtg_fleet_today", "prj_fleet", "Fleet Tracker phase review", on(0, 17, 30), [A, S]),
    meeting("mtg_team_next", "prj_internal", "Team weekly", on(2, 15), everyone),
    meeting("mtg_team_prev", "prj_internal", "Team meeting", on(-2, 11), everyone, {
      agenda: [topic("agd_5", "Tooling", true), topic("agd_6", "Launch reviews", true)],
      decisions: [
        decision("dec_2", "Fridays are no-meeting days", on(-2, 11, 20)),
        decision("dec_3", `Company-wide work goes in the ${COMPANY_PROJECT} project`, on(-2, 11, 30)),
      ],
      endedAt: on(-2, 11, 50),
    }),
    meeting("mtg_portal_review", "prj_portal", "Launch readiness review", on(-2, 14), [A, S], {
      decisions: [decision("dec_4", "Launch waits for the compliance sign-off on document access", on(-2, 14, 30), S)],
      endedAt: on(-2, 14, 45),
    }),
    meeting("mtg_billing_kickoff", "prj_billing", "Billing flow kickoff", on(-9, 10), [A, T], {
      decisions: [
        decision("dec_5", "Ship billing in two releases", on(-9, 10, 20)),
        decision("dec_6", "Use Stripe Billing for v1", on(-9, 10, 30)),
        decision("dec_7", "Pause and skip come before plan swaps", on(-9, 10, 40), T),
      ],
      endedAt: on(-9, 11),
    }),
  ];

  const task = (_id, projectId, phase, title, assigneeId, status, due, extra = {}) => ({
    _id, orgId, projectId, phase, title, assigneeId, status, priority: due !== null && due < 0 && status !== "done" ? "high" : due === null ? "low" : "medium",
    dueDate: due === null ? "" : day(due), source: "manual", meetingId: null, messageId: null,
    completedAt: status === "done" ? on(-20, 16) : null, createdBy: A, createdAt: created, updatedAt: created, ...extra,
  });
  const fromMeeting = (meetingId) => ({ source: "meeting", meetingId });
  const doneOn = (offset) => ({ completedAt: on(offset, 16) });
  const tasks = [
    // Fleet Tracker MVP (on hold)
    task("tsk_f1", "prj_fleet", "build", "Telematics vendor API spike", A, "todo", -3),
    task("tsk_f2", "prj_fleet", "build", "Dispatcher map prototype", A, "done", -30),
    task("tsk_f3", "prj_fleet", "design", "Dispatcher dashboard wireframes", S, "done", -50),
    // Jajabor (Build)
    task("tsk_j1", "prj_jajabor", "build", "Share Atlas connection setup", A, "doing", 0, fromMeeting("mtg_jaj_prev")),
    task("tsk_j2", "prj_jajabor", "build", "Draft trip data model", S, "todo", -3, fromMeeting("mtg_jaj_prev")),
    task("tsk_j3", "prj_jajabor", "build", "Booking screen with date picker", T, "todo", 8),
    task("tsk_j4", "prj_jajabor", "build", "Set up Next.js project and CI", A, "done", -20),
    task("tsk_j5", "prj_jajabor", "build", "Sign-in with email links", A, "done", -14, doneOn(-1)),
    task("tsk_j6", "prj_jajabor", "build", "Trip list screen", T, "done", -10),
    task("tsk_j7", "prj_jajabor", "build", "Destination seed data", S, "done", -9),
    task("tsk_j8", "prj_jajabor", "build", "Map component spike", T, "done", -6),
    task("tsk_j9", "prj_jajabor", "build", "Image upload to storage", A, "done", -4, doneOn(0)),
    task("tsk_j10", "prj_jajabor", "test", "Test plan for the booking flow", S, "todo", 20),
    task("tsk_j11", "prj_jajabor", "test", "Device testing on Android", T, "todo", 25),
    task("tsk_j12", "prj_jajabor", "design", "Booking flow wireframes", S, "done", -30),
    task("tsk_j13", "prj_jajabor", "design", "Visual design for trip pages", S, "done", -26),
    task("tsk_j14", "prj_jajabor", "design", "Icon set", T, "done", -24),
    task("tsk_j15", "prj_jajabor", "planning", "Scope v1 destinations", A, "done", -40),
    task("tsk_j16", "prj_jajabor", "planning", "Pick the tech stack", A, "done", -38),
    task("tsk_j17", "prj_jajabor", "idea", "Interview five frequent travellers", S, "done", -55),
    // Storefront Relaunch (Test)
    task("tsk_s1", "prj_storefront", "test", "Checkout payment test pass", A, "todo", 1),
    task("tsk_s2", "prj_storefront", "test", "Cross-browser QA on Safari iOS", S, "doing", 2),
    task("tsk_s3", "prj_storefront", "build", "Product detail page", A, "done", -8),
    task("tsk_s4", "prj_storefront", "build", "Campaign landing page", S, "done", -5),
    // Patient Portal v2 (Launch)
    task("tsk_p1", "prj_portal", "launch", "Write release notes", A, "todo", 4),
    task("tsk_p2", "prj_portal", "launch", "Add audit log to the launch demo", S, "todo", 6, fromMeeting("mtg_portal_review")),
    task("tsk_p3", "prj_portal", "test", "Accessibility audit of booking flow", S, "done", -4, doneOn(-1)),
    // Analytics Dashboard Redesign (Design)
    task("tsk_l1", "prj_lumen", "design", "Dashboard wireframes v2", S, "doing", 1),
    task("tsk_l2", "prj_lumen", "design", "Component library: tables and filters", S, "todo", 10),
    // Macrokite Website (Build)
    task("tsk_w1", "prj_site", "build", "Services page copy", N, "todo", 5),
    task("tsk_w2", "prj_site", "build", "Write Quill Legal case study", S, "todo", 12),
    // Subscription Billing Flow (Planning)
    task("tsk_b1", "prj_billing", "planning", "Map subscription states and edge cases", A, "todo", 2, fromMeeting("mtg_billing_kickoff")),
    task("tsk_b2", "prj_billing", "planning", "Evaluate billing provider limits", A, "todo", 13, fromMeeting("mtg_billing_kickoff")),
    task("tsk_b3", "prj_billing", "planning", "Draft pricing page outline", T, "todo", 6, fromMeeting("mtg_billing_kickoff")),
    task("tsk_b4", "prj_billing", "planning", "Collect payment reminder email examples", T, "done", -5, fromMeeting("mtg_billing_kickoff")),
    // Website Migration (Maintain)
    task("tsk_m1", "prj_migration", "maintain", "Check 404 report", S, "todo", null),
    // Internal
    task("tsk_i1", "prj_internal", "planning", "Draft agenda for launch reviews", A, "todo", 3, fromMeeting("mtg_team_prev")),
    task("tsk_i2", "prj_internal", "maintain", "Write onboarding guide for new members", A, "todo", null),
    task("tsk_i3", "prj_internal", "maintain", "Set up the shared password manager", T, "todo", 5, fromMeeting("mtg_team_prev")),
    task("tsk_i4", "prj_internal", "maintain", "Renew domain names", N, "done", -1, { ...fromMeeting("mtg_team_prev"), ...doneOn(-1) }),
  ];

  const conversations = [
    { _id: "cnv_general", orgId, type: "general", projectId: null, memberIds: everyone, createdAt: created },
    ...projects.map((p) => ({ _id: `cnv_${p._id.slice(4)}`, orgId, type: "project", projectId: p._id, memberIds: p.memberIds, createdAt: created })),
    { _id: "cnv_dm_sara", orgId, type: "dm", projectId: null, memberIds: [A, S], createdAt: created },
    { _id: "cnv_dm_tanvir", orgId, type: "dm", projectId: null, memberIds: [A, T], createdAt: created },
    { _id: "cnv_dm_nadia", orgId, type: "dm", projectId: null, memberIds: [A, N], createdAt: created },
  ];

  const messages = [];
  const say = (conversationId, authorId, createdAt, body, mentions = []) =>
    messages.push({ _id: `msg_${messages.length + 1}`, orgId, conversationId, authorId, body, mentions, editedAt: null, deletedAt: null, createdAt });

  say("cnv_general", A, on(-1, 16, 12), "Office will be closed Friday for the holiday. Weekly sync moves to Thursday 3 PM.");
  say("cnv_general", S, ago(150), "This is literally us before every deploy https://www.instagram.com/p/C8xYz12AbCd/");
  say("cnv_general", T, ago(126), "Good read on why small teams should ship weekly. @Alex worth a look for Jajabor. https://www.facebook.com/macrokite/posts/1234567890", [A]);
  say("cnv_general", N, ago(70), "Lunch order goes out at 12:30, reply here if you want in.");
  say("cnv_general", S, ago(66), "Count me in.");

  say("cnv_jajabor", A, on(-1, 10, 5), "Pushed the email sign-in to staging, give it a try.");
  say("cnv_jajabor", T, on(-1, 10, 40), "Works on my phone. Starting the booking screen next.");
  say("cnv_jajabor", S, ago(200), "Data model draft is up in the notes, needs a look before the sync.");
  say("cnv_jajabor", T, ago(186), "Booking screen is half done, date picker next.");

  say("cnv_portal", A, on(-2, 15), "Launch review notes are in the meeting.");
  say("cnv_portal", S, ago(300), "Compliance asked for the audit log in the launch demo, adding it to the release notes.");

  say("cnv_storefront", S, on(-1, 12), "Safari QA starts tomorrow morning.");

  say("cnv_dm_sara", S, ago(260), "Morning! Are you joining the Jajabor sync at 3?");
  say("cnv_dm_sara", A, ago(255), "Yes, I’ll be there. I’ll bring the Atlas notes.");
  say("cnv_dm_sara", S, ago(245), "Perfect. Can you check the Atlas user before then? I think the password expired.");
  say("cnv_dm_nadia", A, on(-3, 11), "Sent you the brand guidelines for the site.");
  say("cnv_dm_nadia", N, on(-3, 11, 20), "Thanks, got it");
  say("cnv_dm_tanvir", T, ago(40), "Lunch at 1?");

  // Alex has read everything except today's General, Jajabor and Portal chat and Tanvir's DM.
  const read = (conversationId, lastReadAt) => ({ _id: readStateId(conversationId, A), orgId, userId: A, conversationId, lastReadAt });
  const readStates = conversations.map((c) => read(c._id, now.toISOString()));
  const lastRead = { cnv_general: on(-1, 17), cnv_jajabor: on(-1, 11), cnv_portal: on(-2, 16), cnv_dm_tanvir: on(-3, 9), cnv_dm_sara: ago(240) };
  for (const r of readStates) if (lastRead[r.conversationId]) r.lastReadAt = lastRead[r.conversationId];

  const notifications = [
    { _id: "ntf_1", orgId, userId: A, type: "mention", targetType: "message", targetId: "msg_3", text: null, readAt: null, createdAt: messages[2].createdAt },
    { _id: "ntf_2", orgId, userId: A, type: "dm", targetType: "message", targetId: messages.at(-1)._id, text: null, readAt: null, createdAt: messages.at(-1).createdAt },
  ];

  return { org, users, invites, projects, tasks, meetings, conversations, messages, readStates, notifications };
}
