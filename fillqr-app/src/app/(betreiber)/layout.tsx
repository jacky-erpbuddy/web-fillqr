import Link from "next/link";
import { requireBetreiber } from "@/lib/betreiber-auth";

export default async function BetreiberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBetreiber();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">fillQR</h2>
            <span className="text-xs text-gray-500">Betreiber-Panel</span>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1">
            <Link
              href="/tenants"
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              Tenants
            </Link>
          </nav>

          <div className="px-6 py-4 border-t border-gray-200">
            <form action="/api/auth/betreiber-logout" method="POST">
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer p-0"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
