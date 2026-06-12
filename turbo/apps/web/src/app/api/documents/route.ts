import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { env } from "@/config/env";
import { resolveUploadTagKeys } from "@/lib/acl";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentsForRole, saveDocument } from "@/lib/queries";
import { ingestDocumentWorkflow } from "@/workflows/ingest-document";

export async function GET() {
  const { role } = await getCurrentUser();
  const docs = await getDocumentsForRole(role);
  return NextResponse.json({ documents: docs });
}

export async function POST(request: Request) {
  try {
    const { user } = await getCurrentUser();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "A non-empty file is required." }, { status: 400 });
    }

    const rawTagKeys = formData.getAll("tagKeys").map(String);
    const tagKeys = resolveUploadTagKeys(rawTagKeys);
    const title = String(formData.get("title") || file.name);
    const documentId = crypto.randomUUID();

    const blob = await put(`documents/${documentId}/${file.name}`, file, {
      access: "private",
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    await saveDocument({
      id: documentId,
      title,
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storageProvider: "vercel-blob",
      storageKey: blob.url,
      uploadedByUserId: user.id,
      tagKeys,
    });

    await start(ingestDocumentWorkflow, [{ documentId, storageKey: blob.url, tagKeys, title }]);

    return NextResponse.json(
      {
        document: {
          id: documentId,
          title,
          originalFilename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          status: "uploaded",
          tagKeys,
          uploadedByUserId: user.id,
          updatedAt: new Date().toISOString().slice(0, 10),
        },
      },
      { status: 202 },
    );
  } catch (err) {
    console.error("[upload] POST /api/documents failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
