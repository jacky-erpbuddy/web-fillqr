import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readFile, stat } from "fs/promises";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

/**
 * Serviert Upload-Dateien aus dem Volume /data/uploads/.
 * Auth-geschuetzt: Nur eigene Tenant-Dateien sichtbar.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await requireAuth();
  const segments = (await params).path;

  // Erwartetes Format: /api/uploads/{tenantId}/{filename}
  if (segments.length !== 2) {
    return NextResponse.json({ error: "Ungueltig" }, { status: 400 });
  }

  const [tenantId, fileName] = segments;

  // Tenant-Isolation: Nur eigene Dateien
  if (tenantId !== user.tenantId) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  // Path Traversal verhindern
  if (tenantId.includes("..") || fileName.includes("..")) {
    return NextResponse.json({ error: "Ungueltig" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "data", "uploads", tenantId, fileName);

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  const buffer = await readFile(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
