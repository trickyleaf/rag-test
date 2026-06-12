import { eq, inArray } from "drizzle-orm";
import {
  documentChunks,
  documentTags,
  documents,
  roleAllowedTags,
  roleDeniedTags,
  roles,
  tags,
  users,
} from "@repo/db/schema";
import { demoRoles, demoTags, demoUsers } from "@repo/db/seed";

import { canAccessDocument } from "./acl";
import { getDb } from "./db";
import type { AppDocument, AppRole, AppTag, AppUser } from "./types";

// ---------- demo-data fallbacks (used when DATABASE_URL is not set) ----------

const DEMO_DOCUMENTS: AppDocument[] = [
  {
    id: "doc-nda",
    title: "NDA Template",
    originalFilename: "nda-template.pdf",
    mimeType: "application/pdf",
    sizeBytes: 0,
    status: "ready",
    tagKeys: ["legal"],
    uploadedByUserId: "demo",
    updatedAt: "2026-06-12",
  },
  {
    id: "doc-budget",
    title: "Budget Q2",
    originalFilename: "budget-q2.pdf",
    mimeType: "application/pdf",
    sizeBytes: 0,
    status: "processing",
    tagKeys: ["finance"],
    uploadedByUserId: "demo",
    updatedAt: "2026-06-12",
  },
  {
    id: "doc-handbook",
    title: "Company Handbook",
    originalFilename: "company-handbook.pdf",
    mimeType: "application/pdf",
    sizeBytes: 0,
    status: "ready",
    tagKeys: ["any"],
    uploadedByUserId: "demo",
    updatedAt: "2026-06-11",
  },
  {
    id: "doc-payroll",
    title: "Payroll Policy",
    originalFilename: "payroll-policy.pdf",
    mimeType: "application/pdf",
    sizeBytes: 0,
    status: "failed",
    tagKeys: ["hr", "finance"],
    uploadedByUserId: "demo",
    updatedAt: "2026-06-10",
  },
];

function upsertDemoDocument(document: AppDocument) {
  const index = DEMO_DOCUMENTS.findIndex((d) => d.id === document.id);
  if (index >= 0) {
    DEMO_DOCUMENTS[index] = document;
    return;
  }
  DEMO_DOCUMENTS.unshift(document);
}

function updateDemoDocumentStatus(
  documentId: string,
  status: "uploaded" | "processing" | "ready" | "failed",
) {
  const existing = DEMO_DOCUMENTS.find((d) => d.id === documentId);
  if (!existing) return;
  existing.status = status;
  existing.updatedAt = new Date().toISOString().slice(0, 10);
}

function fallbackRole(r: (typeof demoRoles)[number]): AppRole {
  return {
    id: r.name.toLowerCase(),
    name: r.name,
    policy: {
      isAdmin: r.isAdmin,
      allowedTagKeys: [...r.allowedTagKeys],
      deniedTagKeys: [...r.deniedTagKeys],
    },
  };
}

function fallbackRoles(): AppRole[] {
  return demoRoles.map(fallbackRole);
}

function fallbackUsers(): AppUser[] {
  type DU = (typeof demoUsers)[number];
  type DR = (typeof demoRoles)[number];
  return (demoUsers as readonly DU[]).map((u: DU) => {
    const role = (demoRoles as readonly DR[]).find((r: DR) => r.name === u.roleName)!;
    return {
      id: u.email.split("@")[0]!,
      name: u.name,
      email: u.email,
      roleId: role.name.toLowerCase(),
      roleName: role.name,
    };
  });
}

function fallbackTags(): AppTag[] {
  type DT = (typeof demoTags)[number];
  return (demoTags as readonly DT[]).map((t: DT) => ({
    id: t.key,
    key: t.key,
    label: t.label,
    description: t.description,
    isSystem: t.isSystem,
  }));
}

// ---------- helpers ----------

async function run<T>(fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback();
  }
}

// ---------- DB queries ----------

async function buildRoleWithPolicy(
  db: NonNullable<ReturnType<typeof getDb>>,
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
  if (!db) return fallbackRoles();
  return run(async () => {
    const allRoles = await db.select().from(roles);
    return Promise.all(allRoles.map((r) => buildRoleWithPolicy(db, r.id, r.name, r.isAdmin)));
  }, fallbackRoles);
}

