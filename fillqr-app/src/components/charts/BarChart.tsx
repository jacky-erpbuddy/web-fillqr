type Props = {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
};

export default function BarChart({ data, color = "#3b82f6", height = 200 }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Noch keine Daten</p>;
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;
  const gap = barWidth * 0.2;

  return (
    <svg viewBox={`0 0 400 ${height + 30}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * height;
        const x = i * (400 / data.length) + gap;
        const w = 400 / data.length - gap * 2;
        return (
          <g key={i}>
            <rect x={x} y={height - barH} width={w} height={barH} fill={color} rx={2} />
            <text x={x + w / 2} y={height + 14} textAnchor="middle" fontSize="10" fill="#6b7280">
              {d.label.length > 8 ? d.label.slice(0, 8) + ".." : d.label}
            </text>
            {d.value > 0 && (
              <text x={x + w / 2} y={height - barH - 4} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="bold">
                {d.value}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
