import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getAllRoles, getAllTags, getAllUsers } from "@/lib/queries";

export async function GET() {
  const { role } = await getCurrentUser();

  if (!role.policy.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [roles, tags, users] = await Promise.all([
    getAllRoles(),
    getAllTags(),
    getAllUsers(),
  ]);

  return NextResponse.json({ roles, tags, users });
}
