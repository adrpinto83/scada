import React from "react";
import type { ProcessState } from "../types";

interface Props {
  state: ProcessState;
}

/**
 * Gráficas de tendencias en tiempo real.
 *
 * Muestra CVs, MVs y DVs en un canvas simple.
 * En producción, usar Recharts o Chart.js para mejor rendimiento.
 */
export default function Trends({ state }: Props) {
  // Función auxiliar para dibujar gráfica simple
  const renderSimpleChart = (
    title: string,
    data: number[],
    min: number = -0.5,
    max: number = 0.5,
    labels?: string[]
  ) => {
    if (data.length === 0) return null;

    const width = 300;
    const height = 150;
    const padding = 30;
    const plotWidth = width - 2 * padding;
    const plotHeight = height - 2 * padding;

    // Escala
    const yScale = plotHeight / (max - min);
    const xScale = plotWidth / (data.length - 1 || 1);

    // Puntos
    let points = "";
    data.forEach((value, idx) => {
      const x = padding + idx * xScale;
      const y = padding + (max - value) * yScale;
      points += `${x},${y} `;
    });

    const lastValue = data[data.length - 1];

    return (
      <div key={title} className="chart-container">
        <h4>{title}</h4>
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
          {/* Grid */}
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#ccc" strokeWidth="1" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#ccc" strokeWidth="1" />

          {/* Línea de datos */}
          <polyline points={points} fill="none" stroke="#0066cc" strokeWidth="2" />

          {/* Puntos finales */}
          {data.length > 0 && (
            <circle cx={width - padding} cy={padding + (max - lastValue) * yScale} r="4" fill="#ff6600" />
          )}

          {/* Etiquetas */}
          <text x={width / 2} y="15" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#333">
            {lastValue.toFixed(3)}
          </text>

          {/* Límites */}
          <text x={padding - 25} y={padding + 5} fontSize="9" fill="#999">
            {max.toFixed(2)}
          </text>
          <text x={padding - 25} y={height - padding + 5} fontSize="9" fill="#999">
            {min.toFixed(2)}
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className="trends-container">
      <div className="trends-grid">
        {/* CVs */}
        <div className="trends-section">
          <h3>Salidas Controladas (CVs)</h3>
          <div className="charts-row">
            {renderSimpleChart("y1: Punto Final Sup", state.history?.y.map((y) => y[0]) || [], -0.5, 0.5)}
            {renderSimpleChart("y2: Punto Final Lat", state.history?.y.map((y) => y[1]) || [], -0.5, 0.5)}
            {renderSimpleChart("y3: Temp Superior", state.history?.y.map((y) => y[2]) || [], -0.5, 0.5)}
          </div>
        </div>

        {/* MVs */}
        <div className="trends-section">
          <h3>Entradas Manipuladas (MVs)</h3>
          <div className="charts-row">
            {renderSimpleChart("u1: Ext. Superior", state.history?.u.map((u) => u[0]) || [], -0.5, 0.5)}
            {renderSimpleChart("u2: Ext. Lateral", state.history?.u.map((u) => u[1]) || [], -0.5, 0.5)}
            {renderSimpleChart("u3: Dem. Refl. Fondo", state.history?.u.map((u) => u[2]) || [], -0.5, 0.5)}
          </div>
        </div>

        {/* DVs */}
        <div className="trends-section">
          <h3>Perturbaciones (DVs)</h3>
          <div className="charts-row">
            {renderSimpleChart("d1: Dem. Refl. Inter", state.history?.d.map((d) => d[0]) || [], -0.5, 0.5)}
            {renderSimpleChart("d2: Dem. Refl. Super", state.history?.d.map((d) => d[1]) || [], -0.5, 0.5)}
          </div>
        </div>
      </div>

      {/* Información de Ancho de Banda */}
      {state.bandwidth && (
        <div className="bandwidth-info">
          <h4>Análisis Ancho de Banda (OBJ-4)</h4>
          <div className="bandwidth-values">
            <span>BW_OL: {state.bandwidth.bw_ol.toFixed(4)}</span>
            <span>BW_CL: {state.bandwidth.bw_cl.toFixed(4)}</span>
            <span>Ratio: {state.bandwidth.ratio.toFixed(3)}</span>
            <span className={state.bandwidth.compliant ? "compliant" : "non-compliant"}>
              {state.bandwidth.compliant ? "✓ Cumple" : "✗ No cumple"} [{state.bandwidth.ratio_min}, {state.bandwidth.ratio_max}]
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
