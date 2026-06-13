import { gateway } from "@ai-sdk/gateway";
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
import { createQdrantClient } from "@/lib/qdrant";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())).default([]),
});

type Reference = {
  documentId: string;
  chunkId: string;
  title: string;
  content: string;
  quote: string;
  score: number;
  pageNumber?: number;
};

export async function POST(request: Request) {
  try {
    return await handleChat(request);
  } catch (err) {
    console.error("[chat] Unhandled error:", err);
    return new Response("Something went wrong while processing your question. Please try again.", {
      status: 500,
    });
  }
}

async function handleChat(request: Request): Promise<Response> {
  const { user, role } = await getCurrentUser();
  const payload = chatRequestSchema.parse(await request.json());
  const uiMessages = payload.messages as unknown as UIMessage[];
  const lastUserText =
    [...uiMessages].reverse().find((m) => m.role === "user")
      ?.parts?.find((p) => p.type === "text")?.text ?? "";

  let context = "";
  let references: Reference[] = [];

  if (lastUserText) {
    let embedding: number[];
    console.log(`[chat] Embedding query — model: ${env.AI_EMBEDDING_MODEL}, text length: ${lastUserText.length}`);
    try {
      ({ embedding } = await embed({
        model: gateway.embeddingModel(env.AI_EMBEDDING_MODEL),
        value: lastUserText,
      }));
      console.log(`[chat] Embedding done — vector dims: ${embedding.length}`);
    } catch (err) {
      console.error("[chat] Embedding error:", err);
      const isRateLimit =
        err instanceof Error && /rate.?limit/i.test(err.message);
      return new Response(
        isRateLimit
          ? "The AI gateway is rate-limited right now. Please wait a moment and try again."
          : "Failed to process your question. Please try again.",
        { status: isRateLimit ? 429 : 500 },
      );
    }

    const qdrant = createQdrantClient();
    const aclFilter = buildQdrantAclFilter(role.policy);
    console.log(`[chat] Qdrant query — collection: ${env.QDRANT_COLLECTION}, acl filter: ${JSON.stringify(aclFilter)}, limit: 8`);

    try {
      const result = await qdrant.query(env.QDRANT_COLLECTION, {
        query: embedding,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: aclFilter as any,
        limit: 8,
        with_payload: true,
        with_vector: false,
      });

      console.log(`[chat] Qdrant returned ${result.points.length} points — scores: [${result.points.map((p) => p.score?.toFixed(3)).join(", ")}]`);

      references = result.points.map((point) => {
        const p = (point.payload ?? {}) as Record<string, unknown>;
        const content = String(p.content ?? "");
        return {
          documentId: String(p.documentId ?? ""),
          chunkId: String(p.chunkId ?? point.id),
          title: String(p.title ?? p.sourceLabel ?? "Untitled"),
          content,
          quote: content.slice(0, 500),
          score: point.score ?? 0,
          pageNumber: typeof p.pageNumber === "number" ? p.pageNumber : undefined,
        };
      });

      // Build context from full chunk content so the LLM sees the complete text,
      // not just the 500-char preview used for source citations.
      context = references.map((ref) => `[${ref.title}]\n${ref.content}`).join("\n\n---\n\n");
      console.log(`[chat] Context built — ${references.length} chunks, total chars: ${context.length}`);
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

      const systemPrompt = [
        "You are a governed RAG assistant.",
        "Answer only from the accessible document context below.",
        "If the answer is not supported by the context, say so explicitly.",
        "",
        "Accessible document context:",
        context || "No accessible documents.",
      ].join("\n");

      console.log(
        `[chat] LLM call — model: ${env.AI_GATEWAY_MODEL}, messages: ${modelMessages.length}, context chars: ${context.length}, system prompt chars: ${systemPrompt.length}`,
      );
      if (!context) {
        console.warn("[chat] LLM call with EMPTY context — no RAG data will be available");
      }

      const result = streamText({
        model: gateway.chat(env.AI_GATEWAY_MODEL),
        system: systemPrompt,
        messages: modelMessages,
        providerOptions: {
          gateway: {
            tags: ["rag-chat"],
            user: user.id,
          },
        },
        onFinish: ({ usage, finishReason }) => {
          console.log(
            `[chat] LLM finished — reason: ${finishReason}, tokens: prompt=${usage?.promptTokens ?? "?"} completion=${usage?.completionTokens ?? "?"}`,
          );
        },
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      // Never forward raw error messages to the client: they can contain
      // internal details (URLs, header values, credentials).
      console.error("[chat] Stream error:", error);
      return "The assistant hit an error while answering. Please try again.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
