
interface GaugeDisplayProps {
  value: number;
  min?: number;
  max?: number;
  setpoint?: number;
  label: string;
  tag: string;
  unit?: string;
  size?: number;
}

/**
 * Medidor circular tipo velocímetro industrial.
 * Muestra valor actual con arco de color dinámico y aguja.
 */
export default function GaugeDisplay({
  value,
  min = -0.5,
  max = 0.5,
  setpoint,
  label,
  tag,
  unit = "[-]",
  size = 140,
}: GaugeDisplayProps) {
  const range = max - min;
  const normalized = Math.max(0, Math.min(1, (value - min) / range));

  // Arco: de -220° a 40° (260° de rango total)
  const startAngle = -220;
  const endAngle = 40;
  const totalAngle = endAngle - startAngle; // 260°
  const valueAngle = startAngle + normalized * totalAngle;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeWidth = size * 0.07;

  function polarToCartesian(angle: number, radius: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function describeArc(startDeg: number, endDeg: number, radius: number) {
    const s = polarToCartesian(startDeg, radius);
    const e = polarToCartesian(endDeg, radius);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  // Color dinámico según distancia al setpoint
  const error = setpoint !== undefined ? Math.abs(value - setpoint) : 0;
  const gaugeColor =
    setpoint === undefined
      ? "#3b82f6"
      : error <= 0.005
      ? "#10b981"
      : error <= 0.05
      ? "#f59e0b"
      : "#ef4444";

  // Aguja
  const needleAngle = valueAngle;
  const needleEnd = polarToCartesian(needleAngle, r * 0.82);
  const needleBase1 = polarToCartesian(needleAngle - 90, strokeWidth * 0.3);
  const needleBase2 = polarToCartesian(needleAngle + 90, strokeWidth * 0.3);

  // Setpoint marker
  const spNormalized = setpoint !== undefined
    ? Math.max(0, Math.min(1, (setpoint - min) / range))
    : null;
  const spAngle =
    spNormalized !== null ? startAngle + spNormalized * totalAngle : null;
  const spMarker = spAngle !== null ? polarToCartesian(spAngle, r * 1.08) : null;
  const spMarkerInner = spAngle !== null ? polarToCartesian(spAngle, r * 0.85) : null;

  // Ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="gauge-container">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id={`gaugeBg-${tag}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#111827" />
          </radialGradient>
        </defs>

        {/* Fondo circular */}
        <circle cx={cx} cy={cy} r={size * 0.46} fill={`url(#gaugeBg-${tag})`} stroke="#374151" strokeWidth="1" />

        {/* Arco de fondo */}
        <path
          d={describeArc(startAngle, endAngle, r)}
          fill="none"
          stroke="#1f2937"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Zona de alarma baja (rojo) */}
        <path
          d={describeArc(startAngle, startAngle + totalAngle * 0.15, r)}
          fill="none"
          stroke="#ef444422"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Zona normal (verde) */}
        <path
          d={describeArc(startAngle + totalAngle * 0.15, startAngle + totalAngle * 0.85, r)}
          fill="none"
          stroke="#10b98111"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Zona de alarma alta (rojo) */}
        <path
          d={describeArc(startAngle + totalAngle * 0.85, endAngle, r)}
          fill="none"
          stroke="#ef444422"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Arco de valor */}
        {normalized > 0.001 && (
          <path
            d={describeArc(startAngle, valueAngle, r)}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 ${size * 0.025}px ${gaugeColor})` }}
          />
        )}

        {/* Ticks */}
        {ticks.map((t, i) => {
          const tickAngle = startAngle + t * totalAngle;
          const outer = polarToCartesian(tickAngle, r + strokeWidth * 0.7);
          const inner = polarToCartesian(tickAngle, r + strokeWidth * 0.3);
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#4b5563"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Marker de setpoint */}
        {spMarker && spMarkerInner && (
          <line
            x1={spMarkerInner.x}
            y1={spMarkerInner.y}
            x2={spMarker.x}
            y2={spMarker.y}
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="3,2"
          />
        )}

        {/* Aguja */}
        <polygon
          points={`${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y} ${needleEnd.x},${needleEnd.y}`}
          fill={gaugeColor}
          style={{ filter: `drop-shadow(0 0 2px ${gaugeColor})` }}
        />
        <circle cx={cx} cy={cy} r={size * 0.04} fill="#e2e8f0" />

        {/* Tag */}
        <text x={cx} y={cy * 0.45} textAnchor="middle" fontSize={size * 0.08} fill="#6b7280" fontFamily="monospace">
          {tag}
        </text>

        {/* Valor */}
        <text x={cx} y={cy + size * 0.13} textAnchor="middle" fontSize={size * 0.12} fill={gaugeColor} fontFamily="monospace" fontWeight="bold">
          {value.toFixed(3)}
        </text>

        {/* Unidad */}
        <text x={cx} y={cy + size * 0.22} textAnchor="middle" fontSize={size * 0.07} fill="#6b7280">
          {unit}
        </text>

        {/* Límites */}
        <text
          x={polarToCartesian(startAngle + 5, r + strokeWidth * 1.4).x}
          y={polarToCartesian(startAngle + 5, r + strokeWidth * 1.4).y}
          fontSize={size * 0.065}
          fill="#6b7280"
          textAnchor="middle"
        >
          {min}
        </text>
        <text
          x={polarToCartesian(endAngle - 5, r + strokeWidth * 1.4).x}
          y={polarToCartesian(endAngle - 5, r + strokeWidth * 1.4).y}
          fontSize={size * 0.065}
          fill="#6b7280"
          textAnchor="middle"
        >
          {max}
        </text>
      </svg>

      <div className="gauge-label">{label}</div>
    </div>
  );
}
