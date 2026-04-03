import type { ConditioningInfo } from "../types";

interface Props {
  conditioning?: ConditioningInfo | null;
  octaveData?: any | null;
}

export default function ConditioningPanel({ conditioning, octaveData }: Props) {
  if (!conditioning || !conditioning.computed) {
    return (
      <div className="cond-panel">
        <div className="cond-placeholder">
          <span className="cond-placeholder-icon">○</span>
          <span className="cond-placeholder-text">Análisis de condicionamiento no disponible</span>
        </div>
      </div>
    );
  }

  const improvement = ((conditioning.kappa_original - conditioning.kappa_scaled) / conditioning.kappa_original * 100).toFixed(1);
  const octaveImprovement = octaveData && octaveData.kappa_original
    ? ((octaveData.kappa_original - octaveData.kappa_scaled) / octaveData.kappa_original * 100).toFixed(1)
    : null;

  return (
    <div className="cond-panel">
      {/* ── Encabezado ── */}
      <div className="cond-header">
        <div className="cond-title">
          <span className="cond-icon">◈</span>
          Análisis de Condicionamiento SVD
        </div>
        <div className="cond-status">
          <span className="cond-status-badge" style={{
            backgroundColor: conditioning.kappa_scaled < 10 ? "rgba(16,185,129,0.2)" :
                           conditioning.kappa_scaled < 15 ? "rgba(245,158,11,0.2)" :
                           "rgba(239,68,68,0.2)",
            color: conditioning.kappa_scaled < 10 ? "#10b981" :
                   conditioning.kappa_scaled < 15 ? "#f59e0b" :
                   "#ef4444"
          }}>
            κ = {conditioning.kappa_scaled.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ── Tabla SVD ── */}
      <div className="cond-section">
        <h4 className="cond-section-title">Valores Singulares (G₀: 3×3)</h4>
        <table className="cond-svd-table">
          <thead>
            <tr>
              <th>σ</th>
              <th>Original</th>
              <th>Escalado</th>
              <th>Cambio</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => {
              const orig = conditioning.sv_original[i] || 0;
              const scaled = conditioning.sv_scaled[i] || 0;
              const change = ((scaled - orig) / orig * 100).toFixed(1);
              return (
                <tr key={i}>
                  <td className="cond-sv-label">σ{i + 1}</td>
                  <td className="cond-sv-value">{orig.toFixed(4)}</td>
                  <td className="cond-sv-value">{scaled.toFixed(4)}</td>
                  <td className={`cond-sv-change ${parseFloat(change) > 0 ? 'positive' : 'negative'}`}>
                    {parseFloat(change) > 0 ? '+' : ''}{change}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Números de Condición ── */}
      <div className="cond-section">
        <h4 className="cond-section-title">Número de Condición (κ = σ₁/σ₃)</h4>

        {/* Python Engine */}
        <div className="cond-engine-row">
          <div className="cond-engine-label">
            <span className="cond-engine-badge python">Python</span>
            SLSQP
          </div>
          <div className="cond-kappa-comparison">
            <div className="cond-kappa-item original">
              <div className="cond-kappa-label">Original</div>
              <div className="cond-kappa-value">{conditioning.kappa_original.toFixed(3)}</div>
            </div>
            <div className="cond-kappa-arrow">→</div>
            <div className="cond-kappa-item scaled">
              <div className="cond-kappa-label">Escalado</div>
              <div className="cond-kappa-value">{conditioning.kappa_scaled.toFixed(3)}</div>
            </div>
            <div className="cond-kappa-improvement">
              <span className="cond-improvement-label">Mejora</span>
              <span className="cond-improvement-value">{improvement}%</span>
            </div>
          </div>
        </div>

        {/* Octave Engine (si disponible) */}
        {octaveData && octaveData.kappa_original && (
          <div className="cond-engine-row">
            <div className="cond-engine-label">
              <span className="cond-engine-badge octave">Octave</span>
              SQP
            </div>
            <div className="cond-kappa-comparison">
              <div className="cond-kappa-item original">
                <div className="cond-kappa-label">Original</div>
                <div className="cond-kappa-value">{octaveData.kappa_original.toFixed(3)}</div>
              </div>
              <div className="cond-kappa-arrow">→</div>
              <div className="cond-kappa-item scaled">
                <div className="cond-kappa-label">Escalado</div>
                <div className="cond-kappa-value">{octaveData.kappa_scaled.toFixed(3)}</div>
              </div>
              <div className="cond-kappa-improvement">
                <span className="cond-improvement-label">Mejora</span>
                <span className="cond-improvement-value">{octaveImprovement}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Concordancia */}
        {octaveData && octaveData.kappa_original && (
          <div className="cond-concordance">
            <span className="cond-conc-label">Diferencia Python ↔ Octave:</span>
            <span className="cond-conc-value">
              {Math.abs(conditioning.kappa_scaled - octaveData.kappa_scaled).toFixed(3)}
              <span className="cond-conc-pct">
                ({(Math.abs(conditioning.kappa_scaled - octaveData.kappa_scaled) / conditioning.kappa_scaled * 100).toFixed(2)}%)
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Matrices de Escalado ── */}
      <div className="cond-section">
        <h4 className="cond-section-title">Matrices de Escalado Diagonal (L, R)</h4>
        <div className="cond-matrices-row">
          <div className="cond-matrix-group">
            <div className="cond-matrix-label">L = diag(l₁, l₂, l₃)</div>
            <div className="cond-matrix-values">
              {conditioning.L_diag.map((l, i) => (
                <div key={`l${i}`} className="cond-matrix-item">
                  <span className="cond-matrix-idx">l{i + 1}</span>
                  <span className="cond-matrix-val">{l.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="cond-matrix-group">
            <div className="cond-matrix-label">R = diag(r₁, r₂, r₃)</div>
            <div className="cond-matrix-values">
              {conditioning.R_diag.map((r, i) => (
                <div key={`r${i}`} className="cond-matrix-item">
                  <span className="cond-matrix-idx">r{i + 1}</span>
                  <span className="cond-matrix-val">{r.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Interpretación ── */}
      <div className="cond-section cond-interpretation">
        <h4 className="cond-section-title">Interpretación</h4>
        <div className="cond-interp-text">
          {conditioning.kappa_scaled < 10 ? (
            <>
              <span className="cond-interp-good">✓ Excelente condicionamiento</span>
              <p>El número de condición κ &lt; 10 garantiza buena estabilidad numérica en el solucionador QP.</p>
            </>
          ) : conditioning.kappa_scaled < 15 ? (
            <>
              <span className="cond-interp-fair">⚠ Condicionamiento aceptable</span>
              <p>El número de condición κ ∈ [10, 15) es razonablemente estable pero podría mejorar.</p>
            </>
          ) : (
            <>
              <span className="cond-interp-poor">✗ Condicionamiento pobre</span>
              <p>El número de condición κ ≥ 15 puede causar inestabilidad numérica.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
