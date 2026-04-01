type Props = {
  data: { label: string; zugaenge: number; abgaenge: number }[];
  height?: number;
};

export default function LineChart({ data, height = 200 }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Noch keine Daten</p>;
  }

  const allValues = data.flatMap((d) => [d.zugaenge, d.abgaenge]);
  const maxVal = Math.max(...allValues, 1);
  const w = 400;
  const pad = 20;

  function toPoints(values: number[]): string {
    return values
      .map((v, i) => {
        const x = pad + (i / (values.length - 1 || 1)) * (w - pad * 2);
        const y = height - (v / maxVal) * (height - pad);
        return `${x},${y}`;
      })
      .join(" ");
  }

  const zugPts = toPoints(data.map((d) => d.zugaenge));
  const abgPts = toPoints(data.map((d) => d.abgaenge));

  return (
    <svg viewBox={`0 0 ${w} ${height + 30}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad} x2={w - pad} y1={height - f * (height - pad)} y2={height - f * (height - pad)} stroke="#e5e7eb" strokeWidth="0.5" />
      ))}

      {/* Zugänge (grün) */}
      <polyline points={zugPts} fill="none" stroke="#22c55e" strokeWidth="2" />
      {data.map((d, i) => {
        const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
        const y = height - (d.zugaenge / maxVal) * (height - pad);
        return <circle key={`z${i}`} cx={x} cy={y} r="3" fill="#22c55e" />;
      })}

      {/* Abgänge (rot) */}
      <polyline points={abgPts} fill="none" stroke="#ef4444" strokeWidth="2" />
      {data.map((d, i) => {
        const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
        const y = height - (d.abgaenge / maxVal) * (height - pad);
        return <circle key={`a${i}`} cx={x} cy={y} r="3" fill="#ef4444" />;
      })}

      {/* Labels */}
      {data.map((d, i) => {
        const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
        // Nur jeden 2. Monat labeln wenn > 6
        if (data.length > 6 && i % 2 !== 0) return null;
        return (
          <text key={i} x={x} y={height + 14} textAnchor="middle" fontSize="9" fill="#6b7280">
            {d.label.slice(5)}
          </text>
        );
      })}

      {/* Legende */}
      <circle cx={w - 100} cy={10} r="4" fill="#22c55e" />
      <text x={w - 92} y={14} fontSize="10" fill="#6b7280">Zugaenge</text>
      <circle cx={w - 40} cy={10} r="4" fill="#ef4444" />
      <text x={w - 32} y={14} fontSize="10" fill="#6b7280">Abgaenge</text>
    </svg>
  );
}
