import { mutation } from "@/lib/server/http";

export const PATCH = mutation((_, body) => ({ type: "profile.update", data: body }));
