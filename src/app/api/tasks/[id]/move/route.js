import { mutation } from "@/lib/server/http";

export const POST = mutation(({ id }, body) => ({ type: "task.move", id, data: body }));
