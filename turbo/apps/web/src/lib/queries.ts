import { asc, desc, eq, inArray } from "drizzle-orm";
import {
  documentChunks,
  documentStatusEvents,
  documentTags,
  documents,
  roleAllowedTags,
  roleDeniedTags,
  roles,
  tags,
  users,
} from "@repo/db/schema";

import { canAccessDocument } from "./acl";
import { getDb } from "./db";
import type { AppDocument, AppRole, AppTag, AppUser } from "./types";

async function buildRoleWithPolicy(
  db: ReturnType<typeof getDb>,
  roleId: string,
  roleName: string,
  isAdmin: boolean,
): Promise<AppRole> {
  const [allowedRows, deniedRows] = await Promise.all([
    db
      .select({ key: tags.key })
      .from(roleAllowedTags)
      .innerJoin(tags, eq(roleAllowedTags.tagId, tags.id))
      .where(eq(roleAllowedTags.roleId, roleId)),
    db
      .select({ key: tags.key })
      .from(roleDeniedTags)
      .innerJoin(tags, eq(roleDeniedTags.tagId, tags.id))
      .where(eq(roleDeniedTags.roleId, roleId)),
  ]);

  return {
    id: roleId,
    name: roleName,
    policy: {
      isAdmin,
      allowedTagKeys: allowedRows.map((r) => r.key),
      deniedTagKeys: deniedRows.map((r) => r.key),
    },
  };
}

export async function getAllRoles(): Promise<AppRole[]> {
  const db = getDb();
  const allRoles = await db.select().from(roles);
  return Promise.all(allRoles.map((r) => buildRoleWithPolicy(db, r.id, r.name, r.isAdmin)));
}

export async function getAllTags(): Promise<AppTag[]> {
  const db = getDb();
  const rows = await db.select().from(tags);
  return rows.map((t) => ({
    id: t.id,
    key: t.key,
    label: t.label,
    description: t.description,
    isSystem: t.isSystem,
  }));
}

export async function getAllUsers(): Promise<AppUser[]> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, roleId: users.roleId, roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id));
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, roleId: r.roleId, roleName: r.roleName }));
}

export async function getUserById(
  userId: string,
): Promise<{ user: AppUser; role: AppRole } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, roleId: users.roleId, roleName: roles.name, roleIsAdmin: roles.isAdmin })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  const role = await buildRoleWithPolicy(db, row.roleId, row.roleName, row.roleIsAdmin);
  return { user: { id: row.id, name: row.name, email: row.email, roleId: row.roleId, roleName: row.roleName }, role };
}

export async function getDefaultUserAndRole(): Promise<{ user: AppUser; role: AppRole }> {
  const db = getDb();
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email, roleId: users.roleId, roleName: roles.name, roleIsAdmin: roles.isAdmin })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .limit(1);
  if (!row) throw new Error("No users found in database — run the seed script first");
  const role = await buildRoleWithPolicy(db, row.roleId, row.roleName, row.roleIsAdmin);
  return { user: { id: row.id, name: row.name, email: row.email, roleId: row.roleId, roleName: row.roleName }, role };
}

export async function getDocumentsForRole(role: AppRole): Promise<AppDocument[]> {
  const db = getDb();
  const allDocs = await db.select().from(documents);
  if (allDocs.length === 0) return [];
  const tagRows = await db
    .select({ documentId: documentTags.documentId, tagKey: tags.key })
    .from(documentTags)
    .innerJoin(tags, eq(documentTags.tagId, tags.id));
  const tagsByDoc = new Map<string, string[]>();
  for (const row of tagRows) {
    const existing = tagsByDoc.get(row.documentId) ?? [];
    existing.push(row.tagKey);
    tagsByDoc.set(row.documentId, existing);
  }
  const appDocs: AppDocument[] = allDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    tagKeys: tagsByDoc.get(doc.id) ?? [],
    uploadedByUserId: doc.uploadedByUserId,
    updatedAt: doc.updatedAt.toISOString().slice(0, 10),
  }));
  return appDocs.filter((d) => canAccessDocument(role.policy, { tagKeys: d.tagKeys }));
}

