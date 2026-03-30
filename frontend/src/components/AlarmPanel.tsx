import React, { useState } from "react";
import type { Alarm } from "../types";

interface Props {
  alarms: Alarm[];
}

/**
 * Panel de alarmas.
 *
 * Muestra lista de alarmas con prioridad (HH, H, L, LL).
 * Las más recientes aparecen primero.
 */
export default function AlarmPanel({ alarms }: Props) {
  const [filter, setFilter] = useState<"all" | "HH" | "H" | "L" | "LL">("all");

  const severityColor = (severity: string) => {
    switch (severity) {
      case "HH":
        return "#ff0000"; // Rojo
      case "H":
        return "#ff6600"; // Naranja
      case "L":
        return "#ffcc00"; // Amarillo
      case "LL":
        return "#00cc00"; // Verde
      default:
        return "#cccccc";
    }
  };

  const severityLabel = (severity: string) => {
    switch (severity) {
      case "HH":
        return "CRÍTICA";
      case "H":
        return "ALTA";
      case "L":
        return "MEDIA";
      case "LL":
        return "BAJA";
      default:
        return severity;
    }
  };

  const filteredAlarms =
    filter === "all" ? alarms : alarms.filter((a) => a.severity === filter);

  const recentAlarms = filteredAlarms.slice(-15).reverse(); // Últimas 15, más recientes primero

  return (
    <div className="alarm-panel">
      {/* Filtros */}
      <div className="alarm-filters">
        {["all", "HH", "H", "L", "LL"].map((sev) => (
          <button
            key={sev}
            className={`filter-btn ${filter === sev ? "active" : ""}`}
            onClick={() => setFilter(sev as any)}
            style={sev !== "all" ? { backgroundColor: severityColor(sev) } : {}}
          >
            {sev === "all" ? "Todas" : severityLabel(sev)}
          </button>
        ))}
      </div>

      {/* Lista de alarmas */}
      <div className="alarm-list">
        {recentAlarms.length === 0 ? (
          <div className="no-alarms">✓ Sin alarmas</div>
        ) : (
          recentAlarms.map((alarm, idx) => (
            <div
              key={idx}
              className={`alarm-item ${alarm.acknowledged ? "acknowledged" : "active"}`}
              style={{
                borderLeftColor: severityColor(alarm.severity),
              }}
            >
              <div className="alarm-header">
                <span className="severity-badge" style={{ backgroundColor: severityColor(alarm.severity) }}>
                  {severityLabel(alarm.severity)}
                </span>
                <span className="title">{alarm.title}</span>
              </div>
              <div className="alarm-message">{alarm.message}</div>
              <div className="alarm-footer">
                <span className="timestamp">{new Date(alarm.timestamp).toLocaleTimeString()}</span>
                {alarm.acknowledged && <span className="ack-badge">✓ ACK</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resumen */}
      {alarms.length > 0 && (
        <div className="alarm-summary">
          Total: {alarms.length} | HH: {alarms.filter((a) => a.severity === "HH").length} | H:{" "}
          {alarms.filter((a) => a.severity === "H").length}
        </div>
      )}
    </div>
  );
}
