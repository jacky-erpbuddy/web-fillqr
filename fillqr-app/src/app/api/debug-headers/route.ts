import { NextRequest, NextResponse } from "next/server";

/** TEMPORARY — shows all request headers + cookie status. DELETE after debugging. */
export async function GET(request: NextRequest) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Redact auth/cookie values
    if (key === "authorization") {
      headers[key] = value.substring(0, 10) + "...REDACTED";
    } else if (key === "cookie") {
      headers[key] = value.includes("fillqr_session")
        ? "fillqr_session=PRESENT (length:" + (value.match(/fillqr_session=([^;]*)/)?.[1]?.length ?? 0) + ")"
        : "fillqr_session=MISSING | raw=" + value.substring(0, 80);
    } else {
      headers[key] = value;
    }
  });

  return NextResponse.json({
    headers,
    url: request.url,
    nextUrl: {
      protocol: request.nextUrl.protocol,
      host: request.nextUrl.host,
      pathname: request.nextUrl.pathname,
    },
  });
}
