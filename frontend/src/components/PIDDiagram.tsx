import React from "react";
import type { ProcessState } from "../types";

interface Props {
  state: ProcessState;
}

/**
 * Diagrama P&ID de la fraccionadora con colores dinámicos.
 *
 * Componentes:
 *   - Columna central con zonas de extracción (superior, lateral, fondo)
 *   - 3 circuitos de reflujo circulantes (superior, intermedio, fondo)
 *   - Indicadores de temperatura (colores semáforo)
 *   - Flujos animados
 */
export default function PIDDiagram({ state }: Props) {
  // Función auxiliar para color según temperatura
  const tempColor = (value: number) => {
    if (value < -0.3) return "#0066cc"; // Azul (frío)
    if (value < -0.1) return "#66cc00"; // Verde (normal)
    if (value < 0.2) return "#ffcc00"; // Amarillo (cálido)
    return "#ff6600"; // Naranja (muy cálido)
  };

  const indicatorColor = (value: number) => {
    if (Math.abs(value) <= 0.005) return "#00cc00"; // Verde: en setpoint
    if (Math.abs(value) <= 0.1) return "#ffcc00"; // Amarillo: cerca
    return "#ff3333"; // Rojo: fuera
  };

  return (
    <div className="pid-diagram">
      <svg viewBox="0 0 800 600" className="pid-svg">
        {/* Fondo */}
        <rect width="800" height="600" fill="#f5f5f5" />

        {/* Columna principal (rectángulo) */}
        <rect x="300" y="100" width="200" height="400" fill="#e6e6fa" stroke="#333" strokeWidth="2" />

        {/* Zonas de extracción */}
        <g>
          {/* Zona Superior */}
          <rect x="320" y="120" width="160" height="80" fill="#ffe6e6" stroke="#999" strokeWidth="1" />
          <text x="400" y="170" textAnchor="middle" fontSize="12" fill="#333">
            Zona Superior
          </text>
          <circle cx="540" cy="160" r="8" fill={tempColor(state.y[2])} stroke="#333" strokeWidth="1" />
          <text x="560" y="165" fontSize="10" fill="#666">
            y3: {state.y[2].toFixed(3)}
          </text>

          {/* Zona Lateral */}
          <rect x="320" y="230" width="160" height="80" fill="#e6ffe6" stroke="#999" strokeWidth="1" />
          <text x="400" y="280" textAnchor="middle" fontSize="12" fill="#333">
            Zona Lateral
          </text>
          <circle cx="540" cy="270" r="8" fill={tempColor(state.y[4])} stroke="#333" strokeWidth="1" />
          <text x="560" y="275" fontSize="10" fill="#666">
            y5: {state.y[4].toFixed(3)}
          </text>

          {/* Zona Fondo */}
          <rect x="320" y="340" width="160" height="80" fill="#e6f2ff" stroke="#999" strokeWidth="1" />
          <text x="400" y="390" textAnchor="middle" fontSize="12" fill="#333">
            Zona Fondo
          </text>
          <circle cx="540" cy="380" r="8" fill={tempColor(state.y[6])} stroke="#333" strokeWidth="1" />
          <text x="560" y="385" fontSize="10" fill="#666">
            y7: {state.y[6].toFixed(3)}
          </text>
        </g>

        {/* Circuitos de reflujo (lado izquierdo) */}
        <g>
          {/* Reflujo Superior */}
          <path d="M 250 160 Q 200 160 200 250 Q 200 340 250 340" fill="none" stroke="#0066cc" strokeWidth="2" />
          <circle cx="200" cy="160" r="6" fill="#e6e6ff" stroke="#0066cc" strokeWidth="1" />
          <text x="150" y="160" fontSize="10" fill="#0066cc">
            Ref.Sup
          </text>
          <circle cx="540" cy="130" r="8" fill={tempColor(state.y[3])} stroke="#333" strokeWidth="1" />
          <text x="560" y="135" fontSize="10" fill="#666">
            y4: {state.y[3].toFixed(3)}
          </text>

          {/* Reflujo Intermedio */}
          <path d="M 250 250 Q 180 250 180 380 Q 180 420 250 420" fill="none" stroke="#00cc66" strokeWidth="2" />
          <circle cx="180" cy="250" r="6" fill="#e6ffe6" stroke="#00cc66" strokeWidth="1" />
          <text x="130" y="250" fontSize="10" fill="#00cc66">
            Ref.Inter
          </text>
          <circle cx="540" cy="300" r="8" fill={tempColor(state.y[5])} stroke="#333" strokeWidth="1" />
          <text x="560" y="305" fontSize="10" fill="#666">
            y6: {state.y[5].toFixed(3)}
          </text>

          {/* Reflujo Fondo (demanda variable) */}
          <path d="M 250 450 Q 150 450 150 500" fill="none" stroke="#ff6600" strokeWidth="2" />
          <circle cx="150" cy="450" r="6" fill="#ffe6cc" stroke="#ff6600" strokeWidth="1" />
          <text x="90" y="450" fontSize="10" fill="#ff6600">
            Ref.Fondo
          </text>
        </g>

        {/* Indicadores de Punto Final (al lado derecho) */}
        <g>
          <text x="650" y="120" fontSize="14" fontWeight="bold" fill="#333">
            Puntos Finales
          </text>

          {/* y1 - Punto Final Superior */}
          <circle cx="690" cy="150" r="10" fill={indicatorColor(state.y[0])} stroke="#333" strokeWidth="1" />
          <text x="650" y="155" fontSize="11" fill="#333">
            y1: {state.y[0].toFixed(3)}
          </text>

          {/* y2 - Punto Final Lateral */}
          <circle cx="690" cy="200" r="10" fill={indicatorColor(state.y[1])} stroke="#333" strokeWidth="1" />
          <text x="650" y="205" fontSize="11" fill="#333">
            y2: {state.y[1].toFixed(3)}
          </text>

          {/* Setpoints */}
          <text x="650" y="260" fontSize="12" fontWeight="bold" fill="#333">
            Setpoints
          </text>
          <text x="650" y="280" fontSize="10" fill="#666">
            y1_sp: {state.u_setpoint[0].toFixed(3)}
          </text>
          <text x="650" y="300" fontSize="10" fill="#666">
            y2_sp: {state.u_setpoint[1].toFixed(3)}
          </text>
        </g>

        {/* Información de entradas */}
        <g>
          <text x="50" y="550" fontSize="12" fontWeight="bold" fill="#333">
            Entradas
          </text>
          <text x="50" y="570" fontSize="10" fill="#666">
            u1: {state.u[0].toFixed(3)} | u2: {state.u[1].toFixed(3)} | u3: {state.u[2].toFixed(3)}
          </text>
          <text x="50" y="590" fontSize="10" fill="#666">
            d1: {state.d[0].toFixed(3)} | d2: {state.d[1].toFixed(3)}
          </text>
        </g>

        {/* Tiempo simulado */}
        <text x="700" y="30" fontSize="12" fill="#666">
          t = {state.t.toFixed(1)} min
        </text>
      </svg>
    </div>
  );
}
