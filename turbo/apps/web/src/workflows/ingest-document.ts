import { gateway } from "@ai-sdk/gateway";
import { QdrantClient } from "@qdrant/js-client-rest";
import { embedMany } from "ai";
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

function parseInlineDataUrl(storageKey: string): File | null {
  if (!storageKey.startsWith("data:")) return null;
  const match = storageKey.match(/^data:([^;,]+)?;base64,(.*)$/s);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const base64 = match[2] || "";
  const buffer = Buffer.from(base64, "base64");
  return new File([buffer], "uploaded-document", { type: mimeType });
}

function extractTextFromPdfLikeContent(text: string) {
  const matches = [...text.matchAll(/\(([^()]*)\)\s*Tj/g)].map((m) => m[1]?.trim() ?? "");
  return matches.filter(Boolean).join("\n").trim();
}

async function ensureQdrantCollection(client: QdrantClient, collectionName: string) {
  try {
    await client.createCollection(collectionName, {
      vectors: { size: 1536, distance: "Cosine" },
    });
  } catch {
    // Collection already exists — safe to continue
  }
}

export async function ingestDocumentWorkflow(input: IngestDocumentWorkflowInput) {
  if (!env.LLAMA_CLOUD_API_KEY || !env.QDRANT_URL || !env.AI_GATEWAY_API_KEY) {
    console.warn(
      `[ingest] Skipping ingestion for ${input.documentId}: ` +
        "LLAMA_CLOUD_API_KEY, QDRANT_URL, and AI_GATEWAY_API_KEY are all required.",
    );
    return { documentId: input.documentId, nodeCount: 0 };
  }

  await updateDocumentStatus(input.documentId, "processing");

  try {
    // Step 1: Fetch file from storage
    const inlineFile = parseInlineDataUrl(input.storageKey);
    if (inlineFile) {
      const rawText = await inlineFile.text();
      const extracted = extractTextFromPdfLikeContent(rawText) || rawText.slice(0, 1000) || "Document uploaded";
      await saveDocumentChunks(input.documentId, [
        {
          id: crypto.randomUUID(),
          chunkIndex: 0,
          content: extracted,
          qdrantPointId: crypto.randomUUID(),
          pageNumber: 1,
        },
      ]);
      await updateDocumentStatus(input.documentId, "ready");
      console.log(`[ingest] ${input.documentId}: ready via inline fallback indexing`);
      return { documentId: input.documentId, nodeCount: 1 };
    }

    const fileResponse = await fetch(input.storageKey);
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch document from storage: ${fileResponse.statusText}`);
    }
    const contentType = fileResponse.headers.get("content-type") ?? "application/pdf";
    const filename =
      fileResponse.headers.get("content-disposition")?.match(/filename="(.+?)"/)?.[1] ??
      input.storageKey.split("/").pop() ??
      "document.pdf";
    const arrayBuffer = await fileResponse.arrayBuffer();
    const file = new File([arrayBuffer], filename, { type: contentType });

    // Step 2: Parse with LlamaParse cloud
    const job = await upload({
      file,
      apiKey: env.LLAMA_CLOUD_API_KEY,
      region: "us",
      page_separator: "\n\n--- page ---\n\n",
    } as Parameters<typeof upload>[0]);
    const markdown = await job.markdown();

    const nodes: ParsedNode[] = markdown
      .split("\n\n--- page ---\n\n")
      .map((content, index) => ({
        id: crypto.randomUUID(),
        content: content.trim(),
        pageNumber: index + 1,
      }))
      .filter((node) => node.content.length > 0);

    if (nodes.length === 0) {
      console.warn(`[ingest] No content extracted for ${input.documentId}`);
      await updateDocumentStatus(input.documentId, "ready");
      return { documentId: input.documentId, nodeCount: 0 };
    }

    // Step 3: Embed all chunks
    const { embeddings } = await embedMany({
      model: gateway.embeddingModel(env.AI_EMBEDDING_MODEL),
      values: nodes.map((n) => n.content),
    });

    // Step 4: Upsert into Qdrant
    const qdrant = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
    });

    await ensureQdrantCollection(qdrant, env.QDRANT_COLLECTION);

    await qdrant.upsert(env.QDRANT_COLLECTION, {
      wait: true,
      points: nodes.map((node, index) => ({
        id: node.id,
        vector: embeddings[index] ?? [],
        payload: {
          documentId: input.documentId,
          chunkId: node.id,
          tagKeys: input.tagKeys,
          chunkIndex: index,
          content: node.content,
          pageNumber: node.pageNumber,
        },
      })),
    });

    // Step 5: Persist chunks to DB
    await saveDocumentChunks(
      input.documentId,
      nodes.map((node, index) => ({
        id: node.id,
        chunkIndex: index,
        content: node.content,
        qdrantPointId: node.id,
        pageNumber: node.pageNumber,
      })),
    );

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
