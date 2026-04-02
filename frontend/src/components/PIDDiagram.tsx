import React from "react";
import type { ProcessState } from "../types";

interface Props {
  state: ProcessState;
}

/**
 * Diagrama P&ID industrial de la Fraccionadora de Petróleo Pesado.
 * Sin fila de gauges externos — ocupa el 100 % del área disponible.
 * Los gauges mini están integrados dentro del propio SVG.
 */
export default function PIDDiagram({ state }: Props) {
  const { y, u, d, u_setpoint, analyzer_faults } = state;

  const tempColor = (val: number) => {
    const abs = Math.abs(val);
    if (abs < 0.05) return "#00ff88";
    if (abs < 0.15) return "#ffaa00";
    return "#ff4444";
  };

  const flowColor = (val: number) => {
    const abs = Math.abs(val);
    if (abs < 0.1) return "#00d4ff";
    if (abs < 0.3) return "#a78bfa";
    return "#fb923c";
  };

  const valveOpening = (val: number) =>
    Math.max(10, Math.min(90, Math.abs(val) * 100));

  const analyzerColor = (fault: boolean) => (fault ? "#ff4444" : "#00ff88");

  /** Dibuja un gauge mini SVG incrustado (arco semicircular) */
  const MiniGauge = ({
    cx, cy, r, value, min = -0.5, max = 0.5, setpoint, label, tag,
  }: {
    cx: number; cy: number; r: number;
    value: number; min?: number; max?: number; setpoint?: number;
    label: string; tag: string;
  }) => {
    const clamp = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min)));
    const pct = clamp(value);
    const spPct = setpoint !== undefined ? clamp(setpoint) : null;

    // Arco de -200° a 20° (220° de barrido), eje Y apunta abajo en SVG
    const startAngle = -210 * (Math.PI / 180);
    const endAngle   =  30 * (Math.PI / 180);
    const sweep = endAngle - startAngle;
    const valAngle = startAngle + sweep * pct;

    const px = (a: number) => cx + r * Math.cos(a);
    const py = (a: number) => cy + r * Math.sin(a);

    // Path arco de fondo
    const arcBg = `M ${px(startAngle)} ${py(startAngle)} A ${r} ${r} 0 1 1 ${px(endAngle)} ${py(endAngle)}`;
    // Path arco de valor
    const largeArc = sweep * pct > Math.PI ? 1 : 0;
    const arcVal = `M ${px(startAngle)} ${py(startAngle)} A ${r} ${r} 0 ${largeArc} 1 ${px(valAngle)} ${py(valAngle)}`;

    const col = tempColor(setpoint !== undefined ? value - setpoint : value);

    // Aguja
    const nx = cx + (r - 4) * Math.cos(valAngle);
    const ny = cy + (r - 4) * Math.sin(valAngle);

    return (
      <g>
        {/* Fondo del gauge */}
        <circle cx={cx} cy={cy} r={r + 6} fill="#0d1117" stroke="#1e2533" strokeWidth="1" />
        {/* Arco fondo */}
        <path d={arcBg} fill="none" stroke="#1f2937" strokeWidth="5" strokeLinecap="round" />
        {/* Arco valor */}
        <path d={arcVal} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round" opacity="0.9" />
        {/* SP marker */}
        {spPct !== null && (() => {
          const spAngle = startAngle + sweep * spPct;
          return (
            <line
              x1={cx + (r - 8) * Math.cos(spAngle)} y1={cy + (r - 8) * Math.sin(spAngle)}
              x2={cx + (r + 1) * Math.cos(spAngle)} y2={cy + (r + 1) * Math.sin(spAngle)}
              stroke="#ffaa00" strokeWidth="2" strokeLinecap="round"
            />
          );
        })()}
        {/* Aguja */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="2.5" fill={col} />
        {/* Tag */}
        <text x={cx} y={cy - r - 10} textAnchor="middle" fontSize="8" fill="#6b7280" fontFamily="monospace"
          letterSpacing="0.5">{tag}</text>
        {/* Valor */}
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="9" fill={col} fontFamily="monospace" fontWeight="bold">
          {value.toFixed(3)}
        </text>
        {/* Label */}
        <text x={cx} y={cy + r + 14} textAnchor="middle" fontSize="7" fill="#4b5563" fontFamily="monospace">
          {label}
        </text>
      </g>
    );
  };

  // Columna principal — ocupa más espacio ahora
  const col = { x: 310, y: 80, w: 200, h: 500 };

  const reflSupPath  = `M ${col.x} 170 H 200 V 120 H 155`;
  const reflInterPath = `M ${col.x} 310 H 170 V 420 H 148`;
  const reflFondoPath = `M ${col.x} 460 H 128 V 570 H 108`;
  const extSupPath   = `M ${col.x + col.w} 170 H 570 V 128 H 620`;
  const extLatPath   = `M ${col.x + col.w} 310 H 600`;
  const demFondoPath = `M ${col.x + col.w} 460 H 575 V 530 H 620`;
  const feedPath     = `M ${col.x + col.w / 2} ${col.y + col.h} V 640`;
  const vaporPath    = `M ${col.x + col.w / 2} ${col.y} V 42 H 840 V 60`;

  return (
    <div className="pid-wrapper pid-wrapper-full">
      <svg
        viewBox="0 0 900 680"
        className="pid-svg-industrial"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="colGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#1e3a5f" />
            <stop offset="50%"  stopColor="#1a3050" />
            <stop offset="100%" stopColor="#0f1e35" />
          </linearGradient>
          <linearGradient id="zSupGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#00d4ff33" />
            <stop offset="100%" stopColor="#00d4ff08" />
          </linearGradient>
          <linearGradient id="zLatGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#00ff8828" />
            <stop offset="100%" stopColor="#00ff8808" />
          </linearGradient>
          <linearGradient id="zFndGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#fb923c22" />
            <stop offset="100%" stopColor="#fb923c44" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="arrowCyan" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#00d4ff" />
          </marker>
          <marker id="arrowOrange" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#fb923c" />
          </marker>
          <marker id="arrowPurple" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#a78bfa" />
          </marker>
          <style>{`
            .flow-cyan   { stroke-dasharray:10 6; animation:flowDash    1.8s linear infinite; }
            .flow-purple { stroke-dasharray:10 6; animation:flowDash    2.2s linear infinite; }
            .flow-orange { stroke-dasharray:10 6; animation:flowDash    2.5s linear infinite; }
            .flow-rev    { stroke-dasharray: 8 6; animation:flowDashRev 2.0s linear infinite; }
            @keyframes flowDash    { from{stroke-dashoffset:0} to{stroke-dashoffset:-40} }
            @keyframes flowDashRev { from{stroke-dashoffset:0} to{stroke-dashoffset: 40} }
          `}</style>
        </defs>

        {/* ── TÍTULO ───────────────────────────────────────────── */}
        <text x="12" y="22" fontSize="13" fill="#e2e8f0" fontFamily="monospace" fontWeight="bold">
          FRACCIONADORA DE PETRÓLEO PESADO
        </text>
        <text x="12" y="36" fontSize="9" fill="#6b7280" fontFamily="monospace">
          Shell Control Problem  |  7CV × 3MV × 2DV  |  FOPDT 7×5  |  MPC Np=15 Nc=5
        </text>

        {/* ── GAUGES MINI integrados en esquina izquierda ──────── */}
        {/* AT-101 */}
        <MiniGauge cx={54}  cy={110} r={38} value={y[0]} setpoint={u_setpoint[0]}
          label="Pto.Final Sup" tag="AT-101" />
        {/* AT-201 */}
        <MiniGauge cx={148} cy={110} r={38} value={y[1]} setpoint={u_setpoint[1]}
          label="Pto.Final Lat" tag="AT-201" />

        {/* ── COLUMNA PRINCIPAL ─────────────────────────────────── */}
        {/* Borde glow */}
        <rect x={col.x - 6} y={col.y - 6} width={col.w + 12} height={col.h + 12}
          fill="none" stroke="#00d4ff18" strokeWidth="4" rx="10" />
        {/* Cuerpo */}
        <rect x={col.x} y={col.y} width={col.w} height={col.h}
          fill="url(#colGrad)" stroke="#334155" strokeWidth="2.5" rx="6" />

        {/* Zonas de color */}
        <rect x={col.x} y={col.y}       width={col.w} height={160}  fill="url(#zSupGrad)" rx="6" />
        <rect x={col.x} y={col.y + 210} width={col.w} height={150}  fill="url(#zLatGrad)" />
        <rect x={col.x} y={col.y + 390} width={col.w} height={110}  fill="url(#zFndGrad)" />

        {/* Etiquetas de zona */}
        <text x={col.x + col.w/2} y={col.y + 24}  textAnchor="middle"
          fontSize="9" fill="#00d4ff55" fontFamily="monospace" letterSpacing="1">ZONA SUPERIOR</text>
        <text x={col.x + col.w/2} y={col.y + 240} textAnchor="middle"
          fontSize="9" fill="#00ff8855" fontFamily="monospace" letterSpacing="1">ZONA LATERAL</text>
        <text x={col.x + col.w/2} y={col.y + 428} textAnchor="middle"
          fontSize="9" fill="#fb923c55" fontFamily="monospace" letterSpacing="1">ZONA FONDO</text>

        {/* Platos teóricos */}
        {[160, 210, 270, 330, 385].map((yOff, i) => (
          <g key={i}>
            <line x1={col.x + 10} y1={col.y + yOff} x2={col.x + col.w - 10} y2={col.y + yOff}
              stroke="#2d4a6b" strokeWidth="1.5" />
            <rect x={col.x + col.w - 26} y={col.y + yOff} width="12" height="30"
              fill="#162035" stroke="#2d4a6b" strokeWidth="1" rx="1" />
          </g>
        ))}

        {/* Sello líquido fondo */}
        <ellipse cx={col.x + col.w/2} cy={col.y + col.h - 20} rx={col.w/2 - 14} ry="14"
          fill="#fb923c18" stroke="#fb923c30" strokeWidth="1" />
        <text x={col.x + col.w/2} y={col.y + col.h - 8} textAnchor="middle"
          fontSize="7" fill="#4b5563" fontFamily="monospace">5 PLATOS TEÓRICOS</text>

        {/* ── VAPOR DE CABEZA ───────────────────────────────────── */}
        <path d={vaporPath} fill="none" stroke="#00d4ff" strokeWidth="2.5"
          className="flow-cyan" markerEnd="url(#arrowCyan)" />
        <rect x="802" y="46" width="70" height="28" rx="3" fill="#0f172a" stroke="#00d4ff33" strokeWidth="1" />
        <text x="837" y="57"  textAnchor="middle" fontSize="8" fill="#6b7280" fontFamily="monospace">VAPOR</text>
        <text x="837" y="68"  textAnchor="middle" fontSize="8" fill="#6b7280" fontFamily="monospace">CABEZA</text>

        {/* Temp TT-301 en columna */}
        <circle cx={col.x + col.w - 10} cy={col.y + 80} r="5"
          fill={tempColor(y[2])} filter="url(#glow)" />
        <text x={col.x + col.w + 8} y={col.y + 84}
          fontSize="8" fill="#9ca3af" fontFamily="monospace">TT-301: {y[2].toFixed(3)}</text>

        {/* ── REFLUJO SUPERIOR (d2) ─────────────────────────────── */}
        <path d={reflSupPath} fill="none" stroke={flowColor(d[1])} strokeWidth="2"
          className="flow-rev" />
        <g transform="translate(165, 120)">
          <polygon points="0,-9 9,0 0,9 -9,0" fill="#1f2937" stroke={flowColor(d[1])} strokeWidth="1.5" />
          <text x="0" y="-13" textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="monospace">FCV-D2</text>
        </g>
        <rect x="30" y="98" width="72" height="28" rx="3" fill="#1f2937" stroke="#374151" strokeWidth="1" />
        <text x="66" y="109" textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="monospace">d2: Refl.Sup</text>
        <text x="66" y="120" textAnchor="middle" fontSize="10" fill="#00d4ff" fontFamily="monospace" fontWeight="bold">
          {d[1].toFixed(3)}
        </text>
        <circle cx={col.x - 14} cy={160} r="5" fill={tempColor(y[3])} filter="url(#glow)" />
        <text x={col.x - 80} y="164" fontSize="8" fill="#9ca3af" fontFamily="monospace">TT-401:{y[3].toFixed(3)}</text>

        {/* ── EXTRACCIÓN SUPERIOR (u1) ──────────────────────────── */}
        <path d={extSupPath} fill="none" stroke={flowColor(u[0])} strokeWidth="2.5"
          className="flow-purple" markerEnd="url(#arrowPurple)" />
        <g transform="translate(622, 128)">
          <polygon points="0,-12 12,0 0,12 -12,0" fill="#1f2937" stroke={flowColor(u[0])} strokeWidth="2" />
          <rect x={-9} y={-2} width={18 * valveOpening(u[0]) / 100} height="4"
            fill={flowColor(u[0])} opacity="0.7" />
          <text x="0" y="-16" textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="monospace">FCV-101</text>
          <text x="0" y="22"  textAnchor="middle" fontSize="8" fill={flowColor(u[0])} fontFamily="monospace">
            {valveOpening(u[0]).toFixed(0)}%
          </text>
        </g>
        <rect x="640" y="88" width="68" height="28" rx="3" fill="#1f2937" stroke="#374151" strokeWidth="1" />
        <text x="674" y="99"  textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="monospace">u1: Ext.Sup</text>
        <text x="674" y="110" textAnchor="middle" fontSize="10" fill="#a78bfa" fontFamily="monospace" fontWeight="bold">
          {u[0].toFixed(3)}
        </text>

        {/* Analizador AT-101 */}
        <rect x="640" y="150" width="68" height="32" rx="4"
          fill={analyzer_faults.y1 ? "#ff444415" : "#00ff8815"}
          stroke={analyzerColor(analyzer_faults.y1)} strokeWidth="1.5" />
        <text x="674" y="162" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="monospace">AT-101</text>
        <text x="674" y="175" textAnchor="middle" fontSize="9"
          fill={analyzerColor(analyzer_faults.y1)} fontFamily="monospace">
          {analyzer_faults.y1 ? "⚠ FAULT" : "● OK"}
        </text>

        {/* ── REFLUJO INTERMEDIO (d1) ───────────────────────────── */}
        <path d={reflInterPath} fill="none" stroke={flowColor(d[0])} strokeWidth="2"
          className="flow-rev" />
        <g transform="translate(157, 420)">
          <polygon points="0,-9 9,0 0,9 -9,0" fill="#1f2937" stroke={flowColor(d[0])} strokeWidth="1.5" />
          <text x="0" y="-13" textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="monospace">FCV-D1</text>
        </g>
        <rect x="30" y="394" width="72" height="28" rx="3" fill="#1f2937" stroke="#374151" strokeWidth="1" />
        <text x="66" y="405" textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="monospace">d1: Refl.Int</text>
        <text x="66" y="416" textAnchor="middle" fontSize="10" fill="#00d4ff" fontFamily="monospace" fontWeight="bold">
          {d[0].toFixed(3)}
        </text>
        <circle cx={col.x - 14} cy={310} r="5" fill={tempColor(y[5])} filter="url(#glow)" />
        <text x={col.x - 80} y="314" fontSize="8" fill="#9ca3af" fontFamily="monospace">TT-601:{y[5].toFixed(3)}</text>

        {/* ── EXTRACCIÓN LATERAL (u2) ───────────────────────────── */}
        <path d={extLatPath} fill="none" stroke={flowColor(u[1])} strokeWidth="2.5"
          className="flow-purple" />
        <line x1="600" y1="290" x2="600" y2="340" stroke={flowColor(u[1])} strokeWidth="2.5"
          className="flow-purple" markerEnd="url(#arrowPurple)" />
        <g transform="translate(600, 274)">
          <polygon points="0,-12 12,0 0,12 -12,0" fill="#1f2937" stroke={flowColor(u[1])} strokeWidth="2" />
          <rect x={-9} y={-2} width={18 * valveOpening(u[1]) / 100} height="4"
            fill={flowColor(u[1])} opacity="0.7" />
          <text x="0" y="-16" textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="monospace">FCV-201</text>
          <text x="0" y="22"  textAnchor="middle" fontSize="8" fill={flowColor(u[1])} fontFamily="monospace">
            {valveOpening(u[1]).toFixed(0)}%
          </text>
        </g>
        <rect x="624" y="284" width="68" height="28" rx="3" fill="#1f2937" stroke="#374151" strokeWidth="1" />
        <text x="658" y="295" textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="monospace">u2: Ext.Lat</text>
        <text x="658" y="306" textAnchor="middle" fontSize="10" fill="#a78bfa" fontFamily="monospace" fontWeight="bold">
          {u[1].toFixed(3)}
        </text>

        {/* Analizador AT-201 */}
        <rect x="624" y="322" width="68" height="32" rx="4"
          fill={analyzer_faults.y2 ? "#ff444415" : "#00ff8815"}
          stroke={analyzerColor(analyzer_faults.y2)} strokeWidth="1.5" />
        <text x="658" y="334" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="monospace">AT-201</text>
        <text x="658" y="347" textAnchor="middle" fontSize="9"
          fill={analyzerColor(analyzer_faults.y2)} fontFamily="monospace">
          {analyzer_faults.y2 ? "⚠ FAULT" : "● OK"}
        </text>

        <circle cx={col.x + col.w + 14} cy={310} r="5" fill={tempColor(y[4])} filter="url(#glow)" />
        <text x={col.x + col.w + 24} y="314" fontSize="8" fill="#9ca3af" fontFamily="monospace">
          TT-501:{y[4].toFixed(3)}
        </text>

        {/* ── REFLUJO FONDO ─────────────────────────────────────── */}
        <path d={reflFondoPath} fill="none" stroke="#fb923c" strokeWidth="2.5"
          className="flow-orange" />
        <ellipse cx="80" cy="582" rx="30" ry="20" fill="#1f2937" stroke="#fb923c" strokeWidth="2" />
        <text x="80" y="578" textAnchor="middle" fontSize="7"  fill="#fb923c88" fontFamily="monospace">REBOILER</text>
        <text x="80" y="589" textAnchor="middle" fontSize="6"  fill="#4b5563"   fontFamily="monospace">E-101</text>

        {/* ── DEMANDA REFLUJO FONDO (u3) ───────────────────────── */}
        <path d={demFondoPath} fill="none" stroke={flowColor(u[2])} strokeWidth="2.5"
          className="flow-orange" markerEnd="url(#arrowOrange)" />
        <g transform="translate(622, 530)">
          <polygon points="0,-12 12,0 0,12 -12,0" fill="#1f2937" stroke={flowColor(u[2])} strokeWidth="2" />
          <rect x={-9} y={-2} width={18 * valveOpening(u[2]) / 100} height="4"
            fill={flowColor(u[2])} opacity="0.7" />
          <text x="0" y="-16" textAnchor="middle" fontSize="7" fill="#9ca3af" fontFamily="monospace">FCV-301</text>
          <text x="0" y="22"  textAnchor="middle" fontSize="8" fill={flowColor(u[2])} fontFamily="monospace">
            {valveOpening(u[2]).toFixed(0)}%
          </text>
        </g>
        <rect x="640" y="542" width="76" height="28" rx="3" fill="#1f2937" stroke="#374151" strokeWidth="1" />
        <text x="678" y="553" textAnchor="middle" fontSize="7"  fill="#9ca3af" fontFamily="monospace">u3: Dem.Refl.Fondo</text>
        <text x="678" y="564" textAnchor="middle" fontSize="10" fill="#a78bfa" fontFamily="monospace" fontWeight="bold">
          {u[2].toFixed(3)}
        </text>

        <circle cx={col.x - 14} cy={460} r="5" fill={tempColor(y[6])} filter="url(#glow)" />
        <text x={col.x - 80} y="464" fontSize="8" fill="#9ca3af" fontFamily="monospace">TT-701:{y[6].toFixed(3)}</text>

        {/* ── ALIMENTACIÓN ──────────────────────────────────────── */}
        <path d={feedPath} fill="none" stroke="#4b5563" strokeWidth="2.5"
          className="flow-rev" />
        <rect x={col.x + col.w/2 - 36} y="632" width="72" height="22" rx="3"
          fill="#1f2937" stroke="#374151" strokeWidth="1" />
        <text x={col.x + col.w/2} y="643" textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="monospace">
          ALIMENTACIÓN
        </text>
        <text x={col.x + col.w/2} y="651" textAnchor="middle" fontSize="7" fill="#4b5563" fontFamily="monospace">
          CRUDO PESADO
        </text>

        {/* ── PANEL SETPOINTS MPC ───────────────────────────────── */}
        <rect x="730" y="410" width="158" height="100" rx="5"
          fill="#0f172a" stroke="#00d4ff33" strokeWidth="1" />
        <text x="809" y="427" textAnchor="middle" fontSize="9" fill="#00d4ff" fontFamily="monospace" letterSpacing="1">
          CONTROLADOR MPC
        </text>
        <line x1="738" y1="432" x2="879" y2="432" stroke="#1e3a5f" strokeWidth="1" />
        <text x="742" y="446" fontSize="8" fill="#6b7280" fontFamily="monospace">AT-101 SP:</text>
        <text x="878" y="446" textAnchor="end" fontSize="9" fill="#ffaa00" fontFamily="monospace" fontWeight="bold">
          {u_setpoint[0].toFixed(4)}
        </text>
        <text x="742" y="460" fontSize="8" fill="#6b7280" fontFamily="monospace">AT-201 SP:</text>
        <text x="878" y="460" textAnchor="end" fontSize="9" fill="#ffaa00" fontFamily="monospace" fontWeight="bold">
          {u_setpoint[1].toFixed(4)}
        </text>
        <text x="742" y="474" fontSize="8" fill="#6b7280" fontFamily="monospace">Np / Nc:</text>
        <text x="878" y="474" textAnchor="end" fontSize="9" fill="#00d4ff" fontFamily="monospace">15 / 5</text>
        <text x="742" y="494" fontSize="8" fill="#6b7280" fontFamily="monospace">t simulado:</text>
        <text x="878" y="494" textAnchor="end" fontSize="11" fill="#00ff88" fontFamily="monospace" fontWeight="bold">
          {state.t.toFixed(1)} min
        </text>

        {/* ── LEYENDA ───────────────────────────────────────────── */}
        <rect x="730" y="522" width="158" height="98" rx="5"
          fill="#0f172a" stroke="#37415133" strokeWidth="1" />
        <text x="809" y="539" textAnchor="middle" fontSize="9" fill="#9ca3af" fontFamily="monospace">LEYENDA</text>
        <line x1="738" y1="544" x2="879" y2="544" stroke="#1e3a5f" strokeWidth="1" />
        <circle cx="746" cy="556" r="4" fill="#00ff88" />
        <text x="757" y="559" fontSize="8" fill="#9ca3af" fontFamily="monospace">Normal (|Δ| ≤ 0.05)</text>
        <circle cx="746" cy="572" r="4" fill="#ffaa00" />
        <text x="757" y="575" fontSize="8" fill="#9ca3af" fontFamily="monospace">Advertencia</text>
        <circle cx="746" cy="588" r="4" fill="#ff4444" />
        <text x="757" y="591" fontSize="8" fill="#9ca3af" fontFamily="monospace">Alarma</text>
        <line x1="742" y1="604" x2="759" y2="604" stroke="#ffaa00" strokeWidth="2" strokeDasharray="3,2" />
        <text x="763" y="607" fontSize="8" fill="#9ca3af" fontFamily="monospace">Setpoint MPC</text>
      </svg>
    </div>
  );
}
