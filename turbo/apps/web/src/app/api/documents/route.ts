import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { resolveUploadTagKeys } from "@/lib/acl";
import { getCurrentUser } from "@/lib/auth";
import { getAccessibleDocuments } from "@/lib/demo-data";
import { ingestDocumentWorkflow } from "@/workflows/ingest-document";

export async function GET() {
  const { user } = await getCurrentUser();

  return NextResponse.json({ documents: getAccessibleDocuments(user) });
}

export async function POST(request: Request) {
  const { user } = await getCurrentUser();

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A non-empty file is required." }, { status: 400 });
  }

  if (!env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Document uploads require BLOB_READ_WRITE_TOKEN to be configured." },
      { status: 503 },
    );
  }

  const rawTagKeys = formData.getAll("tagKeys").map(String);
  const tagKeys = resolveUploadTagKeys(rawTagKeys);
  const title = String(formData.get("title") || file.name);
  const documentId = crypto.randomUUID();

  const blob = await put(`documents/${documentId}/${file.name}`, file, {
    access: "public",
    token: env.BLOB_READ_WRITE_TOKEN,
  });

  // Kick off ingestion without blocking the response
  void ingestDocumentWorkflow({
    documentId,
    storageKey: blob.url,
    tagKeys,
  }).catch((err: unknown) => {
    console.error(`[ingest] ${documentId} failed:`, err);
  });

  return NextResponse.json(
    {
      document: {
        id: documentId,
        title,
        filename: file.name,
        mimeType: file.type,
        status: "uploaded",
        tagKeys,
        uploadedByUserId: user.id,
      },
    },
    { status: 202 },
  );
}
