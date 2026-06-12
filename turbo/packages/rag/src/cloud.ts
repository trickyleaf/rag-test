import { gateway } from "@ai-sdk/gateway";
import { QdrantClient } from "@qdrant/js-client-rest";
import { embedMany } from "ai";
import { upload } from "llama-cloud-services/parse";

import { buildQdrantAclFilter } from "./acl";
import type {
  DocumentParser,
  EmbeddingProvider,
  LlamaIndexNode,
  VectorStore,
} from "./providers";
import type { RetrieveContextInput, RetrieveContextResult } from "./retrieval";

export type LlamaParseCloudParserConfig = {
  apiKey?: string;
  region?: "us" | "eu" | "us-staging";
};

export function createLlamaParseCloudParser(
  config: LlamaParseCloudParserConfig = {},
): DocumentParser {
  return {
    async parse(input) {
      const arrayBuffer = input.bytes.buffer.slice(
        input.bytes.byteOffset,
        input.bytes.byteOffset + input.bytes.byteLength,
      ) as ArrayBuffer;
      const file = new File([arrayBuffer], input.filename, {
        type: input.mimeType,
      });
      const uploadParams = {
        file,
        apiKey: config.apiKey,
        region: config.region ?? "us",
        page_separator: "\n\n--- page ---\n\n",
      } satisfies Record<string, unknown>;
      const job = await upload(uploadParams as Parameters<typeof upload>[0]);
      const markdown = await job.markdown();

      return markdown
        .split("\n\n--- page ---\n\n")
        .map((content, index) => toNode(input.documentId, content, index + 1))
        .filter((node) => node.content.length > 0);
    },
  };
}

export type GatewayEmbeddingConfig = {
  model?: string;
};

export function createGatewayEmbeddingProvider(
  config: GatewayEmbeddingConfig = {},
): EmbeddingProvider {
  return {
    async embedTexts(texts) {
      if (texts.length === 0) {
        return [];
      }

      const { embeddings } = await embedMany({
        model: gateway.embeddingModel(
          config.model ?? "openai/text-embedding-3-small",
        ),
        values: [...texts],
      });

      return embeddings;
    },
  };
}

export type QdrantVectorStoreConfig = {
  apiKey?: string;
  collectionName: string;
  url: string;
};

export function createQdrantVectorStore(
  config: QdrantVectorStoreConfig,
): VectorStore {
  const client = new QdrantClient({
    apiKey: config.apiKey,
    url: config.url,
  });

  return {
    async upsertNodes(input) {
      await client.upsert(config.collectionName, {
        wait: true,
        points: input.nodes.map((node, index) => ({
          id: node.id,
          vector: input.embeddings[index] ?? [],
          payload: {
            documentId: input.documentId,
            chunkId: node.id,
            tagKeys: [...input.tagKeys],
            chunkIndex: index,
            content: node.content,
            pageNumber: node.metadata.pageNumber,
            sourceLabel: node.metadata.sourceLabel,
          },
        })),
      });
    },
  };
}

export async function retrieveFromQdrant(
  input: RetrieveContextInput & {
    collectionName: string;
    embedding: readonly number[];
    qdrant: QdrantClient;
  },
): Promise<RetrieveContextResult> {
  const result = await input.qdrant.query(input.collectionName, {
    query: [...input.embedding],
    filter: buildQdrantAclFilter(input.policy),
    limit: input.limit ?? 8,
    with_payload: [
      "documentId",
      "chunkId",
      "content",
      "title",
      "sourceLabel",
      "pageNumber",
      "tagKeys",
    ],
    with_vector: false,
  });

  const references = result.points.map((point) => {
    const payload = (point.payload ?? {}) as Record<string, unknown>;
    const content = String(payload.content ?? "");

    return {
      documentId: String(payload.documentId ?? ""),
      chunkId: String(payload.chunkId ?? point.id),
      title: String(payload.title ?? payload.sourceLabel ?? "Untitled"),
      quote: content.slice(0, 500),
      score: point.score ?? 0,
      pageNumber:
        typeof payload.pageNumber === "number" ? payload.pageNumber : undefined,
    };
  });

  return {
    context: references
      .map((reference) => `[${reference.title}] ${reference.quote}`)
      .join("\n\n"),
    references,
  };
}

function toNode(
  documentId: string,
  content: string,
  pageNumber: number,
): LlamaIndexNode {
  return {
    id: `${documentId}-${pageNumber}`,
    content: content.trim(),
    metadata: {
      documentId,
      pageNumber,
      parser: "llamaparse-cloud",
    },
  };
}
