"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function login(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    redirect("/login?error=E-Mail+und+Passwort+eingeben");
  }

  const user = await prisma.appUser.findUnique({
    where: { email },
  });

  if (!user) {
    // Gleiche Meldung wie bei falschem Passwort (keine Account-Aufzaehlung)
    redirect("/login?error=E-Mail+oder+Passwort+falsch");
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    redirect("/login?error=E-Mail+oder+Passwort+falsch");
  }

  // Tenant-Status pruefen (Komfort: fruehes Abfangen bei Login)
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { status: true },
  });

  if (!tenant || (tenant.status !== "ACTIVE" && tenant.status !== "TRIAL")) {
    redirect("/login?error=Konto+deaktiviert");
  }

  const session = await getSession();
  session.userId = user.id;
  session.tenantId = user.tenantId;
  session.email = user.email;
  session.role = user.role;
  await session.save();

  redirect("/dashboard");
}
