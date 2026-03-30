import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export const BETREIBER_COOKIE_NAME = "fillqr_betreiber";

export interface BetreiberSessionData {
  isBetreiber: true;
}

const betreiberSessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: BETREIBER_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24, // 24h
    path: "/",
  },
};

export async function getBetreiberSession(): Promise<
  IronSession<BetreiberSessionData>
> {
  const cookieStore = await cookies();
  return getIronSession<BetreiberSessionData>(
    cookieStore,
    betreiberSessionOptions,
  );
}

export async function destroyBetreiberSession(): Promise<void> {
  const session = await getBetreiberSession();
  session.destroy();
}
