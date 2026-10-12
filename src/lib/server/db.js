import "server-only";
import mongoose from "mongoose";

// Server-only MongoDB access. The URI never leaves the server: it is read from the environment
// here and nothing derived from it is sent to the browser.

export const isDatabaseConfigured = () => Boolean(process.env.MONGODB_URI?.trim());

const globalCache = globalThis.__macrokiteMongo ?? (globalThis.__macrokiteMongo = { conn: null, promise: null });

export async function connectToDatabase() {
  if (!isDatabaseConfigured()) throw new Error("MONGODB_URI is not configured");
  if (globalCache.conn) return globalCache.conn;
  // Reuse one connection across hot reloads and route handler invocations.
  globalCache.promise ??= mongoose
    .connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || undefined,
      serverSelectionTimeoutMS: 8000,
      bufferCommands: false,
    })
    .catch((error) => {
      globalCache.promise = null;
      throw error;
    });
  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}
