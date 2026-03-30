"""
Protocolo base para motores de cálculo dual (Python/Octave).

Define la interfaz compartida que ambos motores deben implementar,
permitiendo intercambio en tiempo de ejecución sin cambios de código.
"""

from typing import Protocol, Dict, Optional
import numpy as np


class CalcEngine(Protocol):
    """
    Protocolo para motor de cálculo dual.

    Ambos PythonEngine y OctaveEngine deben implementar esta interfaz.
    """

    @property
    def engine_name(self) -> str:
        """Retorna nombre del motor: 'python' | 'octave'"""
        ...

    @property
    def is_available(self) -> bool:
        """Retorna si el motor está disponible (ejecutable encontrado, etc)"""
        ...

    def simulate_step(
        self,
        state: Dict,
        u: np.ndarray,
        d: np.ndarray,
        dt: float = 1.0,
    ) -> Dict:
        """
        Simula un paso Δt del modelo FOPDT.

        Args:
            state: Estado anterior del modelo (para preservar dinámicas)
            u: Vector [u1, u2, u3] entradas manipuladas
            d: Vector [d1, d2] perturbaciones medidas
            dt: Tiempo de muestreo [minutos]

        Returns:
            result: Diccionario con:
              - 'y': array de salidas [y1, ..., y7]
              - 'status': 'ok' | 'error'
              - 'msg': mensaje (vacío si 'ok')
        """
        ...

    def compute_control(
        self,
        y_current: np.ndarray,
        y_setpoint: np.ndarray,
        u_previous: np.ndarray,
        d_measured: np.ndarray,
        K_real: np.ndarray,
        constraints: Dict,
    ) -> Dict:
        """
        Calcula acción de control MPC.

        Args:
            y_current: Salidas actuales [y1, ..., y7]
            y_setpoint: Setpoints [y1_sp, y2_sp, 0, ...]
            u_previous: Entradas anteriores [u1, u2, u3]
            d_measured: Perturbaciones [d1, d2]
            K_real: Matriz 7×5 de ganancias reales
            constraints: Dict de parámetros de restricción

        Returns:
            result: Diccionario con:
              - 'u_optimal': vector [u1, u2, u3]
              - 'status': 'ok' | 'error'
              - 'msg': mensaje de error
              - 'cost': valor de objetivo (si aplica)
        """
        ...

    def check_constraints(
        self,
        u_proposed: np.ndarray,
        u_previous: np.ndarray,
        y_current: np.ndarray,
    ) -> Dict:
        """
        Verifica y aplica restricciones RC-1 a RC-6.

        Args:
            u_proposed: MV propuesto
            u_previous: MV anterior
            y_current: Salidas actuales

        Returns:
            result: Diccionario con:
              - 'u_limited': MV después de restricciones
              - 'violations': flags de violación
              - 'status': 'ok' | 'error'
              - 'msg': mensaje
        """
        ...

    def compute_bandwidth(
        self,
        tau_matrix: np.ndarray,
        Np: int = 15,
        Nc: int = 5,
        dt: float = 1.0,
    ) -> Dict:
        """
        Calcula ancho de banda (BW_OL, BW_CL) para OBJ-4.

        Args:
            tau_matrix: Matriz 7×5 de constantes de tiempo
            Np: Horizonte de predicción MPC
            Nc: Horizonte de control MPC
            dt: Tiempo de muestreo

        Returns:
            result: Diccionario con:
              - 'bw_ol': ancho de banda lazo abierto
              - 'bw_cl': ancho de banda lazo cerrado
              - 'ratio': BW_CL / BW_OL
              - 'compliant': bool (cumple 0.8 ≤ ratio ≤ 1.25)
              - 'status': 'ok' | 'error'
              - 'msg': mensaje
        """
        ...

    def apply_uncertainty(
        self,
        K_nominal: np.ndarray,
        delta_K: np.ndarray,
        epsilons: np.ndarray,
    ) -> Dict:
        """
        Aplica incertidumbre paramétrica.

        K_real = K_nominal + delta_K * epsilons

        Args:
            K_nominal: Matriz 7×5 de ganancias nominales
            delta_K: Matriz 7×5 de incertidumbre (ΔK)
            epsilons: Vector [ε1, ..., ε5] en [-1, 1]

        Returns:
            result: Diccionario con:
              - 'K_real': matriz 7×5 con incertidumbre aplicada
              - 'status': 'ok' | 'error'
              - 'msg': mensaje
        """
        ...
