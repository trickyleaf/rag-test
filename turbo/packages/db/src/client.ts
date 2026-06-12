import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DbClient = NeonHttpDatabase<typeof schema>;

export function createDbClient(databaseUrl: string): DbClient {
  return drizzle(neon(databaseUrl), { schema });
}
