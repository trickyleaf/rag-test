import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { demoRoles, demoTags, demoUsers } from "@/lib/demo-data";

export async function GET() {
  const { role } = await getCurrentUser();

  if (!role.policy.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    roles: demoRoles,
    tags: demoTags,
    users: demoUsers,
  });
}
