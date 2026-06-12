import { QdrantClient } from "@qdrant/js-client-rest";

import { env } from "@/config/env";

// QdrantClient defaults to port 6333 when the URL has no explicit port,
// which breaks cloud URLs served on standard HTTPS. Derive the port from
// the URL instead.
export function createQdrantClient(): QdrantClient {
  const url = new URL(env.QDRANT_URL);
  const port = url.port
    ? Number(url.port)
    : url.protocol === "https:"
      ? 443
      : 6333;
  return new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY, port });
}
