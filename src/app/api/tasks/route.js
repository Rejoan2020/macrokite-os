import { mutation } from "@/lib/server/http";

export const POST = mutation((_, body) => ({ type: "task.create", data: body }));