export async function saveDocument(data: {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  storageKey: string;
  uploadedByUserId: string;
  tagKeys: string[];
}): Promise<void> {
  const db = getDb();

  await db.insert(documents).values({
    id: data.id,
    title: data.title,
    originalFilename: data.originalFilename,
    mimeType: data.mimeType,
    sizeBytes: data.sizeBytes,
    storageProvider: data.storageProvider,
    storageKey: data.storageKey,
    uploadedByUserId: data.uploadedByUserId,
    status: "uploaded",
  });

  await db.insert(documentStatusEvents).values({
    documentId: data.id,
    fromStatus: null,
    toStatus: "uploaded",
  });

  if (data.tagKeys.length > 0) {
    const matchedTags = await db
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.key, data.tagKeys));

    if (matchedTags.length > 0) {
      await db
        .insert(documentTags)
        .values(matchedTags.map((t) => ({ documentId: data.id, tagId: t.id })))
        .onConflictDoNothing();
    }
  }
}

export async function updateDocumentStatus(
  documentId: string,
  status: "uploaded" | "processing" | "ready" | "failed",
  errorMessage?: string,
): Promise<void> {
  const db = getDb();
  const [previous] = await db
    .update(documents)
    .set({
      status,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId))
    .returning({ id: documents.id });
  if (!previous) return;

  const [lastEvent] = await db
    .select({ toStatus: documentStatusEvents.toStatus })
    .from(documentStatusEvents)
    .where(eq(documentStatusEvents.documentId, documentId))
    .orderBy(desc(documentStatusEvents.createdAt))
    .limit(1);

  await db.insert(documentStatusEvents).values({
    documentId,
    fromStatus: lastEvent?.toStatus ?? null,
    toStatus: status,
    errorMessage: errorMessage ?? null,
  });
}

export async function getDocumentStatusHistory(documentId: string): Promise<
  Array<{
    fromStatus: string | null;
    toStatus: string;
    errorMessage: string | null;
    createdAt: string;
  }>
> {
  const db = getDb();
  const rows = await db
    .select({
      fromStatus: documentStatusEvents.fromStatus,
      toStatus: documentStatusEvents.toStatus,
      errorMessage: documentStatusEvents.errorMessage,
      createdAt: documentStatusEvents.createdAt,
    })
    .from(documentStatusEvents)
    .where(eq(documentStatusEvents.documentId, documentId))
    .orderBy(asc(documentStatusEvents.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function getDocumentTagKeys(documentId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ tagKey: tags.key })
    .from(documentTags)
    .innerJoin(tags, eq(documentTags.tagId, tags.id))
    .where(eq(documentTags.documentId, documentId));
  return rows.map((r) => r.tagKey);
}

export async function getDocumentStorageKey(
  documentId: string,
): Promise<{ storageKey: string; originalFilename: string; title: string } | null> {
  const db = getDb();
  const rows = await db
    .select({
      storageKey: documents.storageKey,
      originalFilename: documents.originalFilename,
      title: documents.title,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteDocument(
  documentId: string,
): Promise<{ storageKey: string | null; qdrantPointIds: string[] }> {
  const db = getDb();

  const [docRow] = await db
    .select({ storageKey: documents.storageKey })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  const chunkRows = await db
    .select({ qdrantPointId: documentChunks.qdrantPointId })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId));

  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
  await db.delete(documentTags).where(eq(documentTags.documentId, documentId));
  await db.delete(documents).where(eq(documents.id, documentId));

  return {
    storageKey: docRow?.storageKey ?? null,
    qdrantPointIds: chunkRows.map((r) => r.qdrantPointId),
  };
}

export async function saveDocumentChunks(
  documentId: string,
  chunks: Array<{
    id: string;
    chunkIndex: number;
    content: string;
    qdrantPointId: string;
    pageNumber?: number;
  }>,
): Promise<void> {
  const db = getDb();

  await db.insert(documentChunks).values(
    chunks.map((c) => ({
      id: c.id,
      documentId,
      chunkIndex: c.chunkIndex,
      content: c.content,
      qdrantPointId: c.qdrantPointId,
      metadataJson: c.pageNumber !== undefined ? { pageNumber: c.pageNumber } : {},
    })),
  );
}
