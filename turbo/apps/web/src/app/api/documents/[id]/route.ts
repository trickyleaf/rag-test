import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteDocument,
  getDocumentStatusHistory,
  getDocumentsForRole,
} from "@/lib/queries";
import { createQdrantClient } from "@/lib/qdrant";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { role } = await getCurrentUser();
    const { id } = await params;

    const docs = await getDocumentsForRole(role);
    const document = docs.find((d) => d.id === id);
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const statusHistory = await getDocumentStatusHistory(id);
    return NextResponse.json({ document, statusHistory });
  } catch (err) {
    console.error("[documents] GET /api/documents/[id] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { role } = await getCurrentUser();
    if (!role?.policy.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { storageKey, qdrantPointIds } = await deleteDocument(id);

    if (storageKey) {
      try {
        await del(storageKey, { token: env.BLOB_READ_WRITE_TOKEN });
      } catch {
        // blob may already be gone — not fatal
      }
    }

    if (qdrantPointIds.length > 0 && env.QDRANT_URL) {
      try {
        const qdrant = createQdrantClient();
        await qdrant.delete(env.QDRANT_COLLECTION, { points: qdrantPointIds });
      } catch {
        // qdrant cleanup failure is not fatal
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[delete] DELETE /api/documents/[id] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
