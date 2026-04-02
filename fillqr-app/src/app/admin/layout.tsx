import Link from "next/link";
import { headers } from "next/headers";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type NavItem = { href: string; label: string };

const NAV_MAP: Record<string, NavItem[]> = {
  vereinsbuddy: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/mitglieder", label: "Mitglieder" },
    { href: "/admin/einstellungen", label: "Einstellungen" },
  ],
  trainerfeedback: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/kurse", label: "Kurse" },
    { href: "/admin/einstellungen", label: "Einstellungen" },
  ],
  messebuddy: [
    { href: "/admin/leads", label: "Leads" },
    { href: "/admin/events", label: "Events" },
    { href: "/admin/einstellungen", label: "Einstellungen" },
  ],
};

const DEFAULT_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const headerList = await headers();
  const isDemo = headerList.get("x-tenant-slug") === "demo";

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { name: true },
  });

  const navItems = NAV_MAP[user.appKey] ?? DEFAULT_NAV;

  return (
    <div className="fq-admin">
      {/* Sidebar */}
      <aside className="fq-sidebar">
        <div className="fq-sidebar__header">
          <h2 className="fq-sidebar__title">
            {tenant?.name ?? "fillQR"}
          </h2>
        </div>

        <nav className="fq-sidebar__nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="fq-sidebar__link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="fq-sidebar__footer">
          <p className="fq-sidebar__email">{user.email}</p>
          {!isDemo && (
            <form action="/logout" method="POST">
              <button type="submit" className="fq-sidebar__logout">
                Abmelden
              </button>
            </form>
          )}
        </div>
      </aside>

      {/* Content */}
      <main className="fq-main">
        {isDemo && (
          <div className="fq-demo-banner">
            <strong>Demo-Ansicht</strong>
            Aenderungen werden alle 12 Stunden zurueckgesetzt.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
