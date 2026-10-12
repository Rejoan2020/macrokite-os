import { mutation } from "@/lib/server/http";

export const POST = mutation((_, body) => ({ type: "client.create", data: body }));
