"""
Controlador MPC (Model Predictive Control) para la Fraccionadora.

Implementa control multivariable con:
  - Horizonte de predicción Np = 15 minutos
  - Horizonte de control Nc = 5 pasos
  - Seguimiento de setpoints en y1, y2 (OBJ-1)
  - Minimización de u3 como objetivo secundario (OBJ-2)
  - Rechazo de perturbaciones d1, d2 con feedforward (OBJ-3)
  - Restricciones hard en u (magnitud y rate limit)
  - Modo de fallo de analizador (si y1 o y2 no están disponibles)

Solucionador: CVXPY con problema QP convexo.
"""

import numpy as np
from typing import Dict, Optional, Tuple
import warnings
import logging

logger = logging.getLogger(__name__)

try:
    import cvxpy as cp
    _CVXPY_AVAILABLE = True
except ImportError:
    _CVXPY_AVAILABLE = False
    logger.warning("CVXPY no está instalado. Se usará controlador proporcional de respaldo.")


class MPCController:
    """
    Controlador MPC lineal multivariable para la Fraccionadora.
    """

    def __init__(
        self,
        Np: int = 15,  # Horizonte predicción
        Nc: int = 5,   # Horizonte control
        dt: float = 1.0,  # Tiempo muestreo
        Q_weight: float = 1.0,  # Peso seguimiento setpoints
        R_weight: float = 0.1,  # Peso movimiento MV
        rho_u3: float = 10.0,  # Peso minimización u3 (objetivo secundario)
        scaling_analyzer=None,  # ScalingAnalyzer para CondMin (opcional)
    ):
        """
        Inicializa controlador MPC.

        Args:
            Np: Horizonte de predicción [pasos]
            Nc: Horizonte de control [pasos]
            dt: Tiempo de muestreo [minutos]
            Q_weight: Peso en error de setpoint (OBJ-1)
            R_weight: Peso en movimiento de MVs (penaliza cambios)
            rho_u3: Peso en minimización de u3 (OBJ-2)
            scaling_analyzer: Instancia de ScalingAnalyzer para escalado (opcional)
        """
        self.Np = Np
        self.Nc = Nc
        self.dt = dt
        self.Q_weight = Q_weight
        self.R_weight = R_weight
        self.rho_u3 = rho_u3

        # Parámetros de restricción (RC-1 a RC-3)
        self.u_min = -0.5
        self.u_max = 0.5
        self.du_max = 0.05 * dt  # ±0.05 por minuto → ±0.05 por paso (dt=1)

        # Matriz de ganancia estática aproximada (para modo sin modelo dinámico)
        # En práctica, se usaría modelo dinámico completo del FOPDT
        self.K_static = None
        self.model = None

        # Escalado CondMin (opcional)
        self.scaling_analyzer = scaling_analyzer
        self.use_scaling = scaling_analyzer is not None and scaling_analyzer.is_computed

        # Cache de última solución
        self.last_u_pred = None
        self.last_objective = None
        self.last_solve_time = 0.0

        # Flags de fallo
        self.analyzer_faults = {
            "y1": False,
            "y2": False,
        }

    def set_model(self, fopdt_model):
        """
        Asigna modelo FOPDT para predicción (opcional).

        Aunque el MPC está implementado con ganancias estáticas,
        se puede usar el modelo FOPDT para predicción más precisa.

        Args:
            fopdt_model: Instancia de FOPDTModel
        """
        self.model = fopdt_model

    def set_analyzer_fault(self, analyzer: str, is_faulted: bool):
        """
        Simula fallo de analizador (OBJ-3).

        Si un analizador falla, el controlador continúa operando pero
        la entrada correspondiente se desactiva del seguimiento de setpoint.

        Args:
            analyzer: "y1" o "y2"
            is_faulted: True si está fallido
        """
        if analyzer in self.analyzer_faults:
            self.analyzer_faults[analyzer] = is_faulted

    def compute_control(
        self,
        y_current: np.ndarray,
        y_setpoint: np.ndarray,
        u_previous: np.ndarray,
        d_measured: np.ndarray,
        K_real: np.ndarray,
    ) -> Dict:
        """
        Calcula la acción de control óptima.

        Intenta usar MPC con CVXPY si está disponible.
        Si CVXPY no está disponible o el solver falla, usa controlador
        proporcional con feedforward como respaldo.
        """
        if _CVXPY_AVAILABLE:
            try:
                result = self.compute_control_mpc_original(
                    y_current, y_setpoint, u_previous, d_measured, K_real
                )
                if result["feasible"]:
                    return result
                logger.warning("MPC infeasible, usando controlador proporcional de respaldo")
            except Exception as e:
                logger.error(f"MPC error: {e}, usando controlador proporcional de respaldo")

        return self._proportional_fallback(y_current, y_setpoint, u_previous, d_measured)

    def _proportional_fallback(
        self,
        y_current: np.ndarray,
        y_setpoint: np.ndarray,
        u_previous: np.ndarray,
        d_measured: np.ndarray,
    ) -> Dict:
        """Controlador proporcional con feedforward — respaldo cuando MPC falla."""
        try:
            error_y1 = y_setpoint[0] - y_current[0]
            error_y2 = y_setpoint[1] - y_current[1]

            Kp1 = 0.3
            Kp2 = 0.3
            Kp3 = 0.1

            u_optimal = np.zeros(3)
            u_optimal[0] = Kp1 * error_y1
            u_optimal[1] = Kp2 * error_y2
            u_optimal[2] = -Kp3 * (d_measured[0] + d_measured[1])
            u_optimal = np.clip(u_optimal, -0.5, 0.5)

            return {
                "u_optimal": u_optimal,
                "u_delta": u_optimal - u_previous,
                "y_predicted": y_current,
                "cost": float(np.sum(np.abs(y_setpoint[:2] - y_current[:2]))),
                "feasible": True,
                "status": "ok (proportional fallback)",
            }
        except Exception as e:
            logger.error(f"Proportional fallback error: {e}")
            return {
                "u_optimal": np.zeros(3),
                "u_delta": np.zeros(3),
                "y_predicted": y_current,
                "cost": np.inf,
                "feasible": False,
                "status": f"Error: {e}",
            }

    def compute_control_mpc_original(
        self,
        y_current: np.ndarray,
        y_setpoint: np.ndarray,
        u_previous: np.ndarray,
        d_measured: np.ndarray,
        K_real: np.ndarray,
    ) -> Dict:
        """
        Calcula la acción de control óptima usando MPC.

        Problema QP convexo:
          min  Σₖ { Q ||y_pred[k] - y_sp||² + R ||Δu[k]||² + ρ_u3 * u3[k] }
          s.t.  y_pred[k+1] = K_real @ u[k] + K_real[:,3:] @ d[k]  (modelo estático)
                u_min ≤ u[k] ≤ u_max
                |u[k] - u[k-1]| ≤ du_max
                dy7/y7 ≥ -0.5 (soft con slack)
                Si y1 falla: no penalizar error en y1

        Con escalado CondMin (si use_scaling=True):
          Las variables se transforman al espacio escalado:
            u_esc = R_inv @ u, y_esc = L @ y para G0 (y1,y2,y7)
          El QP se resuelve en espacio escalado con K_esc = L @ K_g0 @ R
          Las restricciones se transforman apropiadamente
          La solución se transforma de vuelta al espacio físico

        Args:
            y_current: Vector [y1, ..., y7] actual
            y_setpoint: Vector setpoint [y1_sp, y2_sp, 0, 0, ..., 0]
            u_previous: Vector [u1, u2, u3] del paso anterior
            d_measured: Vector [d1, d2] actual (perturbaciones medidas)
            K_real: Matriz 7×5 de ganancias reales con incertidumbre

        Returns:
            result: Diccionario con:
              - 'u_optimal': Vector [u1, u2, u3] óptimo
              - 'u_delta': Cambios incrementales Δu
              - 'y_predicted': Predicción de salida
              - 'cost': Valor del objetivo
              - 'feasible': bool (problema resoluble)
              - 'status': str (resultado del solucionador)
        """
        # ====== Transformación al espacio escalado (si aplica) ======
        u_prev_working = u_previous.copy()
        y_sp_working = y_setpoint.copy()
        K_working = K_real.copy()
        u_lim_min = self.u_min
        u_lim_max = self.u_max
        du_lim = self.du_max

        use_scaling_local = False
        if self.use_scaling:
            use_scaling_local = True
            R_mv = self.scaling_analyzer.R          # (3×3)
            R_inv = self.scaling_analyzer.R_inv     # (3×3)
            L_mv = self.scaling_analyzer.L          # (3×3)

            # Transformar MVs al espacio escalado
            u_prev_working = R_inv @ u_previous     # (3,)

            # Setpoints para G0: solo y1, y2, y7
            y_sp_g0 = np.array([y_setpoint[0], y_setpoint[1], y_setpoint[6]])
            y_sp_g0_esc = L_mv @ y_sp_g0
            # Reconstruir setpoint completo (otros CVs en 0)
            y_sp_working = y_setpoint.copy()
            y_sp_working[0] = y_sp_g0_esc[0]
            y_sp_working[1] = y_sp_g0_esc[1]
            y_sp_working[6] = y_sp_g0_esc[2]

            # K escalada para submatriz G0
            K_g0 = K_real[np.ix_([0,1,6], [0,1,2])]  # (3×3)
            K_g0_esc = L_mv @ K_g0 @ R_mv             # (3×3)
            # Reconstruir K escalada completa (filas 0,1,6 y columnas 0,1,2)
            K_working = K_real.copy()
            K_working[np.ix_([0,1,6], [0,1,2])] = K_g0_esc

            # Límites transformados
            u_lim_min_vec = np.array([self.u_min, self.u_min, self.u_min])
            u_lim_max_vec = np.array([self.u_max, self.u_max, self.u_max])
            du_lim_vec = np.array([self.du_max, self.du_max, self.du_max])
            u_lim_min = (R_inv @ u_lim_min_vec).min()  # Conservador
            u_lim_max = (R_inv @ u_lim_max_vec).max()  # Conservador
            du_lim = (R_inv @ du_lim_vec).max()        # Conservador

        # Variables de decisión CVXPY
        # Δu_delta[k] para k=0..Nc-1 (cambios incrementales)
        # y_pred[k] para k=1..Np (predicciones)

        delta_u = cp.Variable((self.Nc, 3))  # Cambios en MVs
        y_pred = cp.Variable((self.Np, 7))   # Predicciones de salida

        # Reconstruye u absoluto a partir de cambios incrementales
        # u[0] = u_prev + du[0], u[1] = u[0] + du[1], etc.
        u_abs = []
        u_curr = u_prev_working.copy()  # Usa versión potencialmente escalada
        for k in range(self.Nc):
            u_curr = u_curr + delta_u[k]
            u_abs.append(u_curr)

        # Apalanca para acceder a variables en listas
        # Convierte a arrays para álgebra matricial
        u_abs_array = cp.hstack([u.reshape(1, -1) for u in u_abs])  # Nc × 3

        # Restricciones
        constraints = []

        # RC-1, RC-2: Límites de magnitud en MVs
        for k in range(self.Nc):
            for i in range(3):
                constraints.append(u_abs[k][i] >= u_lim_min)
                constraints.append(u_abs[k][i] <= u_lim_max)

        # RC-3: Rate limiting en Δu
        for k in range(self.Nc):
            for i in range(3):
                constraints.append(delta_u[k, i] >= -du_lim)
                constraints.append(delta_u[k, i] <= du_lim)

        # Predicción de salidas
        # Modelo lineal simplificado: y_pred[k] = K_real @ u_actual + K_real[:, 3:] @ d
        # (Aproxima dinámica como ganancia estática; modelo FOPDT completo iría aquí)
        for k in range(self.Nc):
            # Entrada manipulada en horizonte k
            u_k = u_abs[k]
            # Predicción: y = K @ [u1, u2, u3, d1, d2]
            inputs_k = cp.hstack([u_k, d_measured])  # 5 entradas
            y_k_pred = K_working @ inputs_k
            constraints.append(y_pred[k] == y_k_pred)

        # Para pasos k > Nc, asume u constante en u_abs[Nc-1]
        u_final = u_abs[self.Nc - 1]
        for k in range(self.Nc, self.Np):
            inputs_final = cp.hstack([u_final, d_measured])
            y_final = K_working @ inputs_final
            constraints.append(y_pred[k] == y_final)

        # RC-6: y1 ∈ [-0.5, 0.5] (soft constraint con slack variable)
        # Para simplificar, implementamos como hard constraint
        for k in range(self.Np):
            if not self.analyzer_faults.get("y1", False):
                constraints.append(y_pred[k, 0] >= -0.5)
                constraints.append(y_pred[k, 0] <= 0.5)

        # RC-5: y7 ≥ -0.5 (soft con slack)
        # Por ahora, constraint hard
        slack_y7 = cp.Variable(self.Np, nonneg=True)
        for k in range(self.Np):
            constraints.append(y_pred[k, 6] >= -0.5 - slack_y7[k])

        # Función objetivo
        # Término 1: Seguimiento de setpoints en y1, y2
        error_tracking = 0.0
        for k in range(self.Np):
            if not self.analyzer_faults.get("y1", False):
                error_tracking += self.Q_weight * cp.sum_squares(y_pred[k, 0] - y_sp_working[0])
            if not self.analyzer_faults.get("y2", False):
                error_tracking += self.Q_weight * cp.sum_squares(y_pred[k, 1] - y_sp_working[1])

        # Término 2: Penalización de cambios en MVs (suavidad)
        energy_term = 0.0
        for k in range(self.Nc):
            energy_term += self.R_weight * cp.sum_squares(delta_u[k])

        # Término 3: Minimización de u3 (objetivo secundario, OBJ-2)
        # Minimizar consumo de demanda de reflujo → maximizar generación de vapor
        u3_minimize = 0.0
        for k in range(self.Nc):
            u3_minimize += self.rho_u3 * u_abs[k][2]  # u3 = MV índice 2

        # Penalización por violación de RC-5 (soft)
        rc5_penalty = 1e3 * cp.sum(slack_y7)

        objective = cp.Minimize(error_tracking + energy_term + u3_minimize + rc5_penalty)

        # Construye y resuelve problema
        problem = cp.Problem(objective, constraints)

        try:
            problem.solve(solver=cp.ECOS, verbose=False, max_iters=100)
        except Exception as e:
            warnings.warn(f"MPC solver error: {e}. Retornando u=0.")
            return {
                "u_optimal": np.zeros(3),
                "u_delta": np.zeros(3),
                "y_predicted": y_current.copy(),
                "cost": np.inf,
                "feasible": False,
                "status": f"Solver error: {e}",
            }

        # Extrae solución
        if problem.status not in ["optimal", "optimal_inaccurate"]:
            warnings.warn(f"MPC problema no óptimo: {problem.status}")
            return {
                "u_optimal": np.zeros(3),
                "u_delta": np.zeros(3),
                "y_predicted": y_current.copy(),
                "cost": np.inf,
                "feasible": False,
                "status": problem.status,
            }

        # Retorna u óptimo del paso k=0
        u_optimal = u_abs[0].value if hasattr(u_abs[0], 'value') else np.array(u_abs[0])
        u_delta = delta_u[0].value if hasattr(delta_u[0], 'value') else np.array(delta_u[0])
        y_pred_step = y_pred[0].value if hasattr(y_pred[0], 'value') else np.array(y_pred[0])

        # Transformar de vuelta al espacio físico si se usó escalado
        if use_scaling_local:
            u_optimal = self.scaling_analyzer.R @ u_optimal  # Transforma MVs
            u_delta = self.scaling_analyzer.R @ u_delta      # Transforma cambios
            # y_pred_step contiene y escaladas en posiciones 0, 1, 6
            # Transformar de vuelta usando L_inv
            y_esc = np.array(y_pred_step)
            y_esc[[0,1,6]] = self.scaling_analyzer.L_inv @ y_esc[[0,1,6]]
            y_pred_step = y_esc

        return {
            "u_optimal": np.array(u_optimal).flatten(),
            "u_delta": np.array(u_delta).flatten(),
            "y_predicted": np.array(y_pred_step).flatten(),
            "cost": problem.value,
            "feasible": True,
            "status": problem.status,
        }

    def set_weights(
        self,
        Q_weight: Optional[float] = None,
        R_weight: Optional[float] = None,
        rho_u3: Optional[float] = None,
    ):
        """Actualiza pesos de la función objetivo."""
        if Q_weight is not None:
            self.Q_weight = Q_weight
        if R_weight is not None:
            self.R_weight = R_weight
        if rho_u3 is not None:
            self.rho_u3 = rho_u3

    def get_horizons(self) -> Dict:
        """Retorna información de horizontes."""
        return {
            "Np": self.Np,
            "Nc": self.Nc,
            "dt": self.dt,
            "total_time_prediction": self.Np * self.dt,
            "total_time_control": self.Nc * self.dt,
        }
