import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { resolveUploadTagKeys } from "@/lib/acl";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentsForRole, saveDocument } from "@/lib/queries";
import { ingestDocumentWorkflow } from "@/workflows/ingest-document";

const BLOB_UPLOAD_TIMEOUT_MS = 30_000;

async function uploadToStorage(file: File, documentId: string) {
  const blobUpload = put(`documents/${documentId}/${file.name}`, file, {
    access: "public",
    token: env.BLOB_READ_WRITE_TOKEN,
  });

  try {
    const blob = await Promise.race([
      blobUpload,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Blob upload timed out.")), BLOB_UPLOAD_TIMEOUT_MS),
      ),
    ]);
    return { storageProvider: "vercel-blob", storageKey: blob.url };
  } catch (error) {
    console.warn("[documents] Blob upload failed, falling back to inline storage.", error);
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return {
      storageProvider: "inline-data-url",
      storageKey: `data:${file.type || "application/octet-stream"};base64,${base64}`,
    };
  }
}

export async function GET() {
  const { role } = await getCurrentUser();
  const docs = await getDocumentsForRole(role);
  return NextResponse.json({ documents: docs });
}

export async function POST(request: Request) {
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

  const { storageKey, storageProvider } = await uploadToStorage(file, documentId);

  await saveDocument({
    id: documentId,
    title,
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    storageProvider,
    storageKey,
    uploadedByUserId: user.id,
    tagKeys,
  });

  void ingestDocumentWorkflow({
    documentId,
    storageKey,
    tagKeys,
  }).catch((err: unknown) => {
    console.error(`[ingest] ${documentId} failed:`, err);
  });

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
}
