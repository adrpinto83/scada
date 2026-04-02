import React, { useState } from "react";
import type { ProcessState } from "../types";

interface Props {
  state: ProcessState | null;
}

export default function OperatorPanel({ state }: Props) {
  const [y1Sp, setY1Sp] = useState(0.0);
  const [y2Sp, setY2Sp] = useState(0.0);
  const [epsilons, setEpsilons] = useState([0, 0, 0, 0, 0]);
  const [analyzerFaults, setAnalyzerFaults] = useState({ y1: false, y2: false });
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleSetSetpoint = async () => {
    try {
      const res = await fetch("/api/control/setpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ y1_sp: y1Sp, y2_sp: y2Sp }),
      });
      if (res.ok) showFeedback("Setpoints aplicados");
    } catch { showFeedback("Error al aplicar setpoints"); }
  };

  const handleSetUncertainty = async () => {
    try {
      const res = await fetch("/api/uncertainty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epsilons }),
      });
      if (res.ok) showFeedback("Incertidumbre aplicada");
    } catch { showFeedback("Error al aplicar incertidumbre"); }
  };

  const handleLoadScenario = async (caseNum: number) => {
    try {
      const res = await fetch("/api/scenario/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case: caseNum }),
      });
      if (res.ok) {
        const data = await res.json();
        setEpsilons(data.epsilons);
        showFeedback(`Caso ${caseNum} cargado`);
      }
    } catch { showFeedback("Error cargando escenario"); }
  };

  const handleAnalyzerFault = async (analyzer: "y1" | "y2", fault: boolean) => {
    try {
      const res = await fetch("/api/analyzer/fault", {
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

  const epsilonLabels = ["ε₁ (u1)", "ε₂ (u2)", "ε₃ (u3)", "ε₄ (d1)", "ε₅ (d2)"];

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
                style={{ color: Math.abs(state.y[0] - y1Sp) < 0.01 ? "#00ff88" : "#ffaa00" }}>
                {(state.y[0] - y1Sp).toFixed(4)}
              </span>
            </span>
            <span className="op-current-item">
              <span className="op-ci-label">Δy2:</span>
              <span className="op-ci-val"
                style={{ color: Math.abs(state.y[1] - y2Sp) < 0.01 ? "#00ff88" : "#ffaa00" }}>
                {(state.y[1] - y2Sp).toFixed(4)}
              </span>
            </span>
          </div>
        )}

        <button onClick={handleSetSetpoint} className="op-btn op-btn-primary">
          Aplicar Setpoints
        </button>
      </div>

      {/* ── Incertidumbre ── */}
      <div className="op-section">
        <h4 className="op-section-title">
          <span className="op-section-icon">⚙</span> Incertidumbre Paramétrica ε
        </h4>
        <p className="op-section-hint">Rango: [-1, +1] | K_real = K_nom + ΔK·ε</p>

        {epsilons.map((eps, i) => (
          <div key={i} className="op-eps-row">
            <span className="op-eps-label">{epsilonLabels[i]}</span>
            <input
              type="range" min="-1" max="1" step="0.05"
              value={eps}
              onChange={(e) => {
                const newEps = [...epsilons];
                newEps[i] = parseFloat(e.target.value);
                setEpsilons(newEps);
              }}
              className="op-range purple"
            />
            <span className="op-eps-val" style={{
              color: Math.abs(eps) < 0.1 ? "#00ff88" : Math.abs(eps) < 0.5 ? "#ffaa00" : "#ff4444"
            }}>
              {eps >= 0 ? "+" : ""}{eps.toFixed(2)}
            </span>
          </div>
        ))}

        <div className="op-eps-summary">
          <span className="op-eps-sum-label">ε = [</span>
          {epsilons.map((e, i) => (
            <span key={i} style={{ color: "#a78bfa", fontFamily: "monospace", fontSize: "11px" }}>
              {e >= 0 ? "+" : ""}{e.toFixed(2)}{i < 4 ? ", " : ""}
            </span>
          ))}
          <span className="op-eps-sum-label">]</span>
        </div>

        <button onClick={handleSetUncertainty} className="op-btn op-btn-secondary">
          Aplicar Incertidumbre
        </button>
      </div>

      {/* ── Casos de Prueba ── */}
      <div className="op-section">
        <h4 className="op-section-title">
          <span className="op-section-icon">▶</span> Escenarios de Prueba
        </h4>
        <div className="op-case-grid">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => handleLoadScenario(n)} className="op-case-btn">
              <span className="op-case-num">{n}</span>
              <span className="op-case-label">CASO</span>
            </button>
          ))}
        </div>
        <p className="op-section-hint">
          Cada caso define vector ε y perturbaciones d₁, d₂ iniciales
        </p>
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
            <span className="op-fault-status" style={{ color: analyzerFaults[an] ? "#ff4444" : "#00ff88" }}>
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
              { lbl: "u1", val: state.u[0], color: "#a78bfa" },
              { lbl: "u2", val: state.u[1], color: "#f472b6" },
              { lbl: "u3", val: state.u[2], color: "#34d399" },
              { lbl: "d1", val: state.d[0], color: "#fb923c" },
              { lbl: "d2", val: state.d[1], color: "#fbbf24" },
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
            t = <span style={{ color: "#00d4ff", fontWeight: "bold" }}>{state.t.toFixed(1)}</span> min
          </div>
        </div>
      )}
    </div>
  );
}
