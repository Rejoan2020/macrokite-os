import { mutation } from "@/lib/server/http";

export const POST = mutation(({ id }, body) => ({ type: "message.create", conversationId: id, data: body }));
