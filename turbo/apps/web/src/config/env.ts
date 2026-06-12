import { z } from "zod";

const envSchema = z.object({
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_GATEWAY_MODEL: z.string().default("openai/gpt-5-mini"),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  LLAMA_CLOUD_API_KEY: z.string().optional(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().default("documents"),
  QDRANT_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
