import { del } from "@vercel/blob";
import { QdrantClient } from "@qdrant/js-client-rest";
import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { getCurrentUser } from "@/lib/auth";
import { deleteDocument } from "@/lib/queries";

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
        const qdrant = new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY });
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
