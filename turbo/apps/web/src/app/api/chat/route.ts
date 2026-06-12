import { gateway } from "@ai-sdk/gateway";
import { QdrantClient } from "@qdrant/js-client-rest";
import { createDataStreamResponse, embed, streamText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import { buildQdrantAclFilter } from "@/lib/acl";
import { getCurrentUser } from "@/lib/auth";
import { getAccessibleDocuments } from "@/lib/demo-data";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .default([]),
});

type Reference = {
  documentId: string;
  chunkId: string;
  title: string;
  quote: string;
  score: number;
  pageNumber?: number;
};

export async function POST(request: Request) {
  if (!env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      { error: "AI_GATEWAY_API_KEY is not configured. Set it to enable chat." },
      { status: 503 },
    );
  }

  const { user, role } = await getCurrentUser();
  const payload = chatRequestSchema.parse(await request.json());
  const lastUserMessage = [...payload.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  let context = "";
  let references: Reference[] = [];

  if (env.QDRANT_URL && lastUserMessage) {
    try {
      const { embedding } = await embed({
        model: gateway.embeddingModel(env.AI_EMBEDDING_MODEL),
        value: lastUserMessage,
      });

      const qdrant = new QdrantClient({
        url: env.QDRANT_URL,
        apiKey: env.QDRANT_API_KEY,
      });

      const aclFilter = buildQdrantAclFilter(role.policy);

      const result = await qdrant.query(env.QDRANT_COLLECTION, {
        query: embedding,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: aclFilter as any,
        limit: 8,
        with_payload: true,
        with_vector: false,
      });

      references = result.points.map((point) => {
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

      context = references
        .map((ref) => `[${ref.title}] ${ref.quote}`)
        .join("\n\n");
    } catch (err) {
      console.error("[chat] Qdrant retrieval failed:", err);
    }
  }

  if (!context) {
    // Fallback: list accessible demo documents as context
    const docs = getAccessibleDocuments(user);
    context = docs.map((d) => `- ${d.title} [tags: ${d.tagKeys.join(", ")}]`).join("\n");
  }

  return createDataStreamResponse({
    execute: async (dataStream) => {
      if (references.length > 0) {
        dataStream.writeData({ references });
      }

      const result = streamText({
        model: gateway.chat(env.AI_GATEWAY_MODEL),
        system: [
          "You are a governed RAG assistant.",
          "Answer only from the accessible document context below.",
          "If the answer is not supported by the context, say so explicitly.",
          "",
          "Accessible document context:",
          context || "No accessible documents.",
        ].join("\n"),
        messages: payload.messages,
        providerOptions: {
          gateway: {
            tags: ["rag-chat"],
            user: user.id,
          },
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (error) => {
      console.error("[chat] Stream error:", error);
      return "An error occurred. Please try again.";
    },
  });
}
