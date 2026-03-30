import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "fillqr_session";

export interface SessionData {
  userId: string;
  tenantId: string;
  email: string;
  appKey: string;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: SESSION_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
    path: "/",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
