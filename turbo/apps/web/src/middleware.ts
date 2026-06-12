import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPPORTED_LOCALES = ["it", "en"] as const;

export function middleware(request: NextRequest) {
  const hl = request.nextUrl.searchParams.get("hl");

  if (hl && SUPPORTED_LOCALES.includes(hl as (typeof SUPPORTED_LOCALES)[number])) {
    const response = NextResponse.next();
    response.cookies.set("locale", hl, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon.ico).*)",
};
