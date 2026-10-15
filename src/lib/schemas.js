import { z } from "zod";
import { DEFAULT_TASK_PRIORITY, ROLES, TASK_PRIORITIES, TASK_SOURCES, TASK_STATUSES } from "./constants";
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
});

export const taskInput = z.object({
  projectId: z.string({ message: "Choose a project" }).trim().min(1, "Choose a project").max(64),
  phase: phaseId,
  title: required("Title", 200),
  description: text(5000).default(""),
  assigneeId: z.string({ message: "Choose who is doing this" }).trim().min(1, "Choose who is doing this").max(64),
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
});

export const lineInput = (label, max = 300) => z.object({ text: required(label, max) });

export const messageInput = z.object({ body: required("Message", 10000) });

export const inviteInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
});

export const roleInput = z.object({ role: z.enum(ROLES, { message: "Choose a role" }) });

export const workspaceInput = z.object({ name: required("Workspace name", 80) });

export const profileInput = z.object({
  name: required("Name", 80),
  avatarUrl: httpUrl("Photo"),
  notificationPrefs: z.object({
    assignment: z.boolean(),
    meetingInvite: z.boolean(),
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
