import { gateway } from "@ai-sdk/gateway";
import { get as getBlobObject } from "@vercel/blob";
import { QdrantClient } from "@qdrant/js-client-rest";
import { embedMany } from "ai";
import { FatalError } from "workflow";
import { upload } from "llama-cloud-services/parse";

import { env } from "@/config/env";
import {
  saveDocumentChunks,
  updateDocumentStatus,
} from "@/lib/queries";

export type IngestDocumentWorkflowInput = {
  documentId: string;
  storageKey: string;
  tagKeys: string[];
};

type ParsedNode = {
  id: string;
  content: string;
  pageNumber: number;
};

// ---------- steps ----------

async function fetchFile(storageKey: string): Promise<{ arrayBuffer: ArrayBuffer; contentType: string; filename: string }> {
  "use step";
  const result = await getBlobObject(storageKey, {
    access: "private",
    token: env.BLOB_READ_WRITE_TOKEN,
  });
  if (!result || result.statusCode !== 200) {
    throw new FatalError(`Failed to fetch document from storage: not found or access denied`);
  }
  const chunks: ArrayBuffer[] = [];
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value.buffer as ArrayBuffer);
  }
  const arrayBuffer = await new Blob(chunks).arrayBuffer();
  const contentType = result.blob.contentType ?? "application/pdf";
  const filename =
    result.blob.contentDisposition?.match(/filename="(.+?)"/)?.[1] ??
    storageKey.split("/").pop() ??
    "document.pdf";
  return { arrayBuffer, contentType, filename };
}

async function parseWithLlamaParse(
  arrayBuffer: ArrayBuffer,
  contentType: string,
  filename: string,
  documentId: string,
): Promise<ParsedNode[]> {
  "use step";
  const file = new File([arrayBuffer], filename, { type: contentType });
  const job = await upload({
    file,
    apiKey: env.LLAMA_CLOUD_API_KEY!,
    region: "us",
    page_separator: "\n\n--- page ---\n\n",
  } as Parameters<typeof upload>[0]);
  const markdown = await job.markdown();

  const nodes = markdown
    .split("\n\n--- page ---\n\n")
    .map((content, index) => ({
      id: crypto.randomUUID(),
      content: content.trim(),
      pageNumber: index + 1,
    }))
    .filter((node) => node.content.length > 0);

  if (nodes.length === 0) {
    console.warn(`[ingest] No content extracted for ${documentId}`);
  }
  return nodes;
}

async function embedNodes(nodes: ParsedNode[]): Promise<number[][]> {
  "use step";
  const { embeddings } = await embedMany({
    model: gateway.embeddingModel(env.AI_EMBEDDING_MODEL),
    values: nodes.map((n) => n.content),
  });
  return embeddings;
}

async function upsertToQdrant(
  nodes: ParsedNode[],
  embeddings: number[][],
  documentId: string,
  tagKeys: string[],
): Promise<void> {
  "use step";
  const qdrant = new QdrantClient({ url: env.QDRANT_URL!, apiKey: env.QDRANT_API_KEY });
  try {
    await qdrant.createCollection(env.QDRANT_COLLECTION, {
      vectors: { size: 1536, distance: "Cosine" },
    });
  } catch {
    // Collection already exists — safe to continue
  }
  await qdrant.upsert(env.QDRANT_COLLECTION, {
    wait: true,
    points: nodes.map((node, index) => ({
      id: node.id,
      vector: embeddings[index] ?? [],
      payload: {
        documentId,
        chunkId: node.id,
        tagKeys,
        chunkIndex: index,
        content: node.content,
        pageNumber: node.pageNumber,
      },
    })),
  });
}

async function persistChunks(documentId: string, nodes: ParsedNode[]): Promise<void> {
  "use step";
  await saveDocumentChunks(
    documentId,
    nodes.map((node, index) => ({
      id: node.id,
      chunkIndex: index,
      content: node.content,
      qdrantPointId: node.id,
      pageNumber: node.pageNumber,
    })),
  );
}

// ---------- workflow ----------

export async function ingestDocumentWorkflow(input: IngestDocumentWorkflowInput) {
  "use workflow";

  if (!env.LLAMA_CLOUD_API_KEY || !env.QDRANT_URL || !env.AI_GATEWAY_API_KEY) {
    console.warn(
      `[ingest] Skipping ingestion for ${input.documentId}: ` +
        "LLAMA_CLOUD_API_KEY, QDRANT_URL, and AI_GATEWAY_API_KEY are all required.",
    );
    return { documentId: input.documentId, nodeCount: 0 };
  }

  await updateDocumentStatus(input.documentId, "processing");

  try {
    const { arrayBuffer, contentType, filename } = await fetchFile(input.storageKey);

    const nodes = await parseWithLlamaParse(arrayBuffer, contentType, filename, input.documentId);

    if (nodes.length === 0) {
      await updateDocumentStatus(input.documentId, "ready");
      return { documentId: input.documentId, nodeCount: 0 };
    }

    const embeddings = await embedNodes(nodes);

    await upsertToQdrant(nodes, embeddings, input.documentId, input.tagKeys);

    await persistChunks(input.documentId, nodes);

    await updateDocumentStatus(input.documentId, "ready");

    console.log(`[ingest] ${input.documentId}: indexed ${nodes.length} nodes`);
    return { documentId: input.documentId, nodeCount: nodes.length };
  } catch (err) {
    await updateDocumentStatus(
      input.documentId,
      "failed",
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
}
