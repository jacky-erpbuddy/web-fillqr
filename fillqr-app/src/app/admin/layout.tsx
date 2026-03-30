import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { name: true },
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar — hidden on mobile (V1: Desktop only) */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Tenant Name */}
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {tenant?.name ?? "fillQR"}
            </h2>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            <NavLink href="/admin/dashboard">Dashboard</NavLink>
          </nav>

          {/* User Info + Logout */}
          <div className="px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 truncate">{user.email}</p>
            <form action="/logout" method="POST" style={{ marginTop: 8 }}>
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

      {/* Content */}
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    >
      {children}
    </Link>
  );
}
