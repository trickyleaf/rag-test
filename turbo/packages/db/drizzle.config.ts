import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "drizzle-kit";

const dir = fileURLToPath(new URL(".", import.meta.url));
// look for .env at turbo root, then project root
config({ path: path.resolve(dir, "../../.env"), override: false });
config({ path: path.resolve(dir, "../../../.env"), override: false });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
