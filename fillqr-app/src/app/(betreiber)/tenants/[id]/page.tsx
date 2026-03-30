import { createCaller } from "@/server/trpc/caller";
import { notFound } from "next/navigation";
import Link from "next/link";
import TenantEditForm from "./tenant-edit-form";
import AddProductForm from "./add-product-form";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trpc = await createCaller();

  let tenant;
  try {
    tenant = await trpc.betreiber.getTenant({ id });
  } catch {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/tenants"
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          &larr; Zurueck
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
        <StatusBadge status={tenant.status} />
      </div>

      <section className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Stammdaten
        </h2>
        <TenantEditForm tenant={tenant} />
      </section>

      <section className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Produkte & Subdomains
        </h2>
        {tenant.tenantApps.length === 0 ? (
          <p className="text-gray-500">Keine Produkte zugeordnet.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 mb-4">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">
                  Produkt
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">
                  Subdomain
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">
                  Aktiv
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenant.tenantApps.map((ta) => (
                <tr key={ta.id}>
                  <td className="py-2 text-sm text-gray-900">
                    {ta.app.name}
                  </td>
                  <td className="py-2 text-sm">
                    <a
                      href={`https://${ta.slug}.fillqr.de`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {ta.slug}.fillqr.de
                    </a>
                  </td>
                  <td className="py-2 text-sm text-gray-500">
                    {ta.isEnabled ? "Ja" : "Nein"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <AddProductForm tenantId={tenant.id} />
      </section>

      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Admin-Users
        </h2>
        {tenant.appUsers.length === 0 ? (
          <p className="text-gray-500">Keine Users angelegt.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">
                  E-Mail
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">
                  Erstellt
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenant.appUsers.map((user) => (
                <tr key={user.id}>
                  <td className="py-2 text-sm text-gray-900">{user.email}</td>
                  <td className="py-2 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    trial: "bg-blue-100 text-blue-800",
    paused: "bg-yellow-100 text-yellow-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}
