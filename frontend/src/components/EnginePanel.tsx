import React, { useState } from "react";
import type { EngineStatus } from "../types";

interface Props {
  engineStatus: EngineStatus;
}

export default function EnginePanel({ engineStatus }: Props) {
  const [selected, setSelected] = useState<"python" | "octave">(engineStatus.active);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSwitch = async (engine: "python" | "octave") => {
    try {
      const res = await fetch("/api/engine/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setSelected(engine);
        else alert(data.message);
      }
    } catch { /* silent */ }
  };

  const handleBenchmark = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/engine/benchmark");
      if (res.ok) setBenchmark(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const engineLabel = (e: "python" | "octave") => {
    const isActive = engineStatus.active === e;
    const isFallback = isActive && engineStatus.active_is_fallback;
    if (!isActive) return { color: "#6b7280", text: "Inactivo" };
    if (isFallback) return { color: "#ffaa00", text: "Activo (fallback)" };
    return { color: "#00ff88", text: "Activo" };
  };

  return (
    <div className="engine-panel-modern">
      {/* Selector */}
      <div className="engine-options">
        {(["python", "octave"] as const).map((eng) => {
          const { color, text } = engineLabel(eng);
          const isAvailable = eng === "python" ? engineStatus.python_available : engineStatus.octave_available;
          const isSelected = selected === eng;

          return (
            <button
              key={eng}
              className={`engine-option-btn ${isSelected ? "selected" : ""} ${!isAvailable ? "unavailable" : ""}`}
              onClick={() => isAvailable && handleSwitch(eng)}
              disabled={!isAvailable}
              style={{
                borderColor: isSelected ? color : "#374151",
                boxShadow: isSelected ? `0 0 10px ${color}44` : "none",
              }}
            >
              <div className="engine-opt-header">
                <div className="engine-dot" style={{ background: color }} />
                <span className="engine-opt-name">
                  {eng === "python" ? "Python" : "GNU Octave"}
                </span>
                <span className="engine-opt-status" style={{ color }}>
                  {text}
                </span>
              </div>
              <div className="engine-opt-detail">
                {eng === "python"
                  ? "numpy · scipy · cvxpy"
                  : isAvailable
                  ? `v${engineStatus.octave_version ?? "?"} · timeout: ${engineStatus.octave_timeout_s}s`
                  : "No instalado"}
              </div>
            </button>
          );
        })}
      </div>

      {!engineStatus.octave_available && (
        <div className="engine-install-hint">
          <span style={{ color: "#ffaa00" }}>⚠</span> Octave no detectado.
          Instalar: <code>sudo apt install octave</code>
        </div>
      )}

      {/* Benchmark */}
      <button
        className="engine-benchmark-btn"
        onClick={handleBenchmark}
        disabled={loading}
      >
        {loading ? "⟳ Ejecutando..." : "▶ Benchmark Python vs Octave"}
      </button>

      {benchmark && (
        <div className="engine-benchmark-results">
          <div className="bench-row">
            <span>Python</span>
            <span className="bench-available">
              {benchmark.python.available ? "✓" : "✗"}
            </span>
            <span className="bench-time" style={{ color: "#00d4ff" }}>
              {benchmark.python.duration_ms?.toFixed(1) ?? "—"} ms
            </span>
          </div>
          <div className="bench-row">
            <span>Octave</span>
            <span className="bench-available">
              {benchmark.octave?.available ? "✓" : "✗"}
            </span>
            <span className="bench-time" style={{ color: "#a78bfa" }}>
              {benchmark.octave?.duration_ms?.toFixed(1) ?? "—"} ms
            </span>
          </div>
          {benchmark.python.duration_ms && benchmark.octave?.duration_ms && (
            <div className="bench-ratio">
              Ratio Octave/Python:{" "}
              <strong style={{ color: "#ffaa00" }}>
                {(benchmark.octave.duration_ms / benchmark.python.duration_ms).toFixed(2)}x
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
