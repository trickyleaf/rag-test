import { inArray } from "drizzle-orm";
import type { DbClient } from "./client";
import { roleAllowedTags, roleDeniedTags, roles, tags, users } from "./schema";

export const systemTags = [
  {
    key: "any",
    label: "Any",
    description: "Default tag for generally visible documents.",
    isSystem: true,
  },
  {
    key: "super",
    label: "Super",
    description: "Administrative system tag.",
    isSystem: true,
  },
] as const;

export const demoTags = [
  ...systemTags,
  {
    key: "legal",
    label: "Legal",
    description: "Legal and contract documents.",
    isSystem: false,
  },
  {
    key: "finance",
    label: "Finance",
    description: "Financial reports and accounting documents.",
    isSystem: false,
  },
  {
    key: "hr",
    label: "HR",
    description: "Human resources documents.",
    isSystem: false,
  },
] as const;

export const demoRoles = [
  {
    name: "Admin",
    isAdmin: true,
    allowedTagKeys: ["any", "super", "legal", "finance", "hr"],
    deniedTagKeys: [] as string[],
  },
  {
    name: "Legal",
    isAdmin: false,
    allowedTagKeys: ["any", "legal"],
    deniedTagKeys: ["finance"],
  },
  {
    name: "Finance",
    isAdmin: false,
    allowedTagKeys: ["any", "finance"],
    deniedTagKeys: ["hr"],
  },
  {
    name: "Guest",
    isAdmin: false,
    allowedTagKeys: ["any"],
    deniedTagKeys: ["legal", "finance", "hr", "super"],
  },
] as const;

export const demoUsers = [
  { name: "Ada Admin",     email: "admin@example.test",   roleName: "Admin"   },
  { name: "Livia Legal",   email: "legal@example.test",   roleName: "Legal"   },
  { name: "Franco Finance",email: "finance@example.test", roleName: "Finance" },
  { name: "Gino Guest",    email: "guest@example.test",   roleName: "Guest"   },
] as const;

export async function runSeed(db: DbClient) {
  // 1. Tags (upsert by key)
  await db
    .insert(tags)
    .values(
      demoTags.map((t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
        isSystem: t.isSystem,
      })),
    )
    .onConflictDoNothing();

  // 2. Roles (upsert by name)
  await db
    .insert(roles)
    .values(
      demoRoles.map((r) => ({
        name: r.name,
        isAdmin: r.isAdmin,
      })),
    )
    .onConflictDoNothing();

  // 3. Resolve IDs
  const allTags = await db.select().from(tags);
  const tagIdByKey = new Map(allTags.map((t) => [t.key, t.id]));

  const allRoles = await db.select().from(roles);
  const roleIdByName = new Map(allRoles.map((r) => [r.name, r.id]));

  // 4. Role ACL edges
  for (const role of demoRoles) {
    const roleId = roleIdByName.get(role.name);
    if (!roleId) continue;

    const allowedIds = role.allowedTagKeys
      .map((k) => tagIdByKey.get(k))
      .filter((id): id is string => Boolean(id));

    if (allowedIds.length > 0) {
      await db
        .insert(roleAllowedTags)
        .values(allowedIds.map((tagId) => ({ roleId, tagId })))
        .onConflictDoNothing();
    }

    const deniedIds = role.deniedTagKeys
      .map((k) => tagIdByKey.get(k))
      .filter((id): id is string => Boolean(id));

    if (deniedIds.length > 0) {
      await db
        .insert(roleDeniedTags)
        .values(deniedIds.map((tagId) => ({ roleId, tagId })))
        .onConflictDoNothing();
    }
  }

  // 5. Users (upsert by email)
  for (const user of demoUsers) {
    const roleId = roleIdByName.get(user.roleName);
    if (!roleId) continue;
    await db
      .insert(users)
      .values({ name: user.name, email: user.email, roleId })
      .onConflictDoNothing();
  }

  console.log(`Seed complete: ${demoTags.length} tags, ${demoRoles.length} roles, ${demoUsers.length} users.`);
}

// Re-export inArray so the seed runner doesn't need a direct drizzle-orm import
export { inArray };
