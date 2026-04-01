import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { validateTurnstile } from "@/lib/turnstile";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/jpeg", "image/png"];
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const turnstileToken = formData.get("turnstileToken") as string | null;

  if (!file || !turnstileToken) {
    return NextResponse.json(
      { error: "Datei und Sicherheitstoken sind Pflicht" },
      { status: 400 },
    );
  }

  // Turnstile validieren
  const valid = await validateTurnstile(turnstileToken);
  if (!valid) {
    return NextResponse.json(
      { error: "Sicherheitspruefung fehlgeschlagen" },
      { status: 400 },
    );
  }

  // MIME-Check
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "Nur JPG und PNG erlaubt" },
      { status: 400 },
    );
  }

  // Size-Check
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Datei zu gross (max. 5 MB)" },
      { status: 413 },
    );
  }

  // Tenant aus Header
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");
  if (!slug) {
    return NextResponse.json({ error: "Kein Tenant" }, { status: 400 });
  }

  const tenantApp = await prisma.tenantApp.findUnique({
    where: { slug },
    select: { tenantId: true, isEnabled: true },
  });

  if (!tenantApp || !tenantApp.isEnabled) {
    return NextResponse.json(
      { error: "Tenant nicht gefunden" },
      { status: 404 },
    );
  }

  const ext = EXT_MAP[file.type] ?? "jpg";
  const fileName = `temp_${randomUUID()}.${ext}`;
  const uploadDir = path.join(
    process.cwd(),
    "data",
    "uploads",
    tenantApp.tenantId,
    "members",
  );

  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, fileName), buffer);

  const relativePath = `/api/uploads/${tenantApp.tenantId}/members/${fileName}`;

  return NextResponse.json({ path: relativePath });
}
