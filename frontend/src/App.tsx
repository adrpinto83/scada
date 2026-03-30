import React, { useState } from "react";
import "./App.css";
import { useWebSocket } from "./hooks/useWebSocket";
import { useEngineStatus } from "./hooks/useEngineStatus";
import type { ProcessState } from "./types";

import PIDDiagram from "./components/PIDDiagram";
import Trends from "./components/Trends";
import OperatorPanel from "./components/OperatorPanel";
import AlarmPanel from "./components/AlarmPanel";
import EnginePanel from "./components/EnginePanel";

/**
 * Componente principal de la aplicación SCADA.
 *
 * Layout:
 *   - Encabezado con estado del motor
 *   - Área principal: P&ID + Gráficas
 *   - Panel lateral: Control + Alarmas + Motor
 */
export default function App() {
  const [simRunning, setSimRunning] = useState(false);
  const { isConnected, lastData } = useWebSocket();
  const { engineStatus } = useEngineStatus();

  const handleStartSimulation = async () => {
    try {
      const response = await fetch("/api/simulation/start", { method: "POST" });
      if (response.ok) {
        setSimRunning(true);
      }
    } catch (e) {
      console.error("Error starting simulation:", e);
    }
  };

  const handleStopSimulation = async () => {
    try {
      const response = await fetch("/api/simulation/stop", { method: "POST" });
      if (response.ok) {
        setSimRunning(false);
      }
    } catch (e) {
      console.error("Error stopping simulation:", e);
    }
  };

  const handleResetSimulation = async () => {
    try {
      const response = await fetch("/api/simulation/reset", { method: "POST" });
      if (response.ok) {
        setSimRunning(false);
      }
    } catch (e) {
      console.error("Error resetting simulation:", e);
    }
  };

  return (
    <div className="app-container">
      {/* Encabezado */}
      <header className="app-header">
        <h1>SCADA Fraccionadora — Shell Control Problem</h1>
        <div className="header-status">
          <span
            className={`websocket-indicator ${
              isConnected ? "connected" : "disconnected"
            }`}
          >
            {isConnected ? "● Conectado" : "● Desconectado"}
          </span>
          {engineStatus && (
            <span className="engine-badge">
              Motor: <strong>{engineStatus.active.toUpperCase()}</strong>
            </span>
          )}
        </div>
      </header>

      <div className="app-content">
        {/* Área principal: P&ID + Gráficas */}
        <div className="main-area">
          <div className="pid-section">
            <h2>P&ID — Fraccionadora</h2>
            {lastData && <PIDDiagram state={lastData} />}
          </div>

          <div className="trends-section">
            <h2>Tendencias en Tiempo Real</h2>
            {lastData && <Trends state={lastData} />}
          </div>
        </div>

        {/* Panel lateral */}
        <aside className="sidebar">
          {/* Controles de simulación */}
          <div className="control-buttons">
            <button
              onClick={handleStartSimulation}
              disabled={simRunning}
              className="btn btn-start"
            >
              ▶ Iniciar
            </button>
            <button
              onClick={handleStopSimulation}
              disabled={!simRunning}
              className="btn btn-stop"
            >
              ⏸ Detener
            </button>
            <button onClick={handleResetSimulation} className="btn btn-reset">
              ↺ Reiniciar
            </button>
          </div>

          {/* Panel Operador */}
          <div className="panel-section">
            <h3>Panel Operador</h3>
            <OperatorPanel state={lastData} />
          </div>

          {/* Panel Motor */}
          <div className="panel-section">
            <h3>Motor de Cálculo</h3>
            {engineStatus && <EnginePanel engineStatus={engineStatus} />}
          </div>

          {/* Panel Alarmas */}
          <div className="panel-section alarms-section">
            <h3>Alarmas</h3>
            {lastData && <AlarmPanel alarms={lastData.alarms} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
