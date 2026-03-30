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
from control.constraints import ConstraintChecker
from analysis.bandwidth import BandwidthAnalyzer


class PythonEngine:
    """
    Motor de cálculo Python basado en numpy/scipy/cvxpy.

    Implementa todas las funciones del protocolo CalcEngine.
    """

    def __init__(self):
        """Inicializa el motor Python."""
        self._name = "python"
        self._available = True

        # Instancia los componentes
        self.fopdt_model = FOPDTModel(dt=1.0)
        self.uncertainty_manager = UncertaintyManager()
        self.mpc_controller = MPCController(Np=15, Nc=5, dt=1.0)
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

            # Llama al controlador MPC
            result = self.mpc_controller.compute_control(
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
