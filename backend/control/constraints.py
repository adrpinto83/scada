"""
Gestión de restricciones de control (RC-1 a RC-6) para la Fraccionadora.

Restricciones de control (hard constraints):
  RC-1: Extracciones u1, u2 ∈ [-0.5, +0.5]
  RC-2: Demanda Reflujo Fondo u3 ∈ [-0.5, +0.5]
  RC-3: Rate limit en todas las MV: Δu_i ≤ ±0.05 por minuto
  RC-4: Tiempo de muestreo mínimo: Δt = 1 minuto
  RC-5: Temperatura Reflujo Fondo y7 ≥ -0.5 (soft constraint)
  RC-6: Punto Final Superior y1 ∈ [-0.5, +0.5] (soft constraint)

Implementación:
  - Saturación: clamp de valores fuera de rango
  - Rate limiting: comparación con valor anterior, clamp de Δu
  - Alarmas: flags para violación de restricciones
"""

import numpy as np
from typing import Dict, List, Tuple, Optional


class ConstraintChecker:
    """
    Verifica y aplica todas las restricciones RC-1 a RC-6.

    Mantiene historial mínimo para detección de rate limit.
    """

    # Límites de restricción
    MV_BOUNDS = 0.5  # ±0.5 para u1, u2, u3
    RATE_LIMIT = 0.05  # ±0.05 por minuto (Δt=1 min → ±0.05 por paso)
    DT = 1.0  # Tiempo de muestreo [minutos]
    TEMP_REFLUX_BOTTOM_MIN = -0.5  # RC-5: y7 ≥ -0.5
    POINT_FINAL_TOP_BOUNDS = 0.5  # RC-6: y1 ∈ [-0.5, +0.5]

    def __init__(self):
        """Inicializa el verificador de restricciones."""
        self.u_prev = np.zeros(3)
        self.violation_flags = {
            "u1_bounds": False,
            "u2_bounds": False,
            "u3_bounds": False,
            "rate_limit_u1": False,
            "rate_limit_u2": False,
            "rate_limit_u3": False,
            "y7_lower": False,  # y7 < -0.5
            "y1_bounds": False,
        }
        self.num_violations = 0

    def saturate_mv(self, u: np.ndarray) -> Tuple[np.ndarray, List[str]]:
        """
        Aplica saturación de magnitud en todas las MVs (RC-1, RC-2).

        Args:
            u: Vector [u1, u2, u3]

        Returns:
            (u_saturated, violations): Vector saturado y lista de violaciones detectadas
        """
        u_sat = np.clip(u, -self.MV_BOUNDS, self.MV_BOUNDS)
        violations = []

        for i in range(3):
            if u[i] != u_sat[i]:
                violations.append(f"u{i+1}_bounds")

        return u_sat, violations

    def apply_rate_limit(self, u: np.ndarray) -> Tuple[np.ndarray, List[str]]:
        """
        Aplica limitador de velocidad en todas las MVs (RC-3).

        Algoritmo:
          1. Calcula Δu = u - u_prev
          2. Si |Δu_i| > rate_limit, clampea a ±rate_limit
          3. Actualiza u_prev
          4. Retorna (u limitada, lista de violaciones)

        Args:
            u: Vector [u1, u2, u3] (debe estar pre-saturado en magnitud)

        Returns:
            (u_rate_limited, violations): Vector limitado y flags de violación
        """
        u_limited = u.copy()
        violations = []

        for i in range(3):
            du = u[i] - self.u_prev[i]
            if abs(du) > self.RATE_LIMIT:
                # Clampea cambio incremental
                du_limited = np.clip(du, -self.RATE_LIMIT, self.RATE_LIMIT)
                u_limited[i] = self.u_prev[i] + du_limited
                violations.append(f"rate_limit_u{i+1}")

        self.u_prev = u_limited.copy()
        return u_limited, violations

    def check_output_constraints(self, y: np.ndarray) -> Dict[str, bool]:
        """
        Verifica restricciones en salidas (RC-5, RC-6).

        Estas son soft constraints (información para alarmas, no saturación).

        Args:
            y: Vector [y1, ..., y7]

        Returns:
            flags: Diccionario de violaciones en salidas
        """
        flags = {
            "y7_lower": y[6] < self.TEMP_REFLUX_BOTTOM_MIN,  # y7 ≥ -0.5
            "y1_bounds": np.abs(y[0]) > self.POINT_FINAL_TOP_BOUNDS,  # |y1| ≤ 0.5
        }
        return flags

    def check_constraints(
        self,
        u: np.ndarray,
        y: np.ndarray
    ) -> Dict:
        """
        Verifica todas las restricciones (RC-1 a RC-6) e integra.

        Workflow:
          1. Saturación de magnitud (RC-1, RC-2)
          2. Rate limiting (RC-3)
          3. Chequeo de salidas (RC-5, RC-6)

        Args:
            u: Vector [u1, u2, u3] propuesto sin limitar
            y: Vector [y1, ..., y7] actual

        Returns:
            result: Diccionario con:
              - 'u_saturated': MVs después de saturación
              - 'u_limited': MVs después de rate limit (valor final aplicable)
              - 'violations': Diccionario de todos los flags
              - 'is_feasible': bool (sin violaciones hard)
        """
        # Paso 1: Saturación de magnitud
        u_sat, sat_violations = self.saturate_mv(u)

        # Paso 2: Rate limiting
        u_limited, rate_violations = self.apply_rate_limit(u_sat)

        # Paso 3: Chequeo de salidas (soft)
        y_violations = self.check_output_constraints(y)

        # Integra todos los flags
        all_violations = {
            "u1_bounds": "u1_bounds" in sat_violations,
            "u2_bounds": "u2_bounds" in sat_violations,
            "u3_bounds": "u3_bounds" in sat_violations,
            "rate_limit_u1": "rate_limit_u1" in rate_violations,
            "rate_limit_u2": "rate_limit_u2" in rate_violations,
            "rate_limit_u3": "rate_limit_u3" in rate_violations,
            **y_violations,
        }

        # Cuenta violaciones hard (sat + rate limit)
        hard_violations = [k for k, v in all_violations.items()
                           if v and any(x in k for x in ["u", "rate_limit"])]

        return {
            "u_saturated": u_sat,
            "u_limited": u_limited,
            "u_actual": u_limited,  # Alias: el que realmente se aplica
            "violations": all_violations,
            "num_violations": len(hard_violations),
            "is_feasible": len(hard_violations) == 0,
            "y_violations": y_violations,
        }

    def reset(self):
        """Reinicia el historial del verificador."""
        self.u_prev = np.zeros(3)
        self.violation_flags = {k: False for k in self.violation_flags}
        self.num_violations = 0


