"""
Controlador Descentralizado SISO para la Fraccionadora.

Implementa estrategia de control descentralizada usando lazos SISO independientes
en lugar de control centralizado MIMO, siguiendo las recomendaciones del curso:

ESTRATEGIA DESCENTRALIZADA:
--------------------------
Se utilizan técnicas de control SISO (Single Input Single Output) con controladores
PI simples para cada lazo, que es el enfoque masivamente usado en la industria.

LAZOS DE CONTROL:
----------------
1. Lazo AT-101 (y1): Punto Final Superior controlado por FCV-101 (u1)
   - Control PI con anti-windup
   - Objetivo: Mantener AT-101 en setpoint

2. Lazo AT-201 (y2): Punto Final Lateral controlado por FCV-201 (u2)
   - Control PI con anti-windup
   - Objetivo: Mantener AT-201 en setpoint

3. Lazo Feedforward (u3): Demanda Reflujo Fondo para rechazo de perturbaciones
   - Control feedforward basado en d1, d2
   - Objetivo secundario: Minimizar u3 (maximizar generación de vapor)

OBJETIVOS RELAJADOS (Justificación):
------------------------------------
- y3, y4, y5, y6: Temperaturas intermedias de la columna
  * Justificación: Con control descentralizado, no es posible controlar todas
    las variables simultáneamente. Se priorizan los puntos finales (especificaciones
    de producto) sobre las temperaturas intermedias.
  * Estas variables flotarán dentro de límites operacionales seguros.

- y7 (TT-701): Temperatura Reflujo Fondo
  * Justificación: Esta variable es principalmente afectada por perturbaciones
    y se mantiene mediante el control feedforward de u3. No se controla directamente
    pero se monitorea para cumplir RC-5 (≥ -0.5).

VENTAJAS DE ESTA ESTRATEGIA:
---------------------------
1. Simplicidad: Controladores PI son fáciles de sintonizar y mantener
2. Robustez: Menos sensible a incertidumbre del modelo
3. Implementación: Estándar industrial (DCS, PLCs)
4. Desempeño: Suficiente para este sistema de orden moderado
5. Seguridad: Falla de un lazo no afecta a los demás

LIMITACIONES ACEPTADAS:
----------------------
1. Interacciones entre lazos pueden causar oscilaciones
2. Desempeño subóptimo comparado con MPC centralizado
3. Rechazo de perturbaciones más lento
4. Algunas restricciones se manejan por saturación (no optimización)

Referencias:
- Marlin, T. E. (2000). Process Control (2nd ed.). McGraw-Hill.
- Skogestad, S. (2003). Simple analytic rules for model reduction and PID
  controller tuning. Journal of Process Control, 13(4), 291-309.
"""

