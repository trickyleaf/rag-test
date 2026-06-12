import { canAccessDocument, type RoleAccessPolicy } from "@repo/rag";

export type DemoRole = {
  id: string;
  name: string;
  policy: RoleAccessPolicy;
};

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
};

export type DemoTag = {
  key: string;
  label: string;
  description: string;
  isSystem?: boolean;
};

export type DemoDocument = {
  id: string;
  title: string;
  filename: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  tagKeys: string[];
  uploadedByUserId: string;
  updatedAt: string;
};

export const demoTags = [
  {
    key: "any",
    label: "Any",
    description: "Default visibility tag.",
    isSystem: true,
  },
  {
    key: "super",
    label: "Super",
    description: "Administrative tag.",
    isSystem: true,
  },
  {
    key: "legal",
    label: "Legal",
    description: "Contracts and legal material.",
  },
  {
    key: "finance",
    label: "Finance",
    description: "Finance and accounting material.",
  },
  {
    key: "hr",
    label: "HR",
    description: "Human resources material.",
  },
] satisfies DemoTag[];

export const demoRoles = [
  {
    id: "admin",
    name: "Admin",
    policy: {
      isAdmin: true,
      allowedTagKeys: ["any", "super", "legal", "finance", "hr"],
      deniedTagKeys: [],
    },
  },
  {
    id: "legal",
    name: "Legal",
    policy: {
      isAdmin: false,
      allowedTagKeys: ["any", "legal"],
      deniedTagKeys: ["finance"],
    },
  },
  {
    id: "finance",
    name: "Finance",
    policy: {
      isAdmin: false,
      allowedTagKeys: ["any", "finance"],
      deniedTagKeys: ["hr"],
    },
  },
  {
    id: "guest",
    name: "Guest",
    policy: {
      isAdmin: false,
      allowedTagKeys: ["any"],
      deniedTagKeys: ["super", "legal", "finance", "hr"],
    },
  },
] satisfies DemoRole[];

export const demoUsers = [
  {
    id: "ada",
    name: "Ada Admin",
    email: "admin@example.test",
    roleId: "admin",
  },
  {
    id: "livia",
    name: "Livia Legal",
    email: "legal@example.test",
    roleId: "legal",
  },
  {
    id: "franco",
    name: "Franco Finance",
    email: "finance@example.test",
    roleId: "finance",
  },
  {
    id: "gino",
    name: "Gino Guest",
    email: "guest@example.test",
    roleId: "guest",
  },
] satisfies DemoUser[];

const defaultRole = demoRoles[0] as DemoRole;
const defaultUser = demoUsers[0] as DemoUser;

export const demoDocuments = [
  {
    id: "doc-nda",
    title: "NDA Template",
    filename: "nda-template.pdf",
    status: "ready",
    tagKeys: ["legal"],
    uploadedByUserId: "ada",
    updatedAt: "2026-06-12",
  },
  {
    id: "doc-budget",
    title: "Budget Q2",
    filename: "budget-q2.pdf",
    status: "processing",
    tagKeys: ["finance"],
    uploadedByUserId: "franco",
    updatedAt: "2026-06-12",
  },
  {
    id: "doc-handbook",
    title: "Company Handbook",
    filename: "company-handbook.pdf",
    status: "ready",
    tagKeys: ["any"],
    uploadedByUserId: "ada",
    updatedAt: "2026-06-11",
  },
  {
    id: "doc-payroll",
    title: "Payroll Policy",
    filename: "payroll-policy.pdf",
    status: "failed",
    tagKeys: ["hr", "finance"],
    uploadedByUserId: "ada",
    updatedAt: "2026-06-10",
  },
] satisfies DemoDocument[];

export function getDemoRole(roleId: string) {
  return demoRoles.find((role) => role.id === roleId) ?? defaultRole;
}

export function getDemoUser(userId: string | undefined) {
  return demoUsers.find((user) => user.id === userId) ?? defaultUser;
}

export function getAccessibleDocuments(user: DemoUser) {
  const role = getDemoRole(user.roleId);

  return demoDocuments.filter((document) =>
    canAccessDocument(role.policy, { tagKeys: document.tagKeys }),
  );
}
