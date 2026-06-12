import { gateway } from "@ai-sdk/gateway";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
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

export async function POST(request: Request) {
  const { user, role } = await getCurrentUser();
  const payload = chatRequestSchema.parse(await request.json());
  const documents = getAccessibleDocuments(user);
  const context = documents
    .map((document) => `- ${document.title} [${document.tagKeys.join(", ")}]`)
    .join("\n");

  if (!env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({
      message:
        "AI Gateway is not configured yet. This mock response used the server-side ACL document set.",
      references: documents.slice(0, 3).map((document) => ({
        documentId: document.id,
        title: document.title,
        quote: `Accessible via tags: ${document.tagKeys.join(", ")}`,
        score: 1,
      })),
      role: role.name,
    });
  }

  const result = streamText({
    model: gateway.chat(env.AI_GATEWAY_MODEL),
    system: [
      "You are a governed RAG assistant.",
      "Answer only from the accessible document context.",
      "If the answer is unsupported by context, say so.",
      "",
      "Accessible documents:",
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

  return result.toTextStreamResponse();
}
