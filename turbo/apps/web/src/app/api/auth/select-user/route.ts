import { NextResponse } from "next/server";
import { z } from "zod";

import { mockUserCookieName } from "@/lib/auth";
import { demoUsers } from "@/lib/demo-data";

const selectUserSchema = z.object({
  userId: z.string(),
});

export async function POST(request: Request) {
  const payload = selectUserSchema.parse(await request.json());
  const user = demoUsers.find((candidate) => candidate.id === payload.userId);

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
