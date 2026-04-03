import { useState } from "react";
import type { ProcessState } from "../types";
import { apiURL } from "../config";

interface Props {
  state: ProcessState | null;
}

// Definición de casos de prueba con información detallada
const TEST_CASES = [
  {
    num: 1,
    name: "Caso Nominal",
    description: "Condiciones nominales sin incertidumbre paramétrica",
    epsilons: [0, 0, 0, 0, 0],
    d1: 0.5,
    d2: 0.5,
    objective: "Validar desempeño con modelo nominal y perturbaciones positivas máximas",
    difficulty: "Baja",
    color: "#10b981",
  },
  {
    num: 2,
    name: "Incertidumbre Negativa",
    description: "Ganancias MV reducidas, perturbaciones aumentadas",
    epsilons: [-1, -1, -1, 1, 1],
    d1: -0.5,
    d2: -0.5,
    objective: "Probar robustez con subestimación de ganancias y perturbaciones negativas",
    difficulty: "Media-Alta",
    color: "#d97706",
  },
  {
    num: 3,
    name: "Asimétrico Lateral",
    description: "u2 reducida, resto aumentadas - prueba desacoplamiento",
    epsilons: [1, -1, 1, 1, 1],
    d1: -0.5,
    d2: -0.5,
    objective: "Evaluar control descentralizado con asimetría en lazos SISO",
    difficulty: "Alta",
    color: "#f59e0b",
  },
  {
    num: 4,
    name: "Sobreestimación Total",
    description: "Todas las ganancias maximizadas con perturbaciones mixtas",
    epsilons: [1, 1, 1, 1, 1],
    d1: -0.5,
    d2: 0.5,
    objective: "Verificar estabilidad con máxima ganancia y perturbaciones opuestas",
    difficulty: "Muy Alta",
    color: "#ef4444",
  },
  {
    num: 5,
    name: "Interacción Cruzada",
    description: "u1 reducida, u2 aumentada - máxima interacción entre lazos",
    epsilons: [-1, 1, 0, 0, 0],
    d1: -0.5,
    d2: -0.5,
    objective: "Probar rechazo de interacción cruzada entre AT-101 y AT-201",
    difficulty: "Media",
    color: "#6d28d9",
  },
];

export default function OperatorPanel({ state }: Props) {
  const [y1Sp, setY1Sp] = useState(0.0);
  const [y2Sp, setY2Sp] = useState(0.0);
  const [epsilons, setEpsilons] = useState([0, 0, 0, 0, 0]);
  const [analyzerFaults, setAnalyzerFaults] = useState({ y1: false, y2: false });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedCase, setExpandedCase] = useState<number | null>(null);

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

  const handleSetUncertainty = async () => {
    try {
      const res = await fetch(apiURL("/api/uncertainty"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epsilons }),
      });
      if (res.ok) showFeedback("Incertidumbre aplicada");
    } catch { showFeedback("Error al aplicar incertidumbre"); }
  };

  const handleLoadScenario = async (caseNum: number) => {
    try {
      const res = await fetch(apiURL("/api/scenario/load"), {
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
              color: Math.abs(eps) < 0.1 ? "#10b981" : Math.abs(eps) < 0.5 ? "#f59e0b" : "#ef4444"
            }}>
              {eps >= 0 ? "+" : ""}{eps.toFixed(2)}
            </span>
          </div>
        ))}

        <div className="op-eps-summary">
          <span className="op-eps-sum-label">ε = [</span>
          {epsilons.map((e, i) => (
            <span key={i} style={{ color: "#6d28d9", fontFamily: "monospace", fontSize: "11px" }}>
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
        <p className="op-section-hint" style={{ marginBottom: "12px" }}>
          5 casos de validación con diferentes condiciones de incertidumbre y perturbaciones
        </p>

        <div className="op-test-cases">
          {TEST_CASES.map((testCase) => (
            <div key={testCase.num} className="op-test-case">
              {/* Header del caso */}
              <div
                className="op-test-case-header"
                onClick={() => setExpandedCase(expandedCase === testCase.num ? null : testCase.num)}
                style={{ borderLeftColor: testCase.color }}
              >
                <div className="op-test-case-main">
                  <div className="op-test-case-num" style={{ backgroundColor: testCase.color }}>
                    {testCase.num}
                  </div>
                  <div className="op-test-case-info">
                    <div className="op-test-case-name">{testCase.name}</div>
                    <div className="op-test-case-desc">{testCase.description}</div>
                  </div>
                </div>
                <div className="op-test-case-actions">
                  <button
                    className="op-test-case-load"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadScenario(testCase.num);
                    }}
                  >
                    Cargar
                  </button>
                  <span className="op-test-case-expand">
                    {expandedCase === testCase.num ? "▼" : "▶"}
                  </span>
                </div>
              </div>

              {/* Detalles expandidos */}
              {expandedCase === testCase.num && (
                <div className="op-test-case-details">
                  <div className="op-test-detail-row">
                    <span className="op-test-detail-label">Objetivo:</span>
                    <span className="op-test-detail-value">{testCase.objective}</span>
                  </div>

                  <div className="op-test-detail-row">
                    <span className="op-test-detail-label">Dificultad:</span>
                    <span
                      className="op-test-detail-badge"
                      style={{
                        backgroundColor: testCase.difficulty === "Baja" ? "#10b98122" :
                                        testCase.difficulty.includes("Media") ? "#f59e0b22" : "#ef444422",
                        color: testCase.difficulty === "Baja" ? "#10b981" :
                              testCase.difficulty.includes("Media") ? "#f59e0b" : "#ef4444"
                      }}
                    >
                      {testCase.difficulty}
                    </span>
                  </div>

                  <div className="op-test-detail-group">
                    <span className="op-test-detail-label">Vector ε:</span>
                    <div className="op-test-epsilon-grid">
                      {testCase.epsilons.map((eps, idx) => (
                        <div key={idx} className="op-test-epsilon-item">
                          <span className="op-test-eps-label">ε{idx + 1}</span>
                          <span
                            className="op-test-eps-value"
                            style={{
                              color: eps === 0 ? "#888" : eps > 0 ? "#10b981" : "#ef4444"
                            }}
                          >
                            {eps >= 0 ? "+" : ""}{eps.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="op-test-detail-group">
                    <span className="op-test-detail-label">Perturbaciones:</span>
                    <div className="op-test-disturbance-row">
                      <div className="op-test-dist-item">
                        <span className="op-test-dist-label">d₁</span>
                        <span
                          className="op-test-dist-value"
                          style={{ color: testCase.d1 >= 0 ? "#10b981" : "#ef4444" }}
                        >
                          {testCase.d1 >= 0 ? "+" : ""}{testCase.d1.toFixed(1)}
                        </span>
                      </div>
                      <div className="op-test-dist-item">
                        <span className="op-test-dist-label">d₂</span>
                        <span
                          className="op-test-dist-value"
                          style={{ color: testCase.d2 >= 0 ? "#10b981" : "#ef4444" }}
                        >
                          {testCase.d2 >= 0 ? "+" : ""}{testCase.d2.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
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
