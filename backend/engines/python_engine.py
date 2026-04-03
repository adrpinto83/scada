"""
Motor de cálculo Python — implementación nativa con numpy/scipy/cvxpy.

Delega a los módulos de simulación, control y análisis implementados.
"""

import numpy as np
from typing import Dict, Optional
import time

from simulation.fopdt_model import FOPDTModel
from simulation.uncertainty import UncertaintyManager
from simulation.process_matrix import K_MATRIX, TAU_MATRIX, THETA_MATRIX, DELTA_K_MATRIX
from control.controller import MPCController
from control.decentralized_controller import DecentralizedController
from control.constraints import ConstraintChecker
from analysis.bandwidth import BandwidthAnalyzer
from analysis.scaling import cond_min


class PythonEngine:
    """
    Motor de cálculo Python basado en numpy/scipy/cvxpy.

    Implementa todas las funciones del protocolo CalcEngine.
    """

    def __init__(self, controller_type: str = "decentralized"):
        """
        Inicializa el motor Python.

        Args:
            controller_type: Tipo de controlador ('mpc' | 'decentralized')
        """
        self._name = "python"
        self._available = True

        # Instancia los componentes
        self.fopdt_model = FOPDTModel(dt=1.0)
        self.uncertainty_manager = UncertaintyManager()

        # Ambos controladores disponibles
        self.mpc_controller = MPCController(Np=15, Nc=5, dt=1.0)
        self.decentralized_controller = DecentralizedController(dt=1.0)

        # Controlador activo (por defecto: descentralizado SISO)
        self.controller_type = controller_type
        self._active_controller = (
            self.decentralized_controller
            if controller_type == "decentralized"
            else self.mpc_controller
        )

        self.constraint_checker = ConstraintChecker()
        self.bandwidth_analyzer = BandwidthAnalyzer(dt=1.0)

    @property
    def engine_name(self) -> str:
        """Retorna nombre del motor."""
        return self._name

    @property
    def is_available(self) -> bool:
        """Retorna disponibilidad del motor (siempre True para Python)."""
        return self._available

    def simulate_step(
        self,
        state: Dict,
        u: np.ndarray,
        d: np.ndarray,
        dt: float = 1.0,
    ) -> Dict:
        """
        Simula un paso del modelo FOPDT.

        Args:
            state: Estado anterior del modelo
            u: Vector [u1, u2, u3]
            d: Vector [d1, d2]
            dt: Tiempo de muestreo

        Returns:
            result: Diccionario con 'y', 'status', 'msg'
        """
        try:
            # Restaura estado si se proporciona
            if state and "model_state" in state:
                self.fopdt_model.set_state(state["model_state"])

            # Asegura shapes correctos
            u = np.array(u, dtype=np.float64).flatten()
            d = np.array(d, dtype=np.float64).flatten()

            # Simula paso
            y = self.fopdt_model.step(u, d)

            return {
                "y": y.tolist(),
                "status": "ok",
                "msg": "",
            }
        except Exception as e:
            return {
                "y": None,
                "status": "error",
                "msg": str(e),
            }

    def compute_control(
        self,
        y_current: np.ndarray,
        y_setpoint: np.ndarray,
        u_previous: np.ndarray,
        d_measured: np.ndarray,
        K_real: np.ndarray,
        constraints: Dict = None,
    ) -> Dict:
        """
        Calcula acción de control MPC.

        Args:
            y_current: Salidas actuales
            y_setpoint: Setpoints
            u_previous: Entradas anteriores
            d_measured: Perturbaciones medidas
            K_real: Matriz de ganancias reales
            constraints: Dict con parámetros (opcional)

        Returns:
            result: Diccionario con 'u_optimal', 'cost', 'status', 'msg'
        """
        try:
            y_current = np.array(y_current, dtype=np.float64).flatten()
            y_setpoint = np.array(y_setpoint, dtype=np.float64).flatten()
            u_previous = np.array(u_previous, dtype=np.float64).flatten()
            d_measured = np.array(d_measured, dtype=np.float64).flatten()
            K_real = np.array(K_real, dtype=np.float64)

            # Llama al controlador activo (MPC o Descentralizado)
            result = self._active_controller.compute_control(
                y_current,
                y_setpoint,
                u_previous,
                d_measured,
                K_real,
            )

            return {
                "u_optimal": result["u_optimal"].tolist(),
                "cost": float(result["cost"]) if result["cost"] is not None else None,
                "feasible": result["feasible"],
                "status": "ok" if result["feasible"] else "infeasible",
                "msg": result.get("status", ""),
            }
        except Exception as e:
            return {
                "u_optimal": None,
                "cost": None,
                "feasible": False,
                "status": "error",
                "msg": str(e),
            }

    def check_constraints(
        self,
        u_proposed: np.ndarray,
        u_previous: np.ndarray,
        y_current: np.ndarray,
    ) -> Dict:
        """
        Verifica y aplica restricciones.

        Args:
            u_proposed: MV propuesto
            u_previous: MV anterior
            y_current: Salidas actuales

        Returns:
            result: Diccionario con 'u_limited', 'violations', 'status', 'msg'
        """
        try:
            u_proposed = np.array(u_proposed, dtype=np.float64).flatten()
            u_previous = np.array(u_previous, dtype=np.float64).flatten()
            y_current = np.array(y_current, dtype=np.float64).flatten()

            # Chequea restricciones
            result = self.constraint_checker.check_constraints(u_proposed, y_current)

            return {
                "u_limited": result["u_limited"].tolist(),
                "violations": result["violations"],
                "status": "ok",
                "msg": "",
            }
        except Exception as e:
            return {
                "u_limited": None,
                "violations": None,
                "status": "error",
                "msg": str(e),
            }

    def compute_bandwidth(
        self,
        tau_matrix: np.ndarray,
        Np: int = 15,
        Nc: int = 5,
        dt: float = 1.0,
    ) -> Dict:
        """
        Calcula ancho de banda (OBJ-4).

        Args:
            tau_matrix: Matriz 7×5 de constantes de tiempo
            Np: Horizonte de predicción
            Nc: Horizonte de control
            dt: Tiempo de muestreo

        Returns:
            result: Diccionario con 'bw_ol', 'bw_cl', 'ratio', 'compliant', 'status', 'msg'
        """
        try:
            tau_matrix = np.array(tau_matrix, dtype=np.float64)

            # Calcula ancho de banda
            result = self.bandwidth_analyzer.evaluate_bandwidth_compliance(
                tau_matrix, Np, Nc, dt
            )

            return {
                **result,
                "status": "ok",
                "msg": "",
            }
        except Exception as e:
            return {
                "bw_ol": None,
                "bw_cl": None,
                "ratio": None,
                "compliant": False,
                "status": "error",
                "msg": str(e),
            }

    def apply_uncertainty(
        self,
        K_nominal: np.ndarray,
        delta_K: np.ndarray,
        epsilons: np.ndarray,
    ) -> Dict:
        """
        Aplica incertidumbre paramétrica.

        Args:
            K_nominal: Matriz 7×5 nominal
            delta_K: Matriz 7×5 de incertidumbre
            epsilons: Vector [ε1, ..., ε5]

        Returns:
            result: Diccionario con 'K_real', 'status', 'msg'
        """
        try:
            K_nominal = np.array(K_nominal, dtype=np.float64)
            delta_K = np.array(delta_K, dtype=np.float64)
            epsilons = np.array(epsilons, dtype=np.float64).flatten()

            # Valida epsilons
            if not np.all(np.abs(epsilons) <= 1.0):
                raise ValueError("Todos los ε deben estar en [-1.0, 1.0]")

            # Aplica incertidumbre
            K_real = K_nominal + delta_K * epsilons[np.newaxis, :]

            return {
                "K_real": K_real.tolist(),
                "status": "ok",
                "msg": "",
            }
        except Exception as e:
            return {
                "K_real": None,
                "status": "error",
                "msg": str(e),
            }

    def set_uncertainties(self, epsilons: np.ndarray):
        """Actualiza incertidumbres en el modelo y controlador."""
        self.uncertainty_manager.set_epsilons(epsilons)
        self.fopdt_model.set_uncertainties(epsilons)

    def reset(self):
        """Reinicia todos los componentes."""
        self.fopdt_model.reset()
        self.constraint_checker.reset()
        self.uncertainty_manager.reset()
        if hasattr(self.decentralized_controller, 'reset'):
            self.decentralized_controller.reset()

    def switch_controller(self, controller_type: str) -> Dict:
        """
        Cambia entre controlador MPC centralizado y SISO descentralizado.

        Args:
            controller_type: 'mpc' | 'decentralized'

        Returns:
            result: Diccionario con estado del cambio
        """
        if controller_type not in ["mpc", "decentralized"]:
            return {
                "success": False,
                "active": self.controller_type,
                "message": f"Tipo de controlador inválido: {controller_type}. "
                          "Opciones: 'mpc' o 'decentralized'",
            }

        if controller_type == self.controller_type:
            return {
                "success": True,
                "active": self.controller_type,
                "message": f"Controlador ya activo: {controller_type}",
            }

        # Cambia el controlador
        self.controller_type = controller_type
        self._active_controller = (
            self.decentralized_controller
            if controller_type == "decentralized"
            else self.mpc_controller
        )

        # Reinicia el nuevo controlador activo
        if hasattr(self._active_controller, 'reset'):
            self._active_controller.reset()

        return {
            "success": True,
            "active": self.controller_type,
            "message": f"Controlador cambiado a {controller_type} correctamente",
        }

    def get_controller_info(self) -> Dict:
        """Retorna información del controlador activo."""
        info = {
            "type": self.controller_type,
            "name": ("Control Descentralizado SISO"
                    if self.controller_type == "decentralized"
                    else "Control Centralizado MPC"),
        }

        if self.controller_type == "decentralized":
            info.update({
                "description": "Tres lazos SISO independientes (PI + Feedforward)",
                "loops": {
                    "loop1": "y1 (AT-101) → u1 (FCV-101) [PI]",
                    "loop2": "y2 (AT-201) → u2 (FCV-201) [PI]",
                    "loop3": "d1,d2 → u3 (FCV-301) [Feedforward]",
                },
                "tuning": self.decentralized_controller.get_tuning(),
                "stats": self.decentralized_controller.get_stats(),
            })
        else:
            info.update({
                "description": "MPC multivariable 7CV×3MV con horizonte Np/Nc",
                "horizons": self.mpc_controller.get_horizons(),
            })

        return info

    def compute_scaling(self, G0: np.ndarray) -> Dict:
        """
        Calcula escalado óptimo CondMin vía Python/scipy.

        Minimiza cond(L @ G0 @ R) con L, R diagonales.

        Args:
            G0: Submatriz 3×3 (y1, y2, y7 × u1, u2, u3)

        Returns:
            Dict con:
                - status: 'ok' o 'error'
                - sv_original, sv_scaled: valores singulares
                - kappa_original, kappa_scaled: números de condición
                - L_diag, R_diag: factores de escalado
                - engine: 'python'
        """
        try:
            L, R, kappa_min, info = cond_min(G0)
            return {
                **info,
                "status": "ok",
                "msg": "",
                "engine": "python",
            }
        except Exception as e:
            return {
                "status": "error",
                "msg": str(e),
                "engine": "python",
            }
