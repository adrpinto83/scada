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
  const [testEpsilons, setTestEpsilons] = useState([0, 0, 0, 0, 0]);
  const [testD1, setTestD1] = useState(0.5);
  const [testD2, setTestD2] = useState(0.5);

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

      {/* ── Condición de Prueba Editable ── */}
      <div className="op-section">
        <h4 className="op-section-title">
          <span className="op-section-icon">⚙</span> Condición de Prueba
        </h4>
        <p className="op-section-hint" style={{ marginBottom: "10px" }}>
          Ajusta incertidumbres (ε) y perturbaciones (d)
        </p>

        <div className="op-test-editor">
          {/* Epsilons */}
          <div className="op-test-section">
            <span className="op-test-section-label">Incertidumbres ε (rango [-1, +1])</span>
            <div className="op-eps-grid">
              {["ε₁ (u1)", "ε₂ (u2)", "ε₃ (u3)", "ε₄ (d1)", "ε₅ (d2)"].map((label, i) => (
                <div key={i} className="op-eps-input-group">
                  <label className="op-eps-input-label">{label}</label>
                  <div className="op-eps-input-row">
                    <input
                      type="range"
                      min="-1" max="1" step="0.05"
                      value={testEpsilons[i]}
                      onChange={(e) => {
                        const newEps = [...testEpsilons];
                        newEps[i] = parseFloat(e.target.value);
                        setTestEpsilons(newEps);
                      }}
                      className="op-eps-input-range"
                    />
                    <input
                      type="number"
                      min="-1" max="1" step="0.05"
                      value={testEpsilons[i].toFixed(2)}
                      onChange={(e) => {
                        const newEps = [...testEpsilons];
                        newEps[i] = Math.max(-1, Math.min(1, parseFloat(e.target.value) || 0));
                        setTestEpsilons(newEps);
                      }}
                      className="op-eps-input-number"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Perturbaciones */}
          <div className="op-test-section" style={{ marginTop: "10px" }}>
            <span className="op-test-section-label">Perturbaciones d (rango [-1, +1])</span>
            <div className="op-dist-input-row">
              <div className="op-dist-input-group">
                <label className="op-dist-input-label">d₁ (Reflujo Intermedio)</label>
                <div className="op-dist-input-controls">
                  <input
                    type="range"
                    min="-1" max="1" step="0.05"
                    value={testD1}
                    onChange={(e) => setTestD1(parseFloat(e.target.value))}
                    className="op-dist-input-range"
                  />
                  <input
                    type="number"
                    min="-1" max="1" step="0.05"
                    value={testD1.toFixed(2)}
                    onChange={(e) => setTestD1(Math.max(-1, Math.min(1, parseFloat(e.target.value) || 0)))}
                    className="op-dist-input-number"
                  />
                </div>
              </div>
              <div className="op-dist-input-group">
                <label className="op-dist-input-label">d₂ (Reflujo Superior)</label>
                <div className="op-dist-input-controls">
                  <input
                    type="range"
                    min="-1" max="1" step="0.05"
                    value={testD2}
                    onChange={(e) => setTestD2(parseFloat(e.target.value))}
                    className="op-dist-input-range"
                  />
                  <input
                    type="number"
                    min="-1" max="1" step="0.05"
                    value={testD2.toFixed(2)}
                    onChange={(e) => setTestD2(Math.max(-1, Math.min(1, parseFloat(e.target.value) || 0)))}
                    className="op-dist-input-number"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="op-test-summary">
            <div className="op-test-summary-row">
              <span className="op-test-summary-label">ε = [</span>
              {testEpsilons.map((e, i) => (
                <span key={i} className="op-test-summary-val">
                  {e >= 0 ? "+" : ""}{e.toFixed(2)}{i < 4 ? ", " : ""}
                </span>
              ))}
              <span className="op-test-summary-label">]</span>
            </div>
            <div className="op-test-summary-row">
              <span className="op-test-summary-label">d = [</span>
              <span className="op-test-summary-val">{testD1 >= 0 ? "+" : ""}{testD1.toFixed(2)}</span>
              <span className="op-test-summary-label">, </span>
              <span className="op-test-summary-val">{testD2 >= 0 ? "+" : ""}{testD2.toFixed(2)}</span>
              <span className="op-test-summary-label">]</span>
            </div>
          </div>

          <button onClick={handleLoadScenario} className="op-btn op-btn-primary" style={{ marginTop: "10px" }}>
            Cargar Condición
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
