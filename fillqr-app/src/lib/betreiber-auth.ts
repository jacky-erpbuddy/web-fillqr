import { redirect } from "next/navigation";
import { getBetreiberSession } from "@/lib/betreiber-session";

/**
 * Prueft ob der aktuelle Request eine gueltige Betreiber-Session hat.
 * Wirft redirect zu /login wenn nicht.
 * Kein Tenant-Check, kein User-Lookup — nur Session-Existenz.
 */
export async function requireBetreiber(): Promise<void> {
  try {
    const session = await getBetreiberSession();
    if (!session.isBetreiber) {
      redirect("/login");
    }
  } catch (err) {
    // redirect() wirft intern — das durchlassen
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[BETREIBER-AUTH] Session error:", err);
    redirect("/login");
  }
}
