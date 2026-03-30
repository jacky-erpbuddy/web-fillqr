export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Willkommen im Admin-Bereich.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <PlaceholderCard title="Tenant" description="Kontostatus und Einstellungen" />
      </div>
    </div>
  );
}

function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-1 text-lg font-semibold text-gray-900">&mdash;</p>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
    </div>
  );
}
