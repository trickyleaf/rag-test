import { z } from "zod";

const envSchema = z.object({
  AI_GATEWAY_API_KEY: z.string().min(1),
  AI_GATEWAY_MODEL: z.string().default("openai/gpt-4o-mini"),
  AI_EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),
  BLOB_STORE_ID: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().optional(),
  LLAMA_CLOUD_API_KEY: z.string().min(1),
  QDRANT_API_KEY: z.string().min(1),
  QDRANT_COLLECTION: z.string().default("documents"),
  QDRANT_URL: z.string().min(1),
});

export const env = envSchema.parse(process.env);
