import { z } from "zod";
import {
  CLIENT_STATUSES,
  DATE_FORMATS,
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  VISIBILITIES,
} from "./constants";

// Input schemas shared by demo mode (browser) and database mode (route handlers).
// They describe what a caller may submit, never server-owned fields (ids, orgId, timestamps).

const text = (max) => z.string().trim().max(max, `Must be ${max} characters or fewer`);
const required = (label, max) => text(max).min(1, `${label} is required`);
const optionalId = z
  .string()
  .trim()
  .max(64)
  .nullish()
  .transform((v) => v || null);
const isoDate = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Use a valid date")
  .nullish()
  .transform((v) => v || "");

export const clientInput = z.object({
  name: required("Contact name", 120),
  company: required("Company", 120),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  phone: text(40)
    .refine((v) => v === "" || /^[+()\-.\s\d]{5,40}$/.test(v), "Enter a valid phone number")
    .default(""),
  status: z.enum(CLIENT_STATUSES, { message: "Choose a status" }),
  service: text(500).default(""),
  notes: text(4000).default(""),
});

export const projectInput = z
  .object({
    name: required("Project name", 140),
    description: text(4000).default(""),
    clientId: optionalId,
    status: z.enum(PROJECT_STATUSES, { message: "Choose a status" }),
    priority: z.enum(PRIORITIES, { message: "Choose a priority" }),
    startDate: isoDate,
    deadline: isoDate,
    memberIds: z.array(z.string().max(64)).max(50).default([]),
  })
  .refine((p) => !p.startDate || !p.deadline || p.deadline >= p.startDate, {
    message: "Deadline must be on or after the start date",
    path: ["deadline"],
  });

export const taskInput = z.object({
  title: required("Title", 200),
  description: text(8000).default(""),
  projectId: optionalId,
  status: z.enum(TASK_STATUSES, { message: "Choose a status" }),
  priority: z.enum(PRIORITIES, { message: "Choose a priority" }),
  assigneeId: optionalId,
  dueDate: isoDate,
  labels: z
    .array(text(32).min(1))
    .max(10, "Use at most 10 labels")
    .default([])
    .transform((labels) => [...new Set(labels.map((l) => l.toLowerCase()))]),
});

export const taskMoveInput = z.object({
  status: z.enum(TASK_STATUSES),
  beforeId: optionalId,
});

export const conversationInput = z
  .object({
    subject: required("Subject", 200),
    visibility: z.enum(VISIBILITIES),
    clientId: optionalId,
    projectId: optionalId,
    body: required("Message", 10000),
  })
  .refine((c) => c.visibility === "internal" || c.clientId || c.projectId, {
    message: "Client-facing threads need a client or a client project",
    path: ["clientId"],
  });

export const messageInput = z.object({
  body: required("Message", 10000),
  authorType: z.enum(["member", "client"]).default("member"),
});

export const workspaceInput = z.object({
  name: required("Workspace name", 80),
  description: text(500).default(""),
  preferences: z.object({
    defaultTaskPriority: z.enum(PRIORITIES),
    dueSoonDays: z.coerce.number().int().min(1, "At least 1 day").max(60, "At most 60 days"),
    dateFormat: z.enum(DATE_FORMATS),
  }),
});

export const profileInput = z.object({
  name: required("Name", 80),
  title: text(80).default(""),
  bio: text(500).default(""),
  timezone: text(64).default(""),
});

export function fieldErrorsFrom(zodError) {
  const fieldErrors = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}
