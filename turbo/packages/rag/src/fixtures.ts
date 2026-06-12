import type { RoleAccessPolicy } from "./acl";

export const demoPolicies = {
  admin: {
    isAdmin: true,
    allowedTagKeys: ["any", "super", "legal", "finance", "hr"],
    deniedTagKeys: [],
  },
  legal: {
    isAdmin: false,
    allowedTagKeys: ["any", "legal"],
    deniedTagKeys: ["finance"],
  },
  finance: {
    isAdmin: false,
    allowedTagKeys: ["any", "finance"],
    deniedTagKeys: ["hr"],
  },
  guest: {
    isAdmin: false,
    allowedTagKeys: ["any"],
    deniedTagKeys: ["legal", "finance", "hr", "super"],
  },
} satisfies Record<string, RoleAccessPolicy>;
