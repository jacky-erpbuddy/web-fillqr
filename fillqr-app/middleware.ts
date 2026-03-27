import { NextRequest, NextResponse } from "next/server";
import { extractSubdomain, isReserved } from "@/lib/tenant";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  try {
    const host = request.headers.get("host") ?? "";
    let slug = extractSubdomain(host);

    // Dev-Fallback: ?tenant=slug wenn kein Subdomain-Routing
    if (!slug && process.env.NODE_ENV === "development") {
      slug = request.nextUrl.searchParams.get("tenant");
    }

    if (slug && !isReserved(slug)) {
      response.headers.set("x-tenant-slug", slug);
    }
  } catch (error) {
    console.error("Tenant middleware error:", error);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
