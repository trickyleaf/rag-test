import { gateway } from "@ai-sdk/gateway";
import { QdrantClient } from "@qdrant/js-client-rest";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { env } from "@/config/env";
import { buildQdrantAclFilter } from "@/lib/acl";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).default([]),
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
  const { user, role } = await getCurrentUser();
  const payload = chatRequestSchema.parse(await request.json());
  const uiMessages = payload.messages as unknown as UIMessage[];
  const lastUserText =
    [...uiMessages].reverse().find((m) => m.role === "user")
      ?.parts?.find((p) => p.type === "text")?.text ?? "";

  let context = "";
  let references: Reference[] = [];

  if (lastUserText) {
    const { embedding } = await embed({
      model: gateway.embeddingModel(env.AI_EMBEDDING_MODEL),
      value: lastUserText,
    });

    const qdrant = new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY });
    const aclFilter = buildQdrantAclFilter(role.policy);

    try {
      const result = await qdrant.query(env.QDRANT_COLLECTION, {
        query: embedding,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: aclFilter as any,
        limit: 8,
        with_payload: true,
        with_vector: false,
      });

      references = result.points.map((point) => {
        const p = (point.payload ?? {}) as Record<string, unknown>;
        const content = String(p.content ?? "");
        return {
          documentId: String(p.documentId ?? ""),
          chunkId: String(p.chunkId ?? point.id),
          title: String(p.title ?? p.sourceLabel ?? "Untitled"),
          quote: content.slice(0, 500),
          score: point.score ?? 0,
          pageNumber: typeof p.pageNumber === "number" ? p.pageNumber : undefined,
        };
      });

      context = references.map((ref) => `[${ref.title}] ${ref.quote}`).join("\n\n");
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qdrantError = (err as any)?.data?.status?.error as string | undefined;
      if (qdrantError?.includes("doesn't exist")) {
        // Collection not created yet — no documents ingested, proceed with empty context
        console.warn("[chat] Qdrant collection not found, proceeding with empty context");
      } else {
        console.error("[chat] Qdrant retrieval error:", err);
        return new Response("Failed to retrieve documents from the knowledge base. Please try again.", {
          status: 500,
        });
      }
    }
  }

  const modelMessages = await convertToModelMessages(uiMessages);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      for (const ref of references) {
        writer.write({
          type: "source-url",
          sourceId: ref.documentId,
          url: `#doc-${ref.documentId}`,
          title: `${ref.title}${ref.pageNumber ? ` (p.${ref.pageNumber})` : ""} — score: ${ref.score.toFixed(3)}`,
        });
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
        messages: modelMessages,
        providerOptions: {
          gateway: {
            tags: ["rag-chat"],
            user: user.id,
          },
        },
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("[chat] Stream error:", error);
      return error instanceof Error ? error.message : "An error occurred. Please try again.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
