import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { ingestDocumentWorkflow } from "@/workflows/ingest-document";
import { getDocumentStorageKey, getDocumentTagKeys } from "@/lib/queries";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const doc = await getDocumentStorageKey(id);

  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const tagKeys = await getDocumentTagKeys(id);

  await start(ingestDocumentWorkflow, [
    {
      documentId: id,
      storageKey: doc.storageKey,
      tagKeys: tagKeys.length > 0 ? tagKeys : ["any"],
      title: doc.title,
    },
  ]);

  return NextResponse.json({ documentId: id }, { status: 202 });
}
