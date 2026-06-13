import { gateway } from "@ai-sdk/gateway";
import { get as getBlobObject } from "@vercel/blob";
import { embedMany } from "ai";
import { FatalError } from "workflow";

import { env } from "@/config/env";
import { createQdrantClient } from "@/lib/qdrant";
import {
  saveDocumentChunks,
  updateDocumentStatus,
} from "@/lib/queries";

export type IngestDocumentWorkflowInput = {
  documentId: string;
  storageKey: string;
  tagKeys: string[];
  title: string;
};

type ParsedNode = {
  id: string;
  content: string;
  pageNumber: number;
};

// ---------- steps ----------

async function setDocumentStatus(
  documentId: string,
  status: "uploaded" | "processing" | "ready" | "failed",
  errorMessage?: string,
): Promise<void> {
  "use step";
  await updateDocumentStatus(documentId, status, errorMessage);
}

async function fetchFile(storageKey: string): Promise<{ arrayBuffer: ArrayBuffer; contentType: string; filename: string }> {
  "use step";
  const result = await getBlobObject(storageKey, {
    access: "private",
    token: env.BLOB_READ_WRITE_TOKEN,
  });
  if (!result || result.statusCode !== 200) {
    throw new FatalError(`Failed to fetch document from storage: not found or access denied`);
  }
  const chunks: Uint8Array[] = [];
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const arrayBuffer = await new Blob(chunks as BlobPart[]).arrayBuffer();
  const contentType = result.blob.contentType ?? "application/pdf";
  const filename =
    result.blob.contentDisposition?.match(/filename="(.+?)"/)?.[1] ??
    storageKey.split("/").pop() ??
    "document.pdf";
  return { arrayBuffer, contentType, filename };
}

const LLAMA_PARSE_BASE_URL = "https://api.cloud.llamaindex.ai";
const LLAMA_PARSE_PAGE_SEPARATOR = "\n\n--- page ---\n\n";
const LLAMA_PARSE_POLL_INTERVAL_MS = 3_000;
const LLAMA_PARSE_POLL_TIMEOUT_MS = 5 * 60_000;

async function parseWithLlamaParse(
  arrayBuffer: ArrayBuffer,
  contentType: string,
  filename: string,
  documentId: string,
): Promise<ParsedNode[]> {
  "use step";
  const headers = { Authorization: `Bearer ${env.LLAMA_CLOUD_API_KEY}` };

  const form = new FormData();
  form.append("file", new File([arrayBuffer], filename, { type: contentType }));
  form.append("page_separator", LLAMA_PARSE_PAGE_SEPARATOR);

  const uploadRes = await fetch(`${LLAMA_PARSE_BASE_URL}/api/v1/parsing/upload`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => "");
    throw new FatalError(
      `LlamaParse upload failed (${uploadRes.status}): ${body.slice(0, 500)}`,
    );
  }
  const { id: jobId, status: initialStatus } = (await uploadRes.json()) as {
    id: string;
    status: string;
  };

  let status = initialStatus;
  const deadline = Date.now() + LLAMA_PARSE_POLL_TIMEOUT_MS;
  while (status !== "SUCCESS") {
    if (status === "ERROR" || status === "CANCELLED") {
      throw new FatalError(`LlamaParse job ${jobId} ended with status ${status}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`LlamaParse job ${jobId} timed out (last status: ${status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, LLAMA_PARSE_POLL_INTERVAL_MS));
    const jobRes = await fetch(`${LLAMA_PARSE_BASE_URL}/api/v1/parsing/job/${jobId}`, { headers });
    if (!jobRes.ok) {
      throw new Error(`LlamaParse job status check failed (${jobRes.status})`);
    }
    status = ((await jobRes.json()) as { status: string }).status;
  }

  const resultRes = await fetch(
    `${LLAMA_PARSE_BASE_URL}/api/v1/parsing/job/${jobId}/result/markdown`,
    { headers },
  );
  if (!resultRes.ok) {
    const body = await resultRes.text().catch(() => "");
    throw new Error(
      `LlamaParse markdown result fetch failed (${resultRes.status}): ${body.slice(0, 500)}`,
    );
  }
  const { markdown } = (await resultRes.json()) as { markdown: string };

  const nodes = markdown
    .split(LLAMA_PARSE_PAGE_SEPARATOR)
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
  console.log(`[ingest] Embedding ${nodes.length} nodes — model: ${env.AI_EMBEDDING_MODEL}`);
  const { embeddings } = await embedMany({
    model: gateway.embeddingModel(env.AI_EMBEDDING_MODEL),
    values: nodes.map((n) => n.content),
  });
  console.log(`[ingest] Embedding done — dims: ${embeddings[0]?.length ?? 0}`);
  return embeddings;
}

async function upsertToQdrant(
  nodes: ParsedNode[],
  embeddings: number[][],
  documentId: string,
  tagKeys: string[],
  title: string,
): Promise<void> {
  "use step";
  const qdrant = createQdrantClient();
  const { exists } = await qdrant.collectionExists(env.QDRANT_COLLECTION);
  if (!exists) {
    await qdrant.createCollection(env.QDRANT_COLLECTION, {
      vectors: { size: 1536, distance: "Cosine" },
    });
  }
  // ACL filtering on tagKeys requires a keyword payload index (idempotent).
  await qdrant.createPayloadIndex(env.QDRANT_COLLECTION, {
    field_name: "tagKeys",
    field_schema: "keyword",
    wait: true,
  });
  await qdrant.upsert(env.QDRANT_COLLECTION, {
    wait: true,
    points: nodes.map((node, index) => ({
      id: node.id,
      vector: embeddings[index] ?? [],
      payload: {
        documentId,
        chunkId: node.id,
        tagKeys,
        title,
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

  await setDocumentStatus(input.documentId, "processing");

  try {
    const { arrayBuffer, contentType, filename } = await fetchFile(input.storageKey);

    const nodes = await parseWithLlamaParse(arrayBuffer, contentType, filename, input.documentId);

    if (nodes.length === 0) {
      await setDocumentStatus(input.documentId, "ready");
      return { documentId: input.documentId, nodeCount: 0 };
    }

    const embeddings = await embedNodes(nodes);

    await upsertToQdrant(nodes, embeddings, input.documentId, input.tagKeys, input.title);

    await persistChunks(input.documentId, nodes);

    await setDocumentStatus(input.documentId, "ready");

    console.log(`[ingest] ${input.documentId}: indexed ${nodes.length} nodes`);
    return { documentId: input.documentId, nodeCount: nodes.length };
  } catch (err) {
    await setDocumentStatus(
      input.documentId,
      "failed",
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
}
