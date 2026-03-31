import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

const ALLOWED_TYPES: Record<string, string[]> = {
  logo: ["image/png", "image/jpeg", "image/svg+xml"],
  satzung: ["application/pdf", "image/png", "image/jpeg"],
  beitragsordnung: ["application/pdf", "image/png", "image/jpeg"],
};

const EXTENSION_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

export async function POST(req: NextRequest) {
  // Auth
  const user = await requireAuth();
  const tenantId = user.tenantId;

  // FormData parsen
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;

  if (!file || !type) {
    return NextResponse.json(
      { error: "Datei und Typ sind Pflicht" },
      { status: 400 },
    );
  }

  // Type validieren
  if (!ALLOWED_TYPES[type]) {
    return NextResponse.json(
      { error: "Ungueltiger Upload-Typ" },
      { status: 400 },
    );
  }

  // MIME-Check
  if (!ALLOWED_TYPES[type].includes(file.type)) {
    const allowed = ALLOWED_TYPES[type].join(", ");
    return NextResponse.json(
      { error: `Erlaubte Formate: ${allowed}` },
      { status: 400 },
    );
  }

  // Size-Check
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Datei zu gross (max. 2 MB)" },
      { status: 413 },
    );
  }

  const ext = EXTENSION_MAP[file.type] ?? "bin";
  const fileName = `${type}.${ext}`;
  const uploadDir = path.join(
    process.cwd(),
    "data",
    "uploads",
    tenantId,
  );

  // Verzeichnis erstellen
  await mkdir(uploadDir, { recursive: true });

  // Datei schreiben
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(uploadDir, fileName);
  await writeFile(filePath, buffer);

  // Pfad fuer DB + Frontend (via File-Serving-Route)
  const relativePath = `/api/uploads/${tenantId}/${fileName}`;

  // Bei Logo: logo_path in tbl_tenants aktualisieren
  if (type === "logo") {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoPath: relativePath },
    });
  }

  return NextResponse.json({ path: relativePath });
}
