import { z } from "zod";
import { DEFAULT_TASK_PRIORITY, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, REMINDER_OPTIONS, ROLES, TASK_PRIORITIES, TASK_SOURCES, TASK_STATUSES } from "./constants";
import { MAX_PHASES } from "./phases";

// Input schemas shared by demo mode (browser) and database mode (route handlers).
// They describe what a caller may submit, never server-owned fields (ids, orgId, timestamps).

const text = (max) => z.string().trim().max(max, `Must be ${max} characters or fewer`);
const required = (label, max) => text(max).min(1, `${label} is required`);
const id = z.string().trim().min(1).max(64);
const optionalId = z
  .string()
  .trim()
  .max(64)
  .nullish()
  .transform((v) => v || null);
const isoDate = z
  .string()
  .trim()
  // Round-trip check rejects impossible dates such as 2026-02-31, which Date would roll over.
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)), "Use a valid date")
  .nullish()
  .transform((v) => v || "");
const dateTime = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Use a valid date and time")
  .transform((v) => new Date(v).toISOString());
const httpUrl = (label) =>
  text(500)
    .refine((v) => {
      if (v === "") return true;
      try {
        return ["http:", "https:"].includes(new URL(v).protocol);
      } catch {
        return false;
      }
    }, `${label} must be a full link starting with https://`)
    .nullish()
    .transform((v) => v || "");
const ids = z.array(id).max(100).default([]).transform((list) => [...new Set(list)]);
// A phase id from the project's own phases; the engine checks it belongs to that project.
const phaseId = z.string({ message: "Choose a phase" }).trim().min(1, "Choose a phase").max(64);
// A project's phases, in order. New phases come without an _id; the engine assigns one.
const phaseList = z
  .array(z.object({ _id: z.string().trim().max(64).optional(), name: required("Phase name", 40) }))
  .min(1, "Add at least one phase")
  .max(MAX_PHASES, `Use ${MAX_PHASES} phases or fewer`);

export const projectInput = z.object({
  name: required("Project name", 140),
  description: text(240).default(""),
  phase: phaseId.optional(),
  phases: phaseList.optional(),
  deadline: isoDate,
  memberIds: ids,
  leadIds: ids,
  notes: text(20000).default(""),
  clientId: optionalId, // null: a company project
});

export const clientInput = z.object({
  name: required("Client name", 120),
  description: text(2000).default(""),
  memberIds: ids,
});

export const groupInput = z.object({
  name: required("Group name", 80),
  memberIds: ids,
});

export const taskInput = z.object({
  projectId: z.string({ message: "Choose a project" }).trim().min(1, "Choose a project").max(64),
  phase: phaseId,
  title: required("Title", 200),
  description: text(5000).default(""),
  assigneeIds: ids, // may be empty: nobody picked yet
  status: z.enum(TASK_STATUSES, { message: "Choose a status" }),
  priority: z.enum(TASK_PRIORITIES, { message: "Choose a priority" }).default(DEFAULT_TASK_PRIORITY),
  dueDate: isoDate,
  source: z.enum(TASK_SOURCES).default("manual"),
  meetingId: optionalId,
  messageId: optionalId,
});

export const meetingInput = z.object({
  projectId: z.string({ message: "Choose a project" }).trim().min(1, "Choose a project").max(64),
  title: required("Title", 140),
  startsAt: dateTime,
  callUrl: httpUrl("Call link"),
  attendeeIds: ids,
  notes: text(20000).default(""),
  // Agenda topics as plain lines; blank ones are dropped. Leave out to keep the agenda as it is.
  agenda: z
    .array(z.string().trim().max(200, "Keep each topic to 200 characters"))
    .max(50, "Use 50 topics or fewer")
    .transform((lines) => lines.filter(Boolean))
    .optional(),
});

/** Your reminder for a meeting: minutes before it starts, or null for none. */
export const reminderInput = z.object({
  minutes: z
    .number()
    .nullable()
    .refine((m) => m === null || REMINDER_OPTIONS.includes(m), "Choose one of the reminder times"),
});

export const lineInput = (label, max = 300) => z.object({ text: required(label, max) });

// A file already uploaded to Blob storage; the engine checks it is in this workspace's folder.
const attachment = z.object({
  pathname: z.string().trim().min(1).max(400),
  name: required("File name", 200),
  size: z.number().int().min(0).max(MAX_ATTACHMENT_BYTES, "Files must be 25 MB or smaller"),
  contentType: text(150).default(""),
  width: z.number().int().positive().max(100000).nullish().transform((v) => v ?? null),
  height: z.number().int().positive().max(100000).nullish().transform((v) => v ?? null),
});

// Text, files or both.
export const messageInput = z
  .object({
    body: text(10000).default(""),
    attachments: z.array(attachment).max(MAX_ATTACHMENTS, `Send ${MAX_ATTACHMENTS} files or fewer at a time`).default([]),
  })
  .refine((m) => m.body || m.attachments.length, { message: "Message is required", path: ["body"] });

// New text for a sent message; its files stay as they are.
export const messageEditInput = z.object({ body: text(10000).default("") });

export const inviteInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
});

export const roleInput = z.object({ role: z.enum(ROLES, { message: "Choose a role" }) });

// callUrl: the workspace's standing call room, for meetings nobody scheduled.
export const workspaceInput = z.object({ name: required("Workspace name", 80), callUrl: httpUrl("Call link") });

export const profileInput = z.object({
  name: required("Name", 80),
  avatarUrl: httpUrl("Photo"),
  notificationPrefs: z.object({
    assignment: z.boolean(),
    meetingInvite: z.boolean(),
    // Missing on settings saved before it existed.
    chatMessages: z.boolean().default(false),
  }),
});

export function fieldErrorsFrom(zodError) {
  const fieldErrors = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}
