import { mutation } from "@/lib/server/http";

export const PATCH = mutation(({ id }, body) => ({ type: "task.update", id, data: body }));
export const DELETE = mutation(({ id }) => ({ type: "task.delete", id }));
