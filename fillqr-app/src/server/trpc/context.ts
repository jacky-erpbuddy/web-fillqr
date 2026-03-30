import type { SessionData } from "@/lib/session";
import type { BetreiberSessionData } from "@/lib/betreiber-session";
import { getSession } from "@/lib/session";
import { getBetreiberSession } from "@/lib/betreiber-session";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

export type TRPCContext = {
  session: SessionData | null;
  betreiberSession: BetreiberSessionData | null;
  prisma: PrismaClient;
};

export async function createContext(): Promise<TRPCContext> {
  let session: SessionData | null = null;
  let betreiberSession: BetreiberSessionData | null = null;

  // Beide Sessions parallel laden
  const [customerResult, betreiberResult] = await Promise.allSettled([
    (async () => {
      const ironSession = await getSession();
      if (ironSession.userId) {
        return {
          userId: ironSession.userId,
          tenantId: ironSession.tenantId,
          email: ironSession.email,
          appKey: ironSession.appKey,
        };
      }
      return null;
    })(),
    (async () => {
      const ironSession = await getBetreiberSession();
      if (ironSession.isBetreiber) {
        return { isBetreiber: true as const };
      }
      return null;
    })(),
  ]);

  if (customerResult.status === "fulfilled" && customerResult.value) {
    session = customerResult.value;
  }
  if (betreiberResult.status === "fulfilled" && betreiberResult.value) {
    betreiberSession = betreiberResult.value;
  }

  return { session, betreiberSession, prisma };
}
