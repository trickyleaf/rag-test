import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@repo/db/schema";

export type Db = ReturnType<typeof buildDb>;

function buildDb(url: string) {
  return drizzle(neon(url), { schema });
}

let _db: Db | null = null;

export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (!_db) _db = buildDb(url);
  return _db;
}
