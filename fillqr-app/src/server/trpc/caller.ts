import { appRouter } from "./routers/_app";
import { createContext } from "./context";

/**
 * Server-Side Caller fuer Server Components.
 * Ruft tRPC-Procedures direkt auf (kein HTTP-Overhead).
 */
export async function createCaller() {
  const ctx = await createContext();
  return appRouter.createCaller(ctx);
}
