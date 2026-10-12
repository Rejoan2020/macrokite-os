import { mutation } from "@/lib/server/http";

export const POST = mutation(({ id }) => ({ type: "conversation.read", id }));
