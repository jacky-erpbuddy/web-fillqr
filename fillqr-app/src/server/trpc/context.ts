import type { SessionData } from "@/lib/session";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

export type TRPCContext = {
  session: SessionData | null;
  prisma: PrismaClient;
};

export async function createContext(): Promise<TRPCContext> {
  let session: SessionData | null = null;

  try {
    const ironSession = await getSession();
    if (ironSession.userId) {
      session = {
        userId: ironSession.userId,
        tenantId: ironSession.tenantId,
        email: ironSession.email,
        appKey: ironSession.appKey,
      };
    }
  } catch {
    // Kaputtes Cookie oder SECRET geaendert — session bleibt null
  }

  return { session, prisma };
}
