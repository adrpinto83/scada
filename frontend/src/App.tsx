import React, { useState } from "react";
import "./App.css";
import { useWebSocket } from "./hooks/useWebSocket";
import { useEngineStatus } from "./hooks/useEngineStatus";
import { apiURL } from "./config";

import PIDDiagram from "./components/PIDDiagram";
import Trends from "./components/Trends";
import OperatorPanel from "./components/OperatorPanel";
import AlarmPanel from "./components/AlarmPanel";
import EnginePanel from "./components/EnginePanel";
import KPICard from "./components/KPICard";
import ThemeToggle from "./components/ThemeToggle";

// split = P&ID arriba + Tendencias abajo
// pid   = Solo P&ID (pantalla completa en área principal)
// trends = Solo Tendencias
// pid-focus = P&ID expandido sobre toda la pantalla (modal overlay)
type ViewMode = "pid" | "trends" | "split";

export default function App() {
  const [simRunning, setSimRunning] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [pidFocus, setPidFocus] = useState(false);          // ← modo foco overlay P&ID
  const [trendsFocus, setTrendsFocus] = useState(false);    // ← modo foco overlay Tendencias
  const [sidebarTab, setSidebarTab] = useState<"control" | "alarms" | "engine">("control");
  const { isConnected, lastData } = useWebSocket();
  const { engineStatus } = useEngineStatus();

  const alarmCount = lastData?.alarms?.filter((a) => !a.acknowledged).length ?? 0;
  const criticalAlarms = lastData?.alarms?.filter((a) => a.severity === "HH").length ?? 0;

  const handleStart = async () => {
    try {
      const res = await fetch(apiURL("/api/simulation/start"), { method: "POST" });
      if (res.ok) setSimRunning(true);
    } catch {}
  };
  const handleStop = async () => {
    try {
      const res = await fetch(apiURL("/api/simulation/stop"), { method: "POST" });
      if (res.ok) setSimRunning(false);
    } catch {}
  };
  const handleReset = async () => {
    try {
      const res = await fetch(apiURL("/api/simulation/reset"), { method: "POST" });
      if (res.ok) setSimRunning(false);
    } catch {}
  };

  return (
    <div className="scada-root">
      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <header className="scada-header">
        <div className="header-left">
          <div className="header-logo">
            <div className="logo-icon">⬡</div>
            <div className="logo-text">
              <span className="logo-title">SCADA</span>
              <span className="logo-sub">FRACCIONADORA</span>
            </div>
          </div>
          <div className="header-meta">
            <span className="header-meta-line">Shell Control Problem — Petróleo Pesado</span>
            <span className="header-meta-line dim">
              UDO · Postgrado Automatización e Informática Industrial · Control Avanzado
            </span>
          </div>
        </div>

        <div className="header-center">
          <div className="sim-controls">
            <button
              onClick={handleStart}
              disabled={simRunning}
              className={`sim-btn start ${simRunning ? "disabled" : ""}`}
            >
              ▶ INICIAR
            </button>
            <button
              onClick={handleStop}
              disabled={!simRunning}
              className={`sim-btn stop ${!simRunning ? "disabled" : ""}`}
            >
              ⏸ DETENER
            </button>
            <button onClick={handleReset} className="sim-btn reset">
              ↺ REINICIAR
            </button>
          </div>
          <div className="sim-status-row">
            <div className={`sim-status-dot ${simRunning ? "running" : "stopped"}`} />
            <span className="sim-status-text">
              {simRunning ? "SIMULANDO" : "DETENIDO"}
            </span>
            {lastData && (
              <span className="sim-time">
                t = <strong>{lastData.t.toFixed(1)}</strong> min
              </span>
            )}
          </div>
        </div>

        <div className="header-right">
          <ThemeToggle />
          <div className={`ws-badge ${isConnected ? "connected" : "disconnected"}`}>
            <div className={`ws-dot ${isConnected ? "pulse" : ""}`} />
            {isConnected ? "ONLINE" : "OFFLINE"}
          </div>
          {engineStatus && (
            <div className="engine-badge-header">
              <span className="engine-badge-icon">⚙</span>
              <span>{engineStatus.active.toUpperCase()}</span>
            </div>
          )}
          {criticalAlarms > 0 && (
            <div className="alarm-badge-header critical blink-alarm">
              ⚠ {criticalAlarms} CRÍTICA{criticalAlarms > 1 ? "S" : ""}
            </div>
          )}
          {criticalAlarms === 0 && alarmCount > 0 && (
            <div className="alarm-badge-header warning">
              ● {alarmCount} ALARMA{alarmCount > 1 ? "S" : ""}
            </div>
          )}
        </div>
      </header>

      {/* ══ KPI BAR ═════════════════════════════════════════════ */}
      {lastData && (
        <div className="kpi-bar">
          <KPICard label="Punto Final Sup." tag="AT-101" value={lastData.y[0]} setpoint={lastData.u_setpoint[0]} variant="cv" />
          <KPICard label="Punto Final Lat." tag="AT-201" value={lastData.y[1]} setpoint={lastData.u_setpoint[1]} variant="cv" />
          <KPICard label="Temp. Superior"   tag="TT-301" value={lastData.y[2]} variant="cv" />
          <KPICard label="Temp. Refl. Fondo" tag="TT-701" value={lastData.y[6]} variant="cv" />
          <KPICard label="Ext. Superior"    tag="FCV-101" value={lastData.u[0]} variant="mv" />
          <KPICard label="Ext. Lateral"     tag="FCV-201" value={lastData.u[1]} variant="mv" />
          <KPICard label="Dem. Refl. Fondo" tag="FCV-301" value={lastData.u[2]} variant="mv" />
          <KPICard label="Dem. Refl. Int."  tag="FCV-D1"  value={lastData.d[0]} variant="dv" />
        </div>
      )}

      {/* ══ CONTENT ══════════════════════════════════════════════ */}
      <div className="scada-content">
        {/* LEFT SIDEBAR */}
        <aside className="scada-sidebar-left">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${sidebarTab === "control" ? "active" : ""}`}
              onClick={() => setSidebarTab("control")}
            >
              Control
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === "alarms" ? "active" : ""}`}
              onClick={() => setSidebarTab("alarms")}
            >
              Alarmas
              {alarmCount > 0 && (
                <span className="sidebar-tab-badge"
                  style={{ background: criticalAlarms > 0 ? "#ff2244" : "#ffaa00" }}>
                  {alarmCount}
                </span>
              )}
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === "engine" ? "active" : ""}`}
              onClick={() => setSidebarTab("engine")}
            >
              Motor
            </button>
          </div>
          <div className="sidebar-tab-content">
            {sidebarTab === "control"  && <OperatorPanel state={lastData} />}
            {sidebarTab === "alarms"   && <AlarmPanel alarms={lastData?.alarms ?? []} />}
            {sidebarTab === "engine"   && engineStatus && <EnginePanel engineStatus={engineStatus} />}
          </div>
        </aside>

        {/* MAIN */}
        <main className="scada-main">
          {/* View mode bar */}
          <div className="view-mode-bar">
            <button className={`view-btn ${viewMode === "split" ? "active" : ""}`} onClick={() => setViewMode("split")}>
              ⊞ P&ID + Tendencias
            </button>
            <button className={`view-btn ${viewMode === "pid" ? "active" : ""}`} onClick={() => setViewMode("pid")}>
              ◈ Solo P&ID
            </button>
            <button className={`view-btn ${viewMode === "trends" ? "active" : ""}`} onClick={() => setViewMode("trends")}>
              ≋ Solo Tendencias
            </button>
            <div className="view-mode-spacer" />
            {lastData && (
              <>
                <button
                  className="view-btn expand-btn"
                  title="Expandir P&ID a pantalla completa"
                  onClick={() => setPidFocus(true)}
                >
                  ⤢ Expandir P&ID
                </button>
                <button
                  className="view-btn expand-btn"
                  title="Expandir Tendencias a pantalla completa"
                  onClick={() => setTrendsFocus(true)}
                >
                  ⤢ Expandir Tendencias
                </button>
              </>
            )}
          </div>

          {/* P&ID panel */}
          {(viewMode === "split" || viewMode === "pid") && (
            <div
              className={`main-panel pid-panel ${viewMode === "pid" ? "full-height" : ""}`}
            >
              <div className="panel-header">
                <span className="panel-header-title">P&ID — Fraccionadora de Petróleo Pesado</span>
                <div className="panel-header-actions">
                  <span className="panel-header-tag">ISA-5.1 / IEC 60848</span>
                  {lastData && (
                    <button
                      className="panel-expand-btn"
                      title="Ver P&ID en pantalla completa"
                      onClick={() => setPidFocus(true)}
                    >
                      ⤢
                    </button>
                  )}
                </div>
              </div>
              {lastData ? (
                <div
                  className="pid-click-zone"
                  title="Click para expandir el P&ID"
                  onClick={() => setPidFocus(true)}
                >
                  <PIDDiagram state={lastData} />
                  <div className="pid-expand-hint">
                    <span>⤢ Click para expandir</span>
                  </div>
                </div>
              ) : (
                <div className="panel-placeholder">
                  <div className="placeholder-icon">⬡</div>
                  <span>Esperando datos del proceso...</span>
                  <p>Inicia la simulación para ver el P&ID en tiempo real</p>
                </div>
              )}
            </div>
          )}

          {/* Trends panel */}
          {(viewMode === "split" || viewMode === "trends") && (
            <div className={`main-panel trends-panel ${viewMode === "trends" ? "full-height" : ""}`}>
              <div className="panel-header">
                <span className="panel-header-title">Tendencias en Tiempo Real</span>
                <div className="panel-header-actions">
                  <span className="panel-header-tag">
                    {lastData ? `${lastData.history?.t.length ?? 0} muestras` : "Sin datos"}
                  </span>
                  {lastData && (
                    <button
                      className="panel-expand-btn"
                      title="Ver Tendencias en pantalla completa"
                      onClick={() => setTrendsFocus(true)}
                    >
                      ⤢
                    </button>
                  )}
                </div>
              </div>
              {lastData ? (
                <div
                  className="trends-click-zone"
                  title="Click para expandir las Tendencias"
                  onClick={() => setTrendsFocus(true)}
                >
                  <Trends state={lastData} />
                  <div className="trends-expand-hint">
                    <span>⤢ Click para expandir</span>
                  </div>
                </div>
              ) : (
                <div className="panel-placeholder">
                  <div className="placeholder-icon">≋</div>
                  <span>Sin historial disponible</span>
                  <p>Las gráficas aparecerán cuando comience la simulación</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════ */}
      <footer className="scada-footer">
        <span>SCADA Fraccionadora v1.0 · Shell Control Problem · Control Descentralizado SISO</span>
        <span>Universidad de Oriente (UDO) · Postgrado Automatización e Informática Industrial · Abril 2026</span>
        <span>Desarrollado por Ing. Rousemery Torres e Ing. Adrian Pinto</span>
        <span>
          {isConnected
            ? <span style={{ color: "#00ff88" }}>● WebSocket activo</span>
            : <span style={{ color: "#ff4444" }}>● Desconectado</span>
          }
        </span>
      </footer>

      {/* ══ PID FOCUS OVERLAY (modal pantalla completa) ═════════ */}
      {pidFocus && lastData && (
        <div className="pid-focus-overlay" onClick={() => setPidFocus(false)}>
          <div className="pid-focus-inner" onClick={(e) => e.stopPropagation()}>
            {/* Barra superior del overlay */}
            <div className="pid-focus-header">
              <div className="pid-focus-title">
                <span className="pid-focus-icon">◈</span>
                <span>P&ID — Fraccionadora de Petróleo Pesado</span>
                <span className="pid-focus-tag">ISA-5.1 / IEC 60848</span>
              </div>
              <div className="pid-focus-kpis">
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">AT-101</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#00d4ff" }}>
                    {lastData.y[0].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">AT-201</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#00d4ff" }}>
                    {lastData.y[1].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">u1</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#a78bfa" }}>
                    {lastData.u[0].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">u2</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#a78bfa" }}>
                    {lastData.u[1].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">u3</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#a78bfa" }}>
                    {lastData.u[2].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">t</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#00ff88" }}>
                    {lastData.t.toFixed(1)} min
                  </span>
                </div>
              </div>
              <button
                className="pid-focus-close"
                onClick={() => setPidFocus(false)}
                title="Cerrar (Esc)"
              >
                ✕ CERRAR
              </button>
            </div>

            {/* Diagrama a máximo tamaño */}
            <div className="pid-focus-body">
              <PIDDiagram state={lastData} />
            </div>

            {/* Hint inferior */}
            <div className="pid-focus-footer">
              <span>Presiona <kbd>Esc</kbd> o haz click fuera para cerrar</span>
            </div>
          </div>
        </div>
      )}

      {/* ══ TRENDS FOCUS OVERLAY (modal pantalla completa) ══════ */}
      {trendsFocus && lastData && (
        <div className="pid-focus-overlay" onClick={() => setTrendsFocus(false)}>
          <div className="pid-focus-inner" onClick={(e) => e.stopPropagation()}>
            {/* Barra superior del overlay */}
            <div className="pid-focus-header">
              <div className="pid-focus-title">
                <span className="pid-focus-icon">≋</span>
                <span>Tendencias en Tiempo Real — Fraccionadora de Petróleo Pesado</span>
                <span className="pid-focus-tag">{lastData.history?.t.length ?? 0} muestras</span>
              </div>
              <div className="pid-focus-kpis">
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">AT-101</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#00d4ff" }}>
                    {lastData.y[0].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">AT-201</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#00d4ff" }}>
                    {lastData.y[1].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">u1</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#a78bfa" }}>
                    {lastData.u[0].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">u2</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#a78bfa" }}>
                    {lastData.u[1].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">u3</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#a78bfa" }}>
                    {lastData.u[2].toFixed(4)}
                  </span>
                </div>
                <div className="pid-focus-kpi">
                  <span className="pid-focus-kpi-label">t</span>
                  <span className="pid-focus-kpi-val" style={{ color: "#00ff88" }}>
                    {lastData.t.toFixed(1)} min
                  </span>
                </div>
              </div>
              <button
                className="pid-focus-close"
                onClick={() => setTrendsFocus(false)}
                title="Cerrar (Esc)"
              >
                ✕ CERRAR
              </button>
            </div>

            {/* Tendencias a máximo tamaño */}
            <div className="pid-focus-body">
              <Trends state={lastData} />
            </div>

            {/* Hint inferior */}
            <div className="pid-focus-footer">
              <span>Presiona <kbd>Esc</kbd> o haz click fuera para cerrar</span>
            </div>
          </div>
        </div>
      )}

      {/* Cerrar foco con Escape */}
      {pidFocus && (
        <KeyboardListener onEscape={() => setPidFocus(false)} />
      )}
      {trendsFocus && (
        <KeyboardListener onEscape={() => setTrendsFocus(false)} />
      )}
    </div>
  );
}

/** Pequeño componente para escuchar Escape */
function KeyboardListener({ onEscape }: { onEscape: () => void }) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape]);
  return null;
}
