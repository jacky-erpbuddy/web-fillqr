export default function DemoBanner({ message }: { message: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-4 text-sm">
      <span className="font-medium">Demo:</span> {message}
    </div>
  );
}