export async function getAllTags(): Promise<AppTag[]> {
  const db = getDb();
  if (!db) return fallbackTags();
  return run(async () => {
    const rows = await db.select().from(tags);
    return rows.map((t) => ({
      id: t.id, key: t.key, label: t.label, description: t.description, isSystem: t.isSystem,
    }));
  }, fallbackTags);
}

export async function getAllUsers(): Promise<AppUser[]> {
  const db = getDb();
  if (!db) return fallbackUsers();
  return run(async () => {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, roleId: users.roleId, roleName: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id));
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, roleId: r.roleId, roleName: r.roleName }));
  }, fallbackUsers);
}

export async function getUserById(
  userId: string,
): Promise<{ user: AppUser; role: AppRole } | null> {
  const db = getDb();
  const fbFallback = () => {
    const fbUsers = fallbackUsers();
    const fbRoles = fallbackRoles();
    const u = fbUsers.find((x) => x.id === userId);
    if (!u) return null;
    const r = fbRoles.find((x) => x.id === u.roleId);
    return r ? { user: u, role: r } : null;
  };
  if (!db) return fbFallback();
  return run(async () => {
    const [row] = await db
      .select({ id: users.id, name: users.name, email: users.email, roleId: users.roleId, roleName: roles.name, roleIsAdmin: roles.isAdmin })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return null;
    const role = await buildRoleWithPolicy(db, row.roleId, row.roleName, row.roleIsAdmin);
    return { user: { id: row.id, name: row.name, email: row.email, roleId: row.roleId, roleName: row.roleName }, role };
  }, fbFallback);
}

export async function getDefaultUserAndRole(): Promise<{ user: AppUser; role: AppRole }> {
  const db = getDb();
  const fbFallback = () => {
    const fbUsers = fallbackUsers();
    const fbRoles = fallbackRoles();
    const u = fbUsers[0]!;
    const r = fbRoles.find((x) => x.id === u.roleId)!;
    return { user: u, role: r };
  };
  if (!db) return fbFallback();
  return run(async () => {
    const [row] = await db
      .select({ id: users.id, name: users.name, email: users.email, roleId: users.roleId, roleName: roles.name, roleIsAdmin: roles.isAdmin })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .limit(1);
    if (!row) return fbFallback();
    const role = await buildRoleWithPolicy(db, row.roleId, row.roleName, row.roleIsAdmin);
    return { user: { id: row.id, name: row.name, email: row.email, roleId: row.roleId, roleName: row.roleName }, role };
  }, fbFallback);
}

export async function getDocumentsForRole(role: AppRole): Promise<AppDocument[]> {
  const db = getDb();
  const fbFallback = () =>
    DEMO_DOCUMENTS.filter((d) => canAccessDocument(role.policy, { tagKeys: d.tagKeys }));
  if (!db) return fbFallback();
  return run(async () => {
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
      id: doc.id, title: doc.title, originalFilename: doc.originalFilename,
      mimeType: doc.mimeType, sizeBytes: doc.sizeBytes, status: doc.status,
      tagKeys: tagsByDoc.get(doc.id) ?? [],
      uploadedByUserId: doc.uploadedByUserId,
      updatedAt: doc.updatedAt.toISOString().slice(0, 10),
    }));
    return appDocs.filter((d) => canAccessDocument(role.policy, { tagKeys: d.tagKeys }));
  }, fbFallback);
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
  if (!db) {
    upsertDemoDocument({
      id: data.id,
      title: data.title,
      originalFilename: data.originalFilename,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      status: "uploaded",
      tagKeys: data.tagKeys,
      uploadedByUserId: data.uploadedByUserId,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    return;
  }

  try {
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
  } catch {
    upsertDemoDocument({
      id: data.id,
      title: data.title,
      originalFilename: data.originalFilename,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      status: "uploaded",
      tagKeys: data.tagKeys,
      uploadedByUserId: data.uploadedByUserId,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  }
}

export async function updateDocumentStatus(
  documentId: string,
  status: "uploaded" | "processing" | "ready" | "failed",
  errorMessage?: string,
): Promise<void> {
  const db = getDb();
  if (!db) {
    updateDemoDocumentStatus(documentId, status);
    return;
  }

  try {
    await db
      .update(documents)
      .set({
        status,
        errorMessage: errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
  } catch {
    updateDemoDocumentStatus(documentId, status);
  }
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
  if (!db) return;

  try {
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
  } catch {
    // Ignore in demo fallback mode.
  }
}
