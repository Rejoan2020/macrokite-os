import { mutation } from "@/lib/server/http";

export const PATCH = mutation(({ id }, body) => ({ type: "project.update", id, data: body }));
export const DELETE = mutation(({ id }) => ({ type: "project.delete", id }));
