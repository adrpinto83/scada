import React, { useState } from "react";
import type { EngineStatus } from "../types";

interface Props {
  engineStatus: EngineStatus;
}

/**
 * Panel de Motor de Cálculo Dual.
 *
 * Funcionalidades:
 *   - Radio buttons para seleccionar motor (Python/Octave)
 *   - Badges de color: verde = OK, amarillo = fallback, rojo = no disponible
 *   - Latencia de última llamada
 *   - Botón de benchmark (comparar tiempos Python vs Octave)
 *   - Logs de llamadas a Octave
 */
export default function EnginePanel({ engineStatus }: Props) {
  const [selectedEngine, setSelectedEngine] = useState<"python" | "octave">(
    engineStatus.active
  );
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);
  const [showBenchmark, setShowBenchmark] = useState(false);

  const handleEngineSwitch = async (engine: "python" | "octave") => {
    try {
      const response = await fetch("/api/engine/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSelectedEngine(engine);
          console.log(`Motor cambiado a ${engine}`);
        } else {
          alert(data.message);
        }
      }
    } catch (e) {
      console.error("Error switching engine:", e);
    }
  };

  const handleBenchmark = async () => {
    try {
      setShowBenchmark(true);
      const response = await fetch("/api/engine/benchmark");
      if (response.ok) {
        const data = await response.json();
        setBenchmarkResult(data);
      }
    } catch (e) {
      console.error("Error running benchmark:", e);
    }
  };

  const getEngineColor = (engine: "python" | "octave") => {
    if (engineStatus.active === engine) {
      return engineStatus.active_is_fallback ? "#ffcc00" : "#00cc00";
    } else if (engine === "octave" && !engineStatus.octave_available) {
      return "#cccccc";
    }
    return "#666666";
  };

  const getEngineStatus = (engine: "python" | "octave") => {
    if (engineStatus.active === engine) {
      return engineStatus.active_is_fallback ? "Fallback" : "Activo";
    } else if (engine === "octave" && !engineStatus.octave_available) {
      return "No instalado";
    }
    return "Disponible";
  };

  return (
    <div className="engine-panel">
      {/* Selector de motor */}
      <div className="engine-selector">
        <div className="engine-option">
          <input
            type="radio"
            id="python-radio"
            name="engine"
            value="python"
            checked={selectedEngine === "python"}
            onChange={() => handleEngineSwitch("python")}
          />
          <label htmlFor="python-radio">
            <span
              className="engine-badge"
              style={{ backgroundColor: getEngineColor("python") }}
            />
            Python (numpy/scipy/cvxpy)
          </label>
          <span className="engine-status">{getEngineStatus("python")}</span>
        </div>

        <div className="engine-option">
          <input
            type="radio"
            id="octave-radio"
            name="engine"
            value="octave"
            checked={selectedEngine === "octave"}
            onChange={() => handleEngineSwitch("octave")}
            disabled={!engineStatus.octave_available}
          />
          <label htmlFor="octave-radio">
            <span
              className="engine-badge"
              style={{ backgroundColor: getEngineColor("octave") }}
            />
            GNU Octave
          </label>
          <span className="engine-status">{getEngineStatus("octave")}</span>
        </div>
      </div>

      {/* Información de Octave */}
      {engineStatus.octave_available && (
        <div className="octave-info">
          <p>
            <strong>Versión:</strong> {engineStatus.octave_version || "desconocida"}
          </p>
          <p>
            <strong>Binario:</strong> {engineStatus.octave_bin || "octave-cli"}
          </p>
          <p>
            <strong>Timeout:</strong> {engineStatus.octave_timeout_s}s
          </p>
        </div>
      )}

      {!engineStatus.octave_available && (
        <div className="octave-warning">
          ⚠️ GNU Octave no está instalado. Instalar con:
          <ul>
            <li>
              <code>Linux/WSL: sudo apt install octave</code>
            </li>
            <li>
              <code>macOS: brew install octave</code>
            </li>
            <li>
              <code>Windows: winget install GNU.Octave</code>
            </li>
          </ul>
        </div>
      )}

      {/* Benchmark */}
      <div className="engine-benchmark">
        <button onClick={handleBenchmark} className="btn-benchmark">
          ▶ Ejecutar Benchmark
        </button>

        {showBenchmark && benchmarkResult && (
          <div className="benchmark-results">
            <h5>Resultados Benchmark</h5>
            <table>
              <thead>
                <tr>
                  <th>Motor</th>
                  <th>Disponible</th>
                  <th>Tiempo (ms)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Python</td>
                  <td>{benchmarkResult.python.available ? "✓" : "✗"}</td>
                  <td>{benchmarkResult.python.duration_ms?.toFixed(2) || "—"}</td>
                </tr>
                <tr>
                  <td>Octave</td>
                  <td>{benchmarkResult.octave.available ? "✓" : "✗"}</td>
                  <td>{benchmarkResult.octave.duration_ms?.toFixed(2) || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
