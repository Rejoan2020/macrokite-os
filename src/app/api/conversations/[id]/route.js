import { mutation } from "@/lib/server/http";

export const DELETE = mutation(({ id }) => ({ type: "conversation.delete", id }));
