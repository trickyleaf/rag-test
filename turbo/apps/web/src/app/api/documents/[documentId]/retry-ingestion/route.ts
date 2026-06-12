import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { ingestDocumentWorkflow } from "@/workflows/ingest-document";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { documentId } = await context.params;
  const run = await start(ingestDocumentWorkflow, [
    {
      documentId,
      storageKey: `retry/${documentId}`,
      tagKeys: ["any"],
    },
  ]);

  return NextResponse.json(
    {
      documentId,
      workflowRunId: run.runId,
    },
    { status: 202 },
  );
}
