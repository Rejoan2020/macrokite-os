import { DEFAULT_PREFERENCES } from "./constants";
import { todayISO } from "./selectors";

// Fictional, interconnected demo data for the MacroKite workspace.
// Dates are generated relative to `now` so deadlines and activity always look current.

export const SEED_ORG_ID = "org_macrokite";
export const SEED_OWNER_ID = "usr_alex";

export function buildSeed(now = new Date()) {
  const orgId = SEED_ORG_ID;
  const day = (offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return todayISO(d);
  };
  const at = (daysAgo, hour = 10, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    if (d > now) d.setTime(now.getTime() - 60_000 * (minute + 5));
    return d.toISOString();
  };

  const org = {
    _id: orgId,
    name: "MacroKite",
    slug: "macrokite",
    description: "Independent software studio building web platforms and internal tools for growing companies.",
    preferences: { ...DEFAULT_PREFERENCES },
    createdAt: at(120),
    updatedAt: at(120),
  };

  const users = [
    { _id: "usr_alex", name: "Alex Morgan", email: "alex@macrokite.dev", title: "Founder & Lead Engineer", bio: "Full-stack engineer. Owns architecture, delivery and client relationships.", timezone: "Europe/London", avatarColor: "teal", createdAt: at(120) },
    { _id: "usr_sam", name: "Sam Rivera", email: "sam@macrokite.dev", title: "Product Designer", bio: "Leads discovery, UX and design systems across client work.", timezone: "Europe/Lisbon", avatarColor: "violet", createdAt: at(118) },
  ];

  const memberships = [
    { _id: "mem_alex", orgId, userId: "usr_alex", role: "owner", joinedAt: at(120) },
    { _id: "mem_sam", orgId, userId: "usr_sam", role: "admin", joinedAt: at(118) },
  ];

  const client = (_id, name, company, email, phone, status, service, notes, created) => ({
    _id, orgId, name, company, email, phone, status, service, notes, createdBy: "usr_alex", createdAt: at(created), updatedAt: at(Math.max(created - 5, 1)),
  });
  const clients = [
    client("cli_northwind", "Priya Shah", "Northwind Health", "priya.shah@northwindhealth.example", "+44 20 7946 0123", "active", "Patient portal rebuild and ongoing platform maintenance.", "Prefers a written summary after every review call. Budget approved through Q4; monthly retainer for maintenance.", 95),
    client("cli_harbor", "Daniel Okafor", "Harbor & Pine Coffee", "daniel@harborandpine.example", "+1 503 555 0142", "active", "Headless storefront relaunch and coffee subscription flow.", "Seasonal launch is hard-dated. Daniel handles product photos; marketing contact is Jo (cc on launch emails).", 60),
    client("cli_lumen", "Mei Tanaka", "Lumen Analytics", "mei.tanaka@lumenanalytics.example", "", "active", "UX redesign of the customer analytics dashboard.", "Design-led engagement. Weekly async feedback via shared Figma file.", 40),
    client("cli_brightpath", "Carlos Mendes", "BrightPath Learning", "carlos@brightpath.example", "+351 21 555 0199", "lead", "Mobile app for cohort-based course delivery.", "Referred by Northwind. Wants fixed-price proposal for phase one.", 9),
    client("cli_atlas", "Hannah Becker", "Atlas Freight", "h.becker@atlasfreight.example", "+49 30 555 0177", "paused", "Internal fleet-tracking tool for dispatchers.", "Paused while Atlas finalises their telematics vendor. Revisit next quarter.", 110),
    client("cli_quill", "Omar Haddad", "Quill Legal", "omar.haddad@quilllegal.example", "", "completed", "Marketing site migration to a modern CMS.", "Delivered on time. Good candidate for a case study.", 150),
  ];

  const project = (_id, clientId, name, description, status, priority, start, deadline, memberIds, created) => ({
    _id, orgId, clientId, name, description, status, priority, startDate: day(start), deadline: day(deadline), memberIds, createdBy: "usr_alex", createdAt: at(created), updatedAt: at(Math.max(created - 3, 1)),
  });
  const projects = [
    project("prj_portal", "cli_northwind", "Patient Portal v2", "Rebuild of the patient-facing portal: appointment booking, secure document access and a new authentication flow.", "in_progress", "high", -40, 12, ["usr_alex", "usr_sam"], 42),
    project("prj_storefront", "cli_harbor", "Storefront Relaunch", "Headless commerce storefront with new product pages, checkout and seasonal campaign landing page.", "in_progress", "urgent", -20, 4, ["usr_alex", "usr_sam"], 22),
    project("prj_subscriptions", "cli_harbor", "Subscription Billing Flow", "Recurring coffee subscriptions with pause/skip, billing portal and dunning emails.", "planning", "medium", 6, 45, ["usr_alex"], 6),
    project("prj_lumen", "cli_lumen", "Analytics Dashboard Redesign", "Information architecture, component library and high-fidelity designs for the analytics dashboard.", "in_progress", "medium", -15, 25, ["usr_sam"], 16),
    project("prj_brightpath", "cli_brightpath", "Discovery & Proposal", "Two-week discovery to scope the BrightPath mobile app and deliver a fixed-price proposal.", "planning", "medium", -3, 10, ["usr_alex", "usr_sam"], 4),
    project("prj_atlas", "cli_atlas", "Fleet Tracker MVP", "Dispatcher dashboard with live vehicle positions and delivery exceptions.", "on_hold", "low", -70, -5, ["usr_alex"], 72),
    project("prj_quill", "cli_quill", "Website Migration", "Content migration, redirects and new page templates for quilllegal.example.", "completed", "medium", -100, -35, ["usr_alex", "usr_sam"], 102),
    project("prj_site", null, "MacroKite Website", "Our own studio website: services, case studies and contact flow.", "in_progress", "low", -10, 30, ["usr_sam"], 11),
  ];

  let order = 0;
  const task = (_id, projectId, title, status, priority, assigneeId, due, labels = [], description = "", created = 10) => ({
    _id, orgId, projectId, title, description, status, priority, assigneeId, dueDate: due === null ? "" : day(due), labels, order: ++order, createdBy: "usr_alex",
    completedAt: status === "done" ? at(Math.max(created - 3, 0), 16) : null, createdAt: at(created), updatedAt: at(Math.max(created - 2, 0), 15),
  });
  const tasks = [
    // Patient Portal v2
    task("tsk_p1", "prj_portal", "Migrate authentication to passwordless magic links", "in_progress", "high", "usr_alex", 3, ["backend", "security"], "Replace legacy password login with email magic links. Keep a fallback for staff accounts.", 20),
    task("tsk_p2", "prj_portal", "Appointment booking: calendar availability API", "in_review", "high", "usr_alex", 1, ["backend"], "Expose clinician availability with 15-minute slots. Needs review before staging deploy.", 18),
    task("tsk_p3", "prj_portal", "Design secure document viewer", "done", "medium", "usr_sam", -6, ["design"], "", 25),
    task("tsk_p4", "prj_portal", "Accessibility audit of booking flow", "todo", "medium", "usr_sam", 6, ["a11y", "qa"], "WCAG 2.2 AA pass on booking and document pages.", 9),
    task("tsk_p5", "prj_portal", "Set up staging environment & seed data", "done", "medium", "usr_alex", -12, ["devops"], "", 30),
    task("tsk_p6", "prj_portal", "Write release notes for Sprint 6", "todo", "low", "usr_alex", 8, ["docs"], "", 5),
    task("tsk_p7", "prj_portal", "Fix timezone bug in appointment reminders", "todo", "urgent", "usr_alex", -1, ["bug", "backend"], "Reminders are sent an hour early for BST users.", 3),
    // Storefront Relaunch
    task("tsk_s1", "prj_storefront", "Product detail page — final build", "in_progress", "urgent", "usr_alex", 2, ["frontend"], "Variant picker, grind options, subscription upsell placeholder.", 12),
    task("tsk_s2", "prj_storefront", "Checkout payment integration test pass", "todo", "high", "usr_alex", 3, ["qa", "payments"], "", 8),
    task("tsk_s3", "prj_storefront", "Autumn campaign landing page design", "in_review", "high", "usr_sam", 1, ["design"], "Waiting on product photos from Daniel.", 10),
    task("tsk_s4", "prj_storefront", "Set up redirects from old shop URLs", "backlog", "medium", null, 4, ["seo"], "", 7),
    task("tsk_s5", "prj_storefront", "Mobile navigation polish", "done", "medium", "usr_sam", -4, ["frontend", "design"], "", 14),
    task("tsk_s6", "prj_storefront", "Import product catalogue (42 SKUs)", "done", "high", "usr_alex", -8, ["data"], "", 18),
    task("tsk_s7", "prj_storefront", "Cross-browser QA on Safari iOS", "todo", "high", "usr_sam", -2, ["qa"], "", 6),
    // Subscription Billing Flow
    task("tsk_b1", "prj_subscriptions", "Map subscription states and edge cases", "todo", "medium", "usr_alex", 9, ["planning"], "Pause, skip, swap, cancel, failed payment.", 4),
    task("tsk_b2", "prj_subscriptions", "Evaluate billing provider options", "backlog", "medium", "usr_alex", 14, ["research"], "", 4),
    // Lumen
    task("tsk_l1", "prj_lumen", "Information architecture workshop notes", "done", "medium", "usr_sam", -9, ["research"], "", 14),
    task("tsk_l2", "prj_lumen", "Dashboard wireframes v2", "in_review", "high", "usr_sam", 0, ["design"], "Incorporates Mei's feedback on the cohort chart.", 8),
    task("tsk_l3", "prj_lumen", "Component library: tables & filters", "in_progress", "medium", "usr_sam", 10, ["design-system"], "", 6),
    task("tsk_l4", "prj_lumen", "Usability test script", "backlog", "low", "usr_sam", 15, ["research"], "", 3),
    task("tsk_l5", "prj_lumen", "Front-end feasibility check for chart interactions", "todo", "medium", "usr_alex", 7, ["frontend"], "", 2),
    // BrightPath
    task("tsk_d1", "prj_brightpath", "Stakeholder interviews (3 sessions)", "in_progress", "medium", "usr_sam", 4, ["research"], "", 3),
    task("tsk_d2", "prj_brightpath", "Draft technical architecture outline", "todo", "medium", "usr_alex", 7, ["planning"], "", 3),
    task("tsk_d3", "prj_brightpath", "Fixed-price proposal & timeline", "backlog", "high", "usr_alex", 10, ["sales"], "", 2),
    // Atlas (on hold)
    task("tsk_a1", "prj_atlas", "Telematics vendor API spike", "backlog", "low", "usr_alex", null, ["research"], "Blocked until Atlas chooses a vendor.", 60),
    task("tsk_a2", "prj_atlas", "Dispatcher map prototype", "done", "medium", "usr_alex", -40, ["frontend"], "", 65),
    // Quill (completed)
    task("tsk_q1", "prj_quill", "Content migration (86 pages)", "done", "high", "usr_sam", -50, ["content"], "", 95),
    task("tsk_q2", "prj_quill", "301 redirect map", "done", "medium", "usr_alex", -40, ["seo"], "", 90),
    // MacroKite website
    task("tsk_m1", "prj_site", "Write Quill Legal case study", "todo", "low", "usr_sam", 12, ["content"], "", 5),
    task("tsk_m2", "prj_site", "Services page copy", "in_progress", "medium", "usr_alex", 5, ["content"], "", 6),
    // No project
    task("tsk_x1", null, "Send October invoices", "todo", "high", "usr_alex", 2, ["admin"], "Northwind retainer, Harbor milestone 2.", 2),
  ];

  const conversation = (_id, subject, visibility, clientId, projectId, createdDaysAgo, lastReadDaysAgo) => ({
    _id, orgId, subject, visibility, clientId, projectId, createdBy: "usr_alex", createdAt: at(createdDaysAgo, 9), lastMessageAt: at(createdDaysAgo, 9), lastReadAt: { usr_alex: lastReadDaysAgo === null ? at(createdDaysAgo, 9) : at(lastReadDaysAgo, 12), usr_sam: at(0, 8) },
  });
  const conversations = [
    conversation("cnv_portal_review", "Sprint 6 review & sign-off", "client", "cli_northwind", "prj_portal", 5, 2),
    conversation("cnv_portal_auth", "Magic-link auth rollout plan", "internal", "cli_northwind", "prj_portal", 4, 4),
    conversation("cnv_harbor_launch", "Launch date & product photos", "client", "cli_harbor", "prj_storefront", 6, 3),
    conversation("cnv_lumen_feedback", "Feedback on dashboard wireframes", "client", "cli_lumen", "prj_lumen", 3, null),
    conversation("cnv_brightpath", "Proposal timeline", "client", "cli_brightpath", "prj_brightpath", 2, null),
    conversation("cnv_capacity", "Weekly planning — capacity", "internal", null, null, 1, 1),
  ];

  const messages = [];
  const say = (conversationId, authorType, authorId, daysAgo, hour, minute, body) =>
    messages.push({ _id: `msg_${messages.length + 1}`, orgId, conversationId, authorType, authorId, body, createdAt: at(daysAgo, hour, minute) });

  say("cnv_portal_review", "member", "usr_alex", 5, 9, 15, "Hi Priya — Sprint 6 is wrapped. Highlights: the new document viewer is live on staging and the booking API is in review. Could you confirm a time for the sign-off call?");
  say("cnv_portal_review", "client", "usr_alex", 4, 14, 2, "Thanks Alex. Thursday 3pm works. Our compliance lead will join to look at the document viewer.");
  say("cnv_portal_review", "member", "usr_sam", 4, 15, 30, "Great — I'll prepare a short walkthrough of the viewer's access controls for your compliance lead.");
  say("cnv_portal_review", "client", "usr_alex", 1, 11, 20, "One request from compliance: can we show the audit log for document views in the demo?");
  say("cnv_portal_auth", "member", "usr_alex", 4, 10, 0, "Proposal: roll out magic links to patients first, keep passwords for staff for one more sprint. Thoughts?");
  say("cnv_portal_auth", "member", "usr_sam", 4, 11, 45, "Agree. We should update the login screen copy so patients understand the change — I'll draft it.");
  say("cnv_harbor_launch", "member", "usr_alex", 6, 9, 30, "Daniel, we're on track for the launch. We still need final product photos for the autumn blends by Friday.");
  say("cnv_harbor_launch", "client", "usr_alex", 5, 17, 10, "Photos are being edited — expect them Thursday. Can we move launch to the 2nd if they slip?");
  say("cnv_harbor_launch", "member", "usr_alex", 3, 8, 50, "Yes, the 2nd works as a fallback. We'll keep the landing page ready either way.");
  say("cnv_harbor_launch", "member", "usr_sam", 0, 9, 10, "Landing page design is in review — sharing the link once the photos land.");
  say("cnv_lumen_feedback", "member", "usr_sam", 3, 13, 0, "Hi Mei, wireframes v2 are in the shared Figma. Main change: the cohort chart now leads the page with filters pinned above it.");
  say("cnv_lumen_feedback", "client", "usr_sam", 1, 16, 40, "Love the pinned filters. Could we try a compact table density option for power users?");
  say("cnv_brightpath", "member", "usr_alex", 2, 10, 0, "Carlos, thanks for the intro call. We'll have the discovery summary and a fixed-price proposal within two weeks.");
  say("cnv_brightpath", "client", "usr_alex", 0, 8, 30, "Sounds good. Our board meets on the 25th — would be great to have the proposal before then.");
  say("cnv_capacity", "member", "usr_sam", 1, 9, 0, "Heads up: Harbor launch + Lumen review land in the same week. I can take Safari QA if you own checkout testing.");
  say("cnv_capacity", "member", "usr_alex", 1, 9, 40, "Deal. I'll also start the BrightPath architecture outline so the proposal isn't rushed.");

  for (const c of conversations) {
    const last = messages.filter((m) => m.conversationId === c._id).at(-1);
    if (last) c.lastMessageAt = last.createdAt;
    if (c.lastReadAt.usr_alex > c.lastMessageAt || c._id === "cnv_capacity" || c._id === "cnv_portal_auth") c.lastReadAt.usr_alex = c.lastMessageAt;
  }

  const activity = (n, actorId, verb, entityType, entityId, summary, clientId, projectId, daysAgo, hour) => ({
    _id: `act_seed_${n}`, orgId, actorId, verb, entityType, entityId, summary, clientId, projectId, createdAt: at(daysAgo, hour),
  });
  const activities = [
    activity(1, "usr_alex", "created", "client", "cli_brightpath", "added client BrightPath Learning", "cli_brightpath", null, 9, 11),
    activity(2, "usr_alex", "created", "project", "prj_brightpath", "created project Discovery & Proposal", "cli_brightpath", "prj_brightpath", 4, 10),
    activity(3, "usr_sam", "completed", "task", "tsk_s5", "completed Mobile navigation polish", "cli_harbor", "prj_storefront", 3, 16),
    activity(4, "usr_alex", "moved", "task", "tsk_p2", "moved Appointment booking: calendar availability API to In review", "cli_northwind", "prj_portal", 2, 17),
    activity(5, "usr_sam", "moved", "task", "tsk_l2", "moved Dashboard wireframes v2 to In review", "cli_lumen", "prj_lumen", 1, 15),
    activity(6, "usr_alex", "replied", "conversation", "cnv_capacity", "replied in “Weekly planning — capacity”", null, null, 1, 9),
    activity(7, "usr_alex", "logged", "conversation", "cnv_brightpath", "logged a client reply in “Proposal timeline”", "cli_brightpath", "prj_brightpath", 0, 8),
    activity(8, "usr_sam", "replied", "conversation", "cnv_harbor_launch", "replied in “Launch date & product photos”", "cli_harbor", "prj_storefront", 0, 9),
  ];

  return { org, users, memberships, clients, projects, tasks, conversations, messages, activities };
}
