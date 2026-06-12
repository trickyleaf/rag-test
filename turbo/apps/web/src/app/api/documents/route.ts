import { resolveUploadTagKeys } from "@repo/rag";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";

import { ingestDocumentWorkflow } from "@/workflows/ingest-document";
import { getCurrentUser } from "@/lib/auth";
import { getAccessibleDocuments } from "@/lib/demo-data";

const createDocumentSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  storageKey: z.string().min(1),
  tagKeys: z.array(z.string()).default([]),
  title: z.string().min(1).optional(),
});

export async function GET() {
  const { user } = await getCurrentUser();

  return NextResponse.json({
    documents: getAccessibleDocuments(user),
  });
}

export async function POST(request: Request) {
  const { user } = await getCurrentUser();
  const payload = createDocumentSchema.parse(await request.json());
  const documentId = crypto.randomUUID();
  const tagKeys = resolveUploadTagKeys(payload.tagKeys);

  const run = await start(ingestDocumentWorkflow, [
    {
      documentId,
      storageKey: payload.storageKey,
      tagKeys,
    },
  ]);

  return NextResponse.json(
    {
      document: {
        id: documentId,
        title: payload.title ?? payload.filename,
        filename: payload.filename,
        mimeType: payload.mimeType,
        status: "uploaded",
        tagKeys,
        uploadedByUserId: user.id,
      },
      workflowRunId: run.runId,
    },
    { status: 202 },
  );
}
