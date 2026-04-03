import { useState } from "react";
import type { ProcessState } from "../types";
import { apiURL } from "../config";

interface Props {
  state: ProcessState | null;
}

export default function OperatorPanel({ state }: Props) {
  const [y1Sp, setY1Sp] = useState(0.0);
  const [y2Sp, setY2Sp] = useState(0.0);
  const [analyzerFaults, setAnalyzerFaults] = useState({ y1: false, y2: false });
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleSetSetpoint = async () => {
    try {
      const res = await fetch(apiURL("/api/control/setpoints"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ y1_sp: y1Sp, y2_sp: y2Sp }),
      });
      if (res.ok) showFeedback("Setpoints aplicados");
    } catch { showFeedback("Error al aplicar setpoints"); }
  };

  const handleLoadScenario = async () => {
    try {
      const res = await fetch(apiURL("/api/scenario/load"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case: 1 }),
      });
      if (res.ok) {
        showFeedback("Caso nominal cargado (ε = 0)");
      }
    } catch { showFeedback("Error cargando escenario"); }
  };

  const handleAnalyzerFault = async (analyzer: "y1" | "y2", fault: boolean) => {
    try {
      const res = await fetch(apiURL("/api/analyzer/fault"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyzer, fault }),
      });
      if (res.ok) {
        setAnalyzerFaults((prev) => ({ ...prev, [analyzer]: fault }));
        showFeedback(`Analizador ${analyzer}: ${fault ? "FALLO simulado" : "restaurado"}`);
      }
    } catch { showFeedback("Error en analizador"); }
  };

  return (
    <div className="op-panel">
      {/* Feedback toast */}
      {feedback && (
        <div className="op-feedback">
          <span>{feedback}</span>
        </div>
      )}

      {/* ── Setpoints ── */}
      <div className="op-section">
        <h4 className="op-section-title">
          <span className="op-section-icon">◎</span> Setpoints MPC
        </h4>

        <div className="op-sp-row">
          <div className="op-sp-group">
            <label className="op-label">AT-101 (y1_sp)</label>
            <div className="op-sp-input-row">
              <input
                type="range"
                min="-0.5" max="0.5" step="0.01"
                value={y1Sp}
                onChange={(e) => setY1Sp(parseFloat(e.target.value))}
                className="op-range cyan"
              />
              <input
                type="number"
                min="-0.5" max="0.5" step="0.01"
                value={y1Sp}
                onChange={(e) => setY1Sp(parseFloat(e.target.value))}
                className="op-number-input"
              />
            </div>
            <div className="op-sp-bar">
              <div className="op-sp-bar-fill cyan" style={{ width: `${((y1Sp + 0.5) / 1.0) * 100}%` }} />
            </div>
          </div>

          <div className="op-sp-group">
            <label className="op-label">AT-201 (y2_sp)</label>
            <div className="op-sp-input-row">
              <input
                type="range"
                min="-0.5" max="0.5" step="0.01"
                value={y2Sp}
                onChange={(e) => setY2Sp(parseFloat(e.target.value))}
                className="op-range green"
              />
              <input
                type="number"
                min="-0.5" max="0.5" step="0.01"
                value={y2Sp}
                onChange={(e) => setY2Sp(parseFloat(e.target.value))}
                className="op-number-input"
              />
            </div>
            <div className="op-sp-bar">
              <div className="op-sp-bar-fill green" style={{ width: `${((y2Sp + 0.5) / 1.0) * 100}%` }} />
            </div>
          </div>
        </div>

        {state && (
          <div className="op-current-row">
            <span className="op-current-item">
              <span className="op-ci-label">y1:</span>
              <span className="op-ci-val cyan">{state.y[0].toFixed(4)}</span>
            </span>
            <span className="op-current-item">
              <span className="op-ci-label">y2:</span>
              <span className="op-ci-val green">{state.y[1].toFixed(4)}</span>
            </span>
            <span className="op-current-item">
              <span className="op-ci-label">Δy1:</span>
              <span className="op-ci-val"
                style={{ color: Math.abs(state.y[0] - y1Sp) < 0.01 ? "#10b981" : "#f59e0b" }}>
                {(state.y[0] - y1Sp).toFixed(4)}
              </span>
            </span>
            <span className="op-current-item">
              <span className="op-ci-label">Δy2:</span>
              <span className="op-ci-val"
                style={{ color: Math.abs(state.y[1] - y2Sp) < 0.01 ? "#10b981" : "#f59e0b" }}>
                {(state.y[1] - y2Sp).toFixed(4)}
              </span>
            </span>
          </div>
        )}

        <button onClick={handleSetSetpoint} className="op-btn op-btn-primary">
          Aplicar Setpoints
        </button>
      </div>

      {/* ── Caso Nominal ── */}
      <div className="op-section">
        <h4 className="op-section-title">
          <span className="op-section-icon">▶</span> Condición de Prueba
        </h4>
        <p className="op-section-hint" style={{ marginBottom: "12px" }}>
          Prototipo único sin incertidumbre paramétrica
        </p>

        <div className="op-nominal-card">
          <div className="op-nominal-header">
            <div className="op-nominal-badge">1</div>
            <div className="op-nominal-info">
              <div className="op-nominal-name">Caso Nominal</div>
              <div className="op-nominal-desc">Condiciones nominales (ε₁...ε₅ = 0)</div>
            </div>
          </div>
          <div className="op-nominal-params">
            <div className="op-param-row">
              <span className="op-param-label">Vector ε:</span>
              <span className="op-param-value mono">[+0.00, +0.00, +0.00, +0.00, +0.00]</span>
            </div>
            <div className="op-param-row">
              <span className="op-param-label">Perturbaciones:</span>
              <span className="op-param-value">d₁ = +0.5,  d₂ = +0.5</span>
            </div>
          </div>
          <button onClick={handleLoadScenario} className="op-btn op-btn-primary">
            Cargar Condición Nominal
          </button>
        </div>
      </div>

      {/* ── Fallos de Analizador ── */}
      <div className="op-section">
        <h4 className="op-section-title">
          <span className="op-section-icon">⚠</span> Fallos de Analizador
        </h4>
        {(["y1", "y2"] as const).map((an) => (
          <div key={an} className="op-fault-row">
            <div className={`op-fault-indicator ${analyzerFaults[an] ? "fault" : "ok"}`} />
            <span className="op-fault-name">{an === "y1" ? "AT-101 (y1)" : "AT-201 (y2)"}</span>
            <span className="op-fault-status" style={{ color: analyzerFaults[an] ? "#ef4444" : "#10b981" }}>
              {analyzerFaults[an] ? "FALLO" : "OK"}
            </span>
            <button
              className={`op-fault-btn ${analyzerFaults[an] ? "restore" : "fault"}`}
              onClick={() => handleAnalyzerFault(an, !analyzerFaults[an])}
            >
              {analyzerFaults[an] ? "Restaurar" : "Simular Fallo"}
            </button>
          </div>
        ))}
      </div>

      {/* ── Estado MV actual ── */}
      {state && (
        <div className="op-section op-state-section">
          <h4 className="op-section-title">
            <span className="op-section-icon">◈</span> Estado Actual
          </h4>
          <div className="op-state-grid">
            {[
              { lbl: "u1", val: state.u[0], color: "#6d28d9" },
              { lbl: "u2", val: state.u[1], color: "#ec4899" },
              { lbl: "u3", val: state.u[2], color: "#059669" },
              { lbl: "d1", val: state.d[0], color: "#f59e0b" },
              { lbl: "d2", val: state.d[1], color: "#d97706" },
            ].map((item) => (
              <div key={item.lbl} className="op-state-chip">
                <span className="op-state-lbl">{item.lbl}</span>
                <span className="op-state-val" style={{ color: item.color }}>
                  {item.val.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
          <div className="op-time-display">
            t = <span style={{ color: "#3b82f6", fontWeight: "bold" }}>{state.t.toFixed(1)}</span> min
          </div>
        </div>
      )}
    </div>
  );
}
