import React, { useState } from "react";
import type { ProcessState } from "../types";

interface Props {
  state: ProcessState | null;
}

/**
 * Panel de Operador.
 *
 * Funcionalidades:
 *   - Setpoints para y1, y2
 *   - Sliders de incertidumbre ε₁ a ε₅ (-1 a +1)
 *   - Botones para cargar casos de prueba (1-5)
 *   - Checkboxes para simular fallos de analizador
 */
export default function OperatorPanel({ state }: Props) {
  const [y1Sp, setY1Sp] = useState(0.0);
  const [y2Sp, setY2Sp] = useState(0.0);
  const [epsilons, setEpsilons] = useState([0, 0, 0, 0, 0]);
  const [analyzerFaults, setAnalyzerFaults] = useState({ y1: false, y2: false });

  const handleSetSetpoint = async () => {
    try {
      const response = await fetch("/api/control/setpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ y1_sp: y1Sp, y2_sp: y2Sp }),
      });
      if (response.ok) {
        console.log("Setpoints actualizados");
      }
    } catch (e) {
      console.error("Error setting setpoints:", e);
    }
  };

  const handleSetUncertainty = async () => {
    try {
      const response = await fetch("/api/uncertainty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epsilons }),
      });
      if (response.ok) {
        console.log("Incertidumbre actualizada");
      }
    } catch (e) {
      console.error("Error setting uncertainty:", e);
    }
  };

  const handleLoadScenario = async (caseNum: number) => {
    try {
      const response = await fetch("/api/scenario/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case: caseNum }),
      });
      if (response.ok) {
        const data = await response.json();
        setEpsilons(data.epsilons);
        console.log(`Caso ${caseNum} cargado`);
      }
    } catch (e) {
      console.error("Error loading scenario:", e);
    }
  };

  const handleAnalyzerFault = async (analyzer: "y1" | "y2", fault: boolean) => {
    try {
      const response = await fetch("/api/analyzer/fault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyzer, fault }),
      });
      if (response.ok) {
        setAnalyzerFaults((prev) => ({ ...prev, [analyzer]: fault }));
        console.log(`Analizador ${analyzer} ahora ${fault ? "fallido" : "operativo"}`);
      }
    } catch (e) {
      console.error("Error setting analyzer fault:", e);
    }
  };

  return (
    <div className="operator-panel">
      {/* Setpoints */}
      <div className="panel-block">
        <h4>Setpoints</h4>
        <div className="control-group">
          <label>y1_sp (Punto Final Superior):</label>
          <input
            type="number"
            min="-0.5"
            max="0.5"
            step="0.01"
            value={y1Sp}
            onChange={(e) => setY1Sp(parseFloat(e.target.value))}
          />
          <span className="value">{y1Sp.toFixed(3)}</span>
        </div>

        <div className="control-group">
          <label>y2_sp (Punto Final Lateral):</label>
          <input
            type="number"
            min="-0.5"
            max="0.5"
            step="0.01"
            value={y2Sp}
            onChange={(e) => setY2Sp(parseFloat(e.target.value))}
          />
          <span className="value">{y2Sp.toFixed(3)}</span>
        </div>

        <button onClick={handleSetSetpoint} className="btn-apply">
          Aplicar Setpoints
        </button>
      </div>

      {/* Incertidumbres */}
      <div className="panel-block">
        <h4>Incertidumbre (ε₁ a ε₅)</h4>
        {epsilons.map((eps, i) => (
          <div key={i} className="epsilon-slider">
            <label>ε{i + 1}:</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.1"
              value={eps}
              onChange={(e) => {
                const newEps = [...epsilons];
                newEps[i] = parseFloat(e.target.value);
                setEpsilons(newEps);
              }}
            />
            <span className="value">{eps.toFixed(2)}</span>
          </div>
        ))}
        <button onClick={handleSetUncertainty} className="btn-apply">
          Aplicar Incertidumbre
        </button>
      </div>

      {/* Casos de Prueba */}
      <div className="panel-block">
        <h4>Casos de Prueba</h4>
        <div className="case-buttons">
          {[1, 2, 3, 4, 5].map((caseNum) => (
            <button
              key={caseNum}
              onClick={() => handleLoadScenario(caseNum)}
              className="btn-case"
            >
              CASO {caseNum}
            </button>
          ))}
        </div>
      </div>

      {/* Fallos de Analizador */}
      <div className="panel-block">
        <h4>Fallos de Analizador</h4>
        <div className="analyzer-fault">
          <label>
            <input
              type="checkbox"
              checked={analyzerFaults.y1}
              onChange={(e) => handleAnalyzerFault("y1", e.target.checked)}
            />
            y1 fallido
          </label>
        </div>
        <div className="analyzer-fault">
          <label>
            <input
              type="checkbox"
              checked={analyzerFaults.y2}
              onChange={(e) => handleAnalyzerFault("y2", e.target.checked)}
            />
            y2 fallido
          </label>
        </div>
      </div>

      {/* Estado actual */}
      {state && (
        <div className="panel-block state-display">
          <h4>Estado Actual</h4>
          <div className="state-row">
            <span>y1: {state.y[0].toFixed(4)}</span>
            <span>y2: {state.y[1].toFixed(4)}</span>
          </div>
          <div className="state-row">
            <span>u1: {state.u[0].toFixed(4)}</span>
            <span>u2: {state.u[1].toFixed(4)}</span>
            <span>u3: {state.u[2].toFixed(4)}</span>
          </div>
          <div className="state-row">
            <span>d1: {state.d[0].toFixed(4)}</span>
            <span>d2: {state.d[1].toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
