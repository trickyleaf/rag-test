import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const dir = fileURLToPath(new URL(".", import.meta.url));
config({ path: path.resolve(dir, "../../../.env"), override: false });
config({ path: path.resolve(dir, "../../../../.env"), override: false });

import { createDbClient } from "../src/client";
import { runSeed } from "../src/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is required.");
  const db = createDbClient(url);
  await runSeed(db);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
