import { NextResponse } from "next/server";
import { z } from "zod";

import { mockUserCookieName } from "@/lib/auth";
import { getAllUsers } from "@/lib/queries";

const selectUserSchema = z.object({
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  const payload = selectUserSchema.parse(await request.json());
  const allUsers = await getAllUsers();
  const user = allUsers.find((u) => u.id === payload.userId);

  if (!user) {
    return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  }

  const response = NextResponse.json({ user });
  response.cookies.set(mockUserCookieName, user.id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
