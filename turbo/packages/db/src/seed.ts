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
    deniedTagKeys: [],
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
  {
    name: "Ada Admin",
    email: "admin@example.test",
    roleName: "Admin",
  },
  {
    name: "Livia Legal",
    email: "legal@example.test",
    roleName: "Legal",
  },
  {
    name: "Franco Finance",
    email: "finance@example.test",
    roleName: "Finance",
  },
  {
    name: "Gino Guest",
    email: "guest@example.test",
    roleName: "Guest",
  },
] as const;