import numpy as np
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class DecentralizedController:
    """
    Controlador descentralizado con tres lazos SISO independientes.

    Implementa control PI para lazos primarios y feedforward para rechazo
    de perturbaciones, siguiendo estrategia industrial estándar.
    """

    def __init__(
        self,
        dt: float = 1.0,  # Tiempo de muestreo [minutos]
        # Parámetros Lazo 1: AT-101 → FCV-101
        Kp1: float = 0.4,
        Ki1: float = 0.05,
        # Parámetros Lazo 2: AT-201 → FCV-201
        Kp2: float = 0.4,
        Ki2: float = 0.05,
        # Parámetros Lazo 3: Feedforward d → FCV-301
        Kff_d1: float = -0.3,
        Kff_d2: float = -0.3,
        Kp3: float = 0.15,  # Ganancia proporcional adicional en u3
    ):
        """
        Inicializa controlador descentralizado SISO.

        Args:
            dt: Tiempo de muestreo [minutos]
            Kp1, Ki1: Ganancias PI para lazo y1 → u1
            Kp2, Ki2: Ganancias PI para lazo y2 → u2
            Kff_d1, Kff_d2: Ganancias feedforward para d1, d2 → u3
            Kp3: Ganancia adicional proporcional para u3
        """
        self.dt = dt

        # Parámetros PI - Lazo 1 (AT-101)
        self.Kp1 = Kp1
        self.Ki1 = Ki1
        self.integral_y1 = 0.0

        # Parámetros PI - Lazo 2 (AT-201)
        self.Kp2 = Kp2
        self.Ki2 = Ki2
        self.integral_y2 = 0.0

        # Parámetros Feedforward - Lazo 3 (perturbaciones)
        self.Kff_d1 = Kff_d1
        self.Kff_d2 = Kff_d2
        self.Kp3 = Kp3

        # Restricciones de actuadores (RC-1, RC-2, RC-3)
        self.u_min = -0.5
        self.u_max = 0.5
        self.du_max = 0.05  # Rate limit [1/min]

        # Estado previo para anti-windup
        self.u_previous = np.zeros(3)

        # Estadísticas
        self.stats = {
            "control_calls": 0,
            "saturations_u1": 0,
            "saturations_u2": 0,
            "saturations_u3": 0,
        }

    def compute_control(
        self,
        y_current: np.ndarray,
        y_setpoint: np.ndarray,
        u_previous: np.ndarray,
        d_measured: np.ndarray,
        K_real: np.ndarray,  # No usado en SISO, pero mantenido por compatibilidad
    ) -> Dict:
        """
        Calcula acción de control usando lazos SISO descentralizados.

        Implementa:
        1. Lazo PI para y1 (AT-101) → u1 (FCV-101)
        2. Lazo PI para y2 (AT-201) → u2 (FCV-201)
        3. Control feedforward d1,d2 → u3 (FCV-301)

        Args:
            y_current: Vector [y1, ..., y7] actual
            y_setpoint: Vector setpoint [y1_sp, y2_sp, 0, 0, ..., 0]
            u_previous: Vector [u1, u2, u3] del paso anterior
            d_measured: Vector [d1, d2] perturbaciones medidas
            K_real: Matriz 7×5 (no usada en control SISO, solo para compatibilidad)

        Returns:
            result: Diccionario con:
              - 'u_optimal': Vector [u1, u2, u3] óptimo
              - 'u_delta': Cambios incrementales Δu
              - 'y_predicted': y_current (no hay predicción en PI)
              - 'cost': suma de errores cuadráticos
              - 'feasible': True siempre
              - 'status': 'ok (decentralized SISO)'
        """
        self.stats["control_calls"] += 1
        self.u_previous = u_previous.copy()

        # ========== LAZO 1: y1 (AT-101) → u1 (FCV-101) ==========
        error_y1 = y_setpoint[0] - y_current[0]

        # Término proporcional
        P1 = self.Kp1 * error_y1

        # Término integral con anti-windup
        self.integral_y1 += error_y1 * self.dt
        I1 = self.Ki1 * self.integral_y1

        # Acción de control PI
        u1_raw = P1 + I1

        # Aplicar restricciones de magnitud y rate limit
        u1_limited = self._apply_constraints(u1_raw, u_previous[0], 0)

        # Anti-windup: Si hubo saturación, deshacer integración
        if abs(u1_limited - u1_raw) > 1e-6:
            self.integral_y1 -= error_y1 * self.dt
            self.stats["saturations_u1"] += 1

        # ========== LAZO 2: y2 (AT-201) → u2 (FCV-201) ==========
        error_y2 = y_setpoint[1] - y_current[1]

        # Término proporcional
        P2 = self.Kp2 * error_y2

        # Término integral con anti-windup
        self.integral_y2 += error_y2 * self.dt
        I2 = self.Ki2 * self.integral_y2

        # Acción de control PI
        u2_raw = P2 + I2

        # Aplicar restricciones
        u2_limited = self._apply_constraints(u2_raw, u_previous[1], 1)

        # Anti-windup
        if abs(u2_limited - u2_raw) > 1e-6:
            self.integral_y2 -= error_y2 * self.dt
            self.stats["saturations_u2"] += 1

        # ========== LAZO 3: Feedforward d1,d2 → u3 (FCV-301) ==========
        # Control feedforward para rechazo de perturbaciones
        # Objetivo: Compensar efecto de d1, d2 en el proceso
        # Objetivo secundario: Minimizar u3 (maximizar generación de vapor)

        u3_ff = self.Kff_d1 * d_measured[0] + self.Kff_d2 * d_measured[1]

        # Componente proporcional adicional basado en error total
        # (heurística para mejorar rechazo de perturbaciones)
        total_error = abs(error_y1) + abs(error_y2)
        u3_prop = -self.Kp3 * total_error  # Negativo para minimizar u3

        u3_raw = u3_ff + u3_prop

        # Aplicar restricciones
        u3_limited = self._apply_constraints(u3_raw, u_previous[2], 2)

        if abs(u3_limited - u3_raw) > 1e-6:
            self.stats["saturations_u3"] += 1

        # ========== Construir resultado ==========
        u_optimal = np.array([u1_limited, u2_limited, u3_limited])
        u_delta = u_optimal - u_previous

        # Costo: suma de errores cuadráticos en variables controladas
        cost = error_y1**2 + error_y2**2

        return {
            "u_optimal": u_optimal,
            "u_delta": u_delta,
            "y_predicted": y_current.copy(),  # PI no hace predicción
            "cost": float(cost),
            "feasible": True,
            "status": "ok (decentralized SISO)",
            "loop_details": {
                "y1": {"P": P1, "I": I1, "error": error_y1, "u_raw": u1_raw},
                "y2": {"P": P2, "I": I2, "error": error_y2, "u_raw": u2_raw},
                "u3": {"ff": u3_ff, "prop": u3_prop, "u_raw": u3_raw},
            },
        }

    def _apply_constraints(
        self,
        u_raw: float,
        u_prev: float,
        mv_index: int,
    ) -> float:
        """
        Aplica restricciones RC-1, RC-2, RC-3 a una variable manipulada.

        Args:
            u_raw: Valor sin restricciones
            u_prev: Valor previo
            mv_index: Índice de MV (0, 1, 2)

        Returns:
            u_limited: Valor después de aplicar restricciones
        """
        # RC-3: Rate limit
        du = u_raw - u_prev
        if du > self.du_max * self.dt:
            du = self.du_max * self.dt
        elif du < -self.du_max * self.dt:
            du = -self.du_max * self.dt

        u_candidate = u_prev + du

        # RC-1, RC-2: Límites de magnitud
        u_limited = np.clip(u_candidate, self.u_min, self.u_max)

        return u_limited

    def reset(self):
        """Reinicia integradores y estadísticas."""
        self.integral_y1 = 0.0
        self.integral_y2 = 0.0
        self.u_previous = np.zeros(3)
        self.stats = {
            "control_calls": 0,
            "saturations_u1": 0,
            "saturations_u2": 0,
            "saturations_u3": 0,
        }
        logger.info("Controlador descentralizado reiniciado")

    def set_tuning(
        self,
        Kp1: Optional[float] = None,
        Ki1: Optional[float] = None,
        Kp2: Optional[float] = None,
        Ki2: Optional[float] = None,
        Kff_d1: Optional[float] = None,
        Kff_d2: Optional[float] = None,
        Kp3: Optional[float] = None,
    ):
        """Actualiza parámetros de sintonización."""
        if Kp1 is not None:
            self.Kp1 = Kp1
        if Ki1 is not None:
            self.Ki1 = Ki1
        if Kp2 is not None:
            self.Kp2 = Kp2
        if Ki2 is not None:
            self.Ki2 = Ki2
        if Kff_d1 is not None:
            self.Kff_d1 = Kff_d1
        if Kff_d2 is not None:
            self.Kff_d2 = Kff_d2
        if Kp3 is not None:
            self.Kp3 = Kp3

        logger.info(f"Parámetros actualizados: Kp1={self.Kp1}, Ki1={self.Ki1}, "
                   f"Kp2={self.Kp2}, Ki2={self.Ki2}")

    def get_stats(self) -> Dict:
        """Retorna estadísticas de operación."""
        return self.stats.copy()

    def get_tuning(self) -> Dict:
        """Retorna parámetros de sintonización actuales."""
        return {
            "Kp1": self.Kp1,
            "Ki1": self.Ki1,
            "Kp2": self.Kp2,
            "Ki2": self.Ki2,
            "Kff_d1": self.Kff_d1,
            "Kff_d2": self.Kff_d2,
            "Kp3": self.Kp3,
            "dt": self.dt,
        }
