import { mutation } from "@/lib/server/http";

export const PATCH = mutation(({ id }, body) => ({ type: "client.update", id, data: body }));
export const DELETE = mutation(({ id }) => ({ type: "client.delete", id }));
