
interface KPICardProps {
  label: string;
  tag: string;
  value: number;
  unit?: string;
  setpoint?: number;
  min?: number;
  max?: number;
  decimals?: number;
  variant?: "cv" | "mv" | "dv";
}

/**
 * Tarjeta KPI industrial para mostrar variables de proceso.
 * Muestra valor actual, setpoint, barra de progreso y estado.
 */
export default function KPICard({
  label,
  tag,
  value,
  unit = "[-]",
  setpoint,
  min = -0.5,
  max = 0.5,
  decimals = 4,
  variant = "cv",
}: KPICardProps) {
  const range = max - min;
  const pct = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  const spPct = setpoint !== undefined
    ? Math.max(0, Math.min(100, ((setpoint - min) / range) * 100))
    : null;

  const error = setpoint !== undefined ? Math.abs(value - setpoint) : null;
  const status =
    error === null
      ? "normal"
      : error <= 0.005
      ? "good"
      : error <= 0.05
      ? "warning"
      : "alarm";

  const statusColor = {
    good: "#00ff88",
    warning: "#ffaa00",
    alarm: "#ff4444",
    normal: "#00d4ff",
  }[status];

  const variantColor = {
    cv: "#00d4ff",
    mv: "#a78bfa",
    dv: "#fb923c",
  }[variant];

  return (
    <div className={`kpi-card-modern variant-${variant}`} data-status={status}>
      <div className="kpi-tag">{tag}</div>
      <div className="kpi-label-modern">{label}</div>
      <div className="kpi-value-modern" style={{ color: statusColor }}>
        {value.toFixed(decimals)}
        <span className="kpi-unit-modern">{unit}</span>
      </div>

      {/* Barra de progreso */}
      <div className="kpi-bar-track">
        <div
          className="kpi-bar-fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${variantColor}88, ${variantColor})`,
          }}
        />
        {spPct !== null && (
          <div
            className="kpi-bar-sp"
            style={{ left: `${spPct}%` }}
            title={`SP: ${setpoint?.toFixed(decimals)}`}
          />
        )}
      </div>

      {setpoint !== undefined && (
        <div className="kpi-sp-row">
          <span className="kpi-sp-label">SP:</span>
          <span className="kpi-sp-value">{setpoint.toFixed(decimals)}</span>
          <span
            className="kpi-error"
            style={{ color: statusColor }}
          >
            Δ {(value - setpoint).toFixed(4)}
          </span>
        </div>
      )}

      <div className="kpi-status-dot" style={{ background: statusColor }} />
    </div>
  );
}
