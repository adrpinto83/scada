import React, { useState } from "react";
import type { Alarm } from "../types";

interface Props {
  alarms: Alarm[];
}

export default function AlarmPanel({ alarms }: Props) {
  const [filter, setFilter] = useState<"all" | "HH" | "H" | "L" | "LL">("all");
  const [acked, setAcked] = useState<Set<number>>(new Set());

  const severityColor = (s: string) =>
    ({ HH: "#ff2244", H: "#ff6600", L: "#ffaa00", LL: "#00cc66" }[s] ?? "#666");

  const severityLabel = (s: string) =>
    ({ HH: "CRÍTICA", H: "ALTA", L: "MEDIA", LL: "BAJA" }[s] ?? s);

  const counts = {
    HH: alarms.filter((a) => a.severity === "HH").length,
    H: alarms.filter((a) => a.severity === "H").length,
    L: alarms.filter((a) => a.severity === "L").length,
    LL: alarms.filter((a) => a.severity === "LL").length,
  };

  const filtered =
    filter === "all" ? alarms : alarms.filter((a) => a.severity === filter);

  const recent = [...filtered].reverse().slice(0, 20);

  const handleAck = (idx: number) => {
    setAcked((prev) => new Set([...prev, idx]));
  };

  const handleAckAll = () => {
    setAcked(new Set(alarms.map((_, i) => i)));
  };

  const unackCount = alarms.length - acked.size;

  return (
    <div className="alarm-panel-modern">
      {/* Resumen por nivel */}
      <div className="alarm-summary-row">
        {(["HH", "H", "L", "LL"] as const).map((sev) => (
          <button
            key={sev}
            className={`alarm-summary-chip ${filter === sev ? "active" : ""}`}
            style={{
              borderColor: severityColor(sev),
              color: filter === sev ? "#0a0e1a" : severityColor(sev),
              background: filter === sev ? severityColor(sev) : `${severityColor(sev)}18`,
            }}
            onClick={() => setFilter(filter === sev ? "all" : sev)}
          >
            <span className="alarm-chip-sev">{sev}</span>
            <span className="alarm-chip-count"
              style={{ background: filter === sev ? "rgba(0,0,0,0.2)" : severityColor(sev) }}>
              {counts[sev]}
            </span>
          </button>
        ))}
        <button
          className={`alarm-summary-chip ${filter === "all" ? "active all" : ""}`}
          onClick={() => setFilter("all")}
        >
          <span className="alarm-chip-sev">TODAS</span>
          <span className="alarm-chip-count total">{alarms.length}</span>
        </button>
      </div>

      {/* Barra de acciones */}
      {unackCount > 0 && (
        <div className="alarm-action-bar">
          <span className="alarm-unack-count">
            {unackCount} sin reconocer
          </span>
          <button className="alarm-ack-all-btn" onClick={handleAckAll}>
            ACK TODAS
          </button>
        </div>
      )}

      {/* Lista de alarmas */}
      <div className="alarm-list-modern">
        {recent.length === 0 ? (
          <div className="alarm-empty">
            <span className="alarm-empty-icon">✓</span>
            <span>Sin alarmas activas</span>
          </div>
        ) : (
          recent.map((alarm, idx) => {
            const globalIdx = alarms.length - 1 - idx;
            const isAcked = acked.has(globalIdx) || alarm.acknowledged;
            const isHH = alarm.severity === "HH";

            return (
              <div
                key={idx}
                className={`alarm-item-modern ${isAcked ? "acked" : "active"} ${isHH && !isAcked ? "blink-alarm" : ""}`}
                style={{ borderLeftColor: severityColor(alarm.severity) }}
              >
                <div className="alarm-item-header">
                  <span
                    className="alarm-sev-badge"
                    style={{
                      background: severityColor(alarm.severity),
                      boxShadow: !isAcked ? `0 0 8px ${severityColor(alarm.severity)}` : "none",
                    }}
                  >
                    {alarm.severity}
                  </span>
                  <span className="alarm-title">{alarm.title}</span>
                  <span className="alarm-time">
                    {new Date(alarm.timestamp).toLocaleTimeString("es-VE", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <div className="alarm-msg">{alarm.message}</div>
                <div className="alarm-item-footer">
                  <span className="alarm-sev-label" style={{ color: severityColor(alarm.severity) }}>
                    {severityLabel(alarm.severity)}
                  </span>
                  {isAcked ? (
                    <span className="alarm-acked-badge">✓ ACK</span>
                  ) : (
                    <button
                      className="alarm-ack-btn"
                      onClick={() => handleAck(globalIdx)}
                    >
                      ACK
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer con totales */}
      {alarms.length > 0 && (
        <div className="alarm-footer-stats">
          <span>Total: {alarms.length}</span>
          <span style={{ color: "#ff2244" }}>HH: {counts.HH}</span>
          <span style={{ color: "#ff6600" }}>H: {counts.H}</span>
          <span style={{ color: "#ffaa00" }}>L: {counts.L}</span>
          <span style={{ color: "#00cc66" }}>LL: {counts.LL}</span>
        </div>
      )}
    </div>
  );
}