class ConstraintFormatter:
    """Formatea información de restricciones para visualización."""

    @staticmethod
    def format_bounds() -> Dict:
        """Retorna información de límites para gráficas."""
        return {
            "u1": {"min": -0.5, "max": 0.5, "label": "Extracción Superior"},
            "u2": {"min": -0.5, "max": 0.5, "label": "Extracción Lateral"},
            "u3": {"min": -0.5, "max": 0.5, "label": "Demanda Reflujo Fondo"},
            "y1": {"min": -0.5, "max": 0.5, "label": "Punto Final Superior"},
            "y7": {"min": -0.5, "max": None, "label": "Temp. Reflujo Fondo (mín)"},
        }

    @staticmethod
    def format_violations(violations: Dict) -> List[str]:
        """Convierte diccionario de violaciones en lista legible."""
        messages = []
        if violations.get("u1_bounds"):
            messages.append("RC-1: u1 fuera de límites")
        if violations.get("u2_bounds"):
            messages.append("RC-1: u2 fuera de límites")
        if violations.get("u3_bounds"):
            messages.append("RC-2: u3 fuera de límites")
        if violations.get("rate_limit_u1"):
            messages.append("RC-3: u1 rate limit excedido")
        if violations.get("rate_limit_u2"):
            messages.append("RC-3: u2 rate limit excedido")
        if violations.get("rate_limit_u3"):
            messages.append("RC-3: u3 rate limit excedido")
        if violations.get("y7_lower"):
            messages.append("RC-5: y7 por debajo del mínimo (-0.5)")
        if violations.get("y1_bounds"):
            messages.append("RC-6: y1 fuera de límites")
        return messages
