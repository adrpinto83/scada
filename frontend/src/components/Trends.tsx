import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ProcessState } from "../types";
import ConditioningPanel from "./ConditioningPanel";

interface Props {
  state: ProcessState;
}

const CV_COLORS = ["#3b82f6", "#10b981", "#6d28d9", "#f59e0b", "#ec4899", "#059669", "#d97706"];
const MV_COLORS = ["#6d28d9", "#ec4899", "#059669"];
const DV_COLORS = ["#f59e0b", "#d97706"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="recharts-custom-tooltip">
      <p className="tooltip-label">t = {Number(label).toFixed(1)} min</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color, margin: "2px 0", fontSize: "11px" }}>
          {entry.name}: <strong>{Number(entry.value).toFixed(4)}</strong>
        </p>
      ))}
    </div>
  );
};

type TabType = "cv" | "mv" | "dv" | "bw" | "svd";

export default function Trends({ state }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("cv");

  const { history, u_setpoint, bandwidth } = state;

  // Construir datos para Recharts
  const chartData = history
    ? history.t.map((t, idx) => ({
        t,
        y1: history.y[idx]?.[0] ?? 0,
        y2: history.y[idx]?.[1] ?? 0,
        y3: history.y[idx]?.[2] ?? 0,
        y4: history.y[idx]?.[3] ?? 0,
        y5: history.y[idx]?.[4] ?? 0,
        y6: history.y[idx]?.[5] ?? 0,
        y7: history.y[idx]?.[6] ?? 0,
        u1: history.u[idx]?.[0] ?? 0,
        u2: history.u[idx]?.[1] ?? 0,
        u3: history.u[idx]?.[2] ?? 0,
        d1: history.d[idx]?.[0] ?? 0,
        d2: history.d[idx]?.[1] ?? 0,
      }))
    : [];

  const axisStyle = { fill: "#6b7280", fontSize: 10, fontFamily: "monospace" };
  const gridStyle = { stroke: "#1f2937", strokeDasharray: "3 3" };

  const commonProps = {
    data: chartData,
    margin: { top: 5, right: 20, left: -10, bottom: 5 },
  };

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "cv", label: "CVs — Salidas Controladas" },
    { key: "mv", label: "MVs — Entradas Manipuladas" },
    { key: "dv", label: "DVs — Perturbaciones" },
    { key: "bw", label: "Ancho de Banda" },
    { key: "svd", label: "SVD / Condicionamiento" },
  ];

  return (
    <div className="trends-modern">
      {/* Tabs */}
      <div className="trends-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`trends-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="trends-content">
        {/* ── CVs ── */}
        {activeTab === "cv" && (
          <div className="trend-chart-group">
            <div className="trend-chart-block">
              <p className="trend-chart-title">Puntos Finales — AT-101 (y1) y AT-201 (y2)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart {...commonProps}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="t" tick={axisStyle} label={{ value: "t [min]", position: "insideBottomRight", fill: "#6b7280", fontSize: 10 }} />
                  <YAxis domain={[-0.5, 0.5]} tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }} />
                  <ReferenceLine y={u_setpoint[0]} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: "SP y1", fill: "#f59e0b", fontSize: 9 }} />
                  <ReferenceLine y={u_setpoint[1]} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: "SP y2", fill: "#f59e0b", fontSize: 9 }} />
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="2 4" />
                  <Line type="monotone" dataKey="y1" name="y1: PF Sup" stroke={CV_COLORS[0]} dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="y2" name="y2: PF Lat" stroke={CV_COLORS[1]} dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="trend-chart-block">
              <p className="trend-chart-title">Temperaturas — TT-301 (y3), TT-401 (y4), TT-501 (y5)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart {...commonProps}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="t" tick={axisStyle} />
                  <YAxis domain={[-0.5, 0.5]} tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }} />
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="2 4" />
                  <Line type="monotone" dataKey="y3" name="y3: T.Sup" stroke={CV_COLORS[2]} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  <Line type="monotone" dataKey="y4" name="y4: T.Refl.Sup" stroke={CV_COLORS[3]} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  <Line type="monotone" dataKey="y5" name="y5: T.Ext.Lat" stroke={CV_COLORS[4]} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="trend-chart-block">
              <p className="trend-chart-title">Temperaturas — TT-601 (y6), TT-701 (y7)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart {...commonProps}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="t" tick={axisStyle} />
                  <YAxis domain={[-0.5, 0.5]} tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }} />
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="2 4" />
                  <Line type="monotone" dataKey="y6" name="y6: T.Refl.Int" stroke={CV_COLORS[5]} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  <Line type="monotone" dataKey="y7" name="y7: T.Refl.Fondo" stroke={CV_COLORS[6]} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── MVs ── */}
        {activeTab === "mv" && (
          <div className="trend-chart-group">
            <div className="trend-chart-block">
              <p className="trend-chart-title">Entradas Manipuladas — FCV-101 (u1), FCV-201 (u2), FCV-301 (u3)</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart {...commonProps}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="t" tick={axisStyle} label={{ value: "t [min]", position: "insideBottomRight", fill: "#6b7280", fontSize: 10 }} />
                  <YAxis domain={[-0.5, 0.5]} tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }} />
                  <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="2 3" label={{ value: "MAX", fill: "#ef4444", fontSize: 8 }} />
                  <ReferenceLine y={-0.5} stroke="#ef4444" strokeDasharray="2 3" label={{ value: "MIN", fill: "#ef4444", fontSize: 8 }} />
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="2 4" />
                  <Line type="stepAfter" dataKey="u1" name="u1: Ext.Sup" stroke={MV_COLORS[0]} dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="u2" name="u2: Ext.Lat" stroke={MV_COLORS[1]} dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="u3" name="u3: Dem.Refl.Fondo" stroke={MV_COLORS[2]} dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mv-current-values">
              <h4 className="mv-title">Valores Actuales MVs</h4>
              <div className="mv-grid">
                {[
                  { tag: "FCV-101", name: "u1: Extracción Superior", val: state.u[0], color: MV_COLORS[0] },
                  { tag: "FCV-201", name: "u2: Extracción Lateral", val: state.u[1], color: MV_COLORS[1] },
                  { tag: "FCV-301", name: "u3: Dem. Reflujo Fondo", val: state.u[2], color: MV_COLORS[2] },
                ].map((mv) => (
                  <div key={mv.tag} className="mv-item" style={{ borderLeftColor: mv.color }}>
                    <span className="mv-tag" style={{ color: mv.color }}>{mv.tag}</span>
                    <span className="mv-name">{mv.name}</span>
                    <span className="mv-val" style={{ color: mv.color }}>{mv.val.toFixed(4)}</span>
                    <div className="mv-bar-track">
                      <div className="mv-bar-fill" style={{
                        width: `${Math.max(0, Math.min(100, ((mv.val + 0.5) / 1.0) * 100))}%`,
                        background: mv.color,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DVs ── */}
        {activeTab === "dv" && (
          <div className="trend-chart-group">
            <div className="trend-chart-block">
              <p className="trend-chart-title">Perturbaciones Medidas — FCV-D1 (d1), FCV-D2 (d2)</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart {...commonProps}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="t" tick={axisStyle} label={{ value: "t [min]", position: "insideBottomRight", fill: "#6b7280", fontSize: 10 }} />
                  <YAxis domain={[-0.5, 0.5]} tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af" }} />
                  <ReferenceLine y={0} stroke="#374151" strokeDasharray="2 4" />
                  <Line type="stepAfter" dataKey="d1" name="d1: Dem. Refl. Int" stroke={DV_COLORS[0]} dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="d2" name="d2: Dem. Refl. Sup" stroke={DV_COLORS[1]} dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="dv-info-grid">
              {[
                { tag: "FCV-D1", name: "d1: Demanda Reflujo Intermedio", val: state.d[0], color: DV_COLORS[0] },
                { tag: "FCV-D2", name: "d2: Demanda Reflujo Superior", val: state.d[1], color: DV_COLORS[1] },
              ].map((dv) => (
                <div key={dv.tag} className="dv-card" style={{ borderColor: dv.color }}>
                  <span className="dv-tag" style={{ color: dv.color }}>{dv.tag}</span>
                  <div className="dv-name">{dv.name}</div>
                  <div className="dv-val" style={{ color: dv.color }}>{dv.val.toFixed(4)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Ancho de Banda ── */}
        {activeTab === "bw" && (
          <div className="bw-panel">
            <h3 className="bw-title">Análisis de Ancho de Banda — OBJ-4</h3>
            <p className="bw-subtitle">
              Criterio: BW_CL / BW_OL ∈ [ratio_min, ratio_max]
            </p>

            {bandwidth ? (
              <>
                <div className="bw-cards">
                  <div className="bw-card">
                    <div className="bw-card-label">BW Lazo Abierto</div>
                    <div className="bw-card-value" style={{ color: "#3b82f6" }}>
                      {bandwidth.bw_ol.toFixed(4)}
                    </div>
                    <div className="bw-card-unit">rad/min</div>
                  </div>
                  <div className="bw-card">
                    <div className="bw-card-label">BW Lazo Cerrado</div>
                    <div className="bw-card-value" style={{ color: "#6d28d9" }}>
                      {bandwidth.bw_cl.toFixed(4)}
                    </div>
                    <div className="bw-card-unit">rad/min</div>
                  </div>
                  <div className={`bw-card ${bandwidth.compliant ? "bw-ok" : "bw-fail"}`}>
                    <div className="bw-card-label">Ratio CL/OL</div>
                    <div className="bw-card-value">
                      {bandwidth.ratio.toFixed(3)}
                    </div>
                    <div className="bw-card-unit">
                      [{bandwidth.ratio_min.toFixed(2)}, {bandwidth.ratio_max.toFixed(2)}]
                    </div>
                  </div>
                  <div className={`bw-card ${bandwidth.compliant ? "bw-ok" : "bw-fail"}`}>
                    <div className="bw-card-label">Estado</div>
                    <div className="bw-card-value bw-status-icon">
                      {bandwidth.compliant ? "✓" : "✗"}
                    </div>
                    <div className="bw-card-unit">
                      {bandwidth.compliant ? "CUMPLE" : "NO CUMPLE"}
                    </div>
                  </div>
                </div>

                {/* Barra de ratio */}
                <div className="bw-ratio-bar-container">
                  <div className="bw-ratio-label">Ratio: {bandwidth.ratio.toFixed(3)}</div>
                  <div className="bw-ratio-track">
                    {/* Zona válida */}
                    <div className="bw-ratio-valid-zone" style={{
                      left: `${bandwidth.ratio_min * 20}%`,
                      width: `${(bandwidth.ratio_max - bandwidth.ratio_min) * 20}%`,
                    }} />
                    {/* Indicador actual */}
                    <div className="bw-ratio-indicator" style={{
                      left: `${Math.min(95, bandwidth.ratio * 20)}%`,
                      background: bandwidth.compliant ? "#10b981" : "#ef4444",
                    }} />
                  </div>
                  <div className="bw-ratio-scale">
                    {[0, 1, 2, 3, 4, 5].map(v => (
                      <span key={v} style={{ left: `${v * 20}%` }}>{v}</span>
                    ))}
                  </div>
                </div>

                <div className="bw-desc">
                  <p>
                    <strong>Horizonte MPC:</strong> Np = 15 pasos, Nc = 5 pasos, Δt = 1 min
                  </p>
                  <p>
                    <strong>Criterio (OBJ-4):</strong> El ancho de banda en lazo cerrado debe estar
                    entre {bandwidth.ratio_min} y {bandwidth.ratio_max} veces el ancho de banda en lazo abierto.
                  </p>
                </div>
              </>
            ) : (
              <div className="bw-no-data">
                Inicia la simulación para calcular el ancho de banda.
              </div>
            )}
          </div>
        )}

        {/* ── SVD / Condicionamiento ── */}
        {activeTab === "svd" && (
          <ConditioningPanel
            conditioning={state.conditioning}
            octaveData={state.conditioning?.octave}
          />
        )}
      </div>
    </div>
  );
}
