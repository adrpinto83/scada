"""
Análisis de ancho de banda (OBJ-4) para la Fraccionadora.

Objetivo OBJ-4: Mantener la velocidad de respuesta en lazo cerrado
entre 0.8 y 1.25 del ancho de banda del proceso en lazo abierto (BW_OL).

Ancho de banda de lazo abierto:
  BW_OL = 1 / τ_dominante  [rad/min]

Donde τ_dominante es la constante de tiempo máxima (más lenta) del proceso.

Este módulo calcula:
  - BW_OL individual para cada canal activo
  - BW_OL global (máximo entre canales)
  - BW_CL estimado a partir de los horizontes MPC
  - Evaluación del ratio BW_CL / BW_OL (debe estar en [0.8, 1.25])
"""

import numpy as np
from typing import Dict, Optional, Tuple


class BandwidthAnalyzer:
    """
    Calcula y valida ancho de banda de lazo cerrado vs. lazo abierto.
    """

    # Rango objetivo (OBJ-4)
    RATIO_MIN = 0.8
    RATIO_MAX = 1.25

    def __init__(self, dt: float = 1.0):
        """
        Inicializa analizador de ancho de banda.

        Args:
            dt: Tiempo de muestreo [minutos]
        """
        self.dt = dt
        self.bw_ol_global = None
        self.bw_cl_estimated = None

    def compute_bw_ol_channel(self, tau: float) -> float:
        """
        Calcula ancho de banda de lazo abierto para un canal individual.

        Para sistema FOPDT:
          τ → constante de tiempo
          BW_OL = 1 / τ  [1/minutos]

        Args:
            tau: Constante de tiempo [minutos]

        Returns:
            BW_OL: Ancho de banda [1/minutos]
        """
        if tau <= 0:
            return np.inf
        return 1.0 / tau

    def compute_bw_ol_global(self, tau_matrix: np.ndarray, active_outputs: Optional[np.ndarray] = None) -> float:
        """
        Calcula ancho de banda de lazo abierto global de la planta.

        Usa el τ máximo (más lento) de los canales activos.

        BW_OL_global = 1 / τ_max

        Args:
            tau_matrix: Matriz 7×5 de constantes de tiempo
            active_outputs: Máscara booleana [y1_active, ..., y7_active].
                           Si es None, considera todos activos.

        Returns:
            BW_OL_global: Ancho de banda global [1/minutos]
        """
        if active_outputs is None:
            active_outputs = np.ones(7, dtype=bool)

        # Extrae τ de los canales activos (todas las entradas)
        tau_active = tau_matrix[active_outputs, :].flatten()
        tau_max = np.max(tau_active[tau_active > 0])

        bw_ol = self.compute_bw_ol_channel(tau_max)
        self.bw_ol_global = bw_ol
        return bw_ol

    def compute_bw_cl_from_mpc(self, Np: int, Nc: int, dt: float) -> float:
        """
        Estima ancho de banda de lazo cerrado a partir de horizontes MPC.

        Aproximación simplificada:
          BW_CL ≈ 1 / (α * Nc * dt)

        donde α ≈ 1-3 (empíricamente, α=2 es típico).

        Notas:
          - Nc = horizonte de control [pasos]
          - dt = tiempo de muestreo [minutos]
          - BW_CL ~ inverso del tiempo de respuesta en lazo cerrado

        Args:
            Np: Horizonte de predicción [pasos]
            Nc: Horizonte de control [pasos]
            dt: Tiempo de muestreo [minutos]

        Returns:
            BW_CL: Ancho de banda estimado [1/minutos]
        """
        # BW_CL ≈ 1 / (settling_time)
        # settling_time ~ Nc * dt (tiempo en el que el controlador actúa)
        alpha = 2.0  # Parámetro empírico
        settling_time = alpha * Nc * dt
        bw_cl = 1.0 / settling_time

        self.bw_cl_estimated = bw_cl
        return bw_cl

    def evaluate_bandwidth_compliance(
        self,
        tau_matrix: np.ndarray,
        Np: int,
        Nc: int,
        dt: float,
        active_outputs: Optional[np.ndarray] = None,
    ) -> Dict:
        """
        Evalúa si el controlador cumple OBJ-4.

        Calcula:
          - BW_OL: ancho de banda lazo abierto
          - BW_CL: ancho de banda estimado lazo cerrado
          - Ratio: BW_CL / BW_OL
          - Compliant: bool (0.8 ≤ ratio ≤ 1.25)

        Args:
            tau_matrix: Matriz 7×5 de constantes de tiempo
            Np: Horizonte MPC predicción
            Nc: Horizonte MPC control
            dt: Tiempo de muestreo
            active_outputs: Máscara de salidas activas

        Returns:
            result: Diccionario con análisis completo
        """
        bw_ol = self.compute_bw_ol_global(tau_matrix, active_outputs)
        bw_cl = self.compute_bw_cl_from_mpc(Np, Nc, dt)

        if bw_ol == 0 or np.isinf(bw_ol):
            ratio = 0.0
        else:
            ratio = bw_cl / bw_ol

        compliant = self.RATIO_MIN <= ratio <= self.RATIO_MAX

        return {
            "bw_ol": float(bw_ol),
            "bw_cl": float(bw_cl),
            "ratio": float(ratio),
            "compliant": compliant,
            "ratio_min": self.RATIO_MIN,
            "ratio_max": self.RATIO_MAX,
            "settling_time_estimated": float(1.0 / bw_cl) if bw_cl > 0 else np.inf,
        }

    def analyze_channel_bandwidth(
        self,
        tau_matrix: np.ndarray,
        output_idx: int,
    ) -> Dict:
        """
        Analiza ancho de banda individual para una salida.

        Calcula BW_OL para todos los canales (i, j) de una fila (salida).

        Args:
            tau_matrix: Matriz 7×5 de constantes de tiempo
            output_idx: Índice de salida (0-6)

        Returns:
            result: Diccionario con BW_OL por entrada para esta salida
        """
        tau_row = tau_matrix[output_idx, :]
        bw_ol_per_input = [self.compute_bw_ol_channel(tau) for tau in tau_row]

        return {
            "output_idx": output_idx,
            "bw_ol_per_input": bw_ol_per_input,
            "bw_ol_min": min(bw_ol_per_input),
            "bw_ol_max": max(bw_ol_per_input),
            "tau_values": tau_row.tolist(),
        }

    def get_dominant_tau(self, tau_matrix: np.ndarray) -> Tuple[float, int, int]:
        """
        Identifica el canal con constante de tiempo dominante (máxima).

        Args:
            tau_matrix: Matriz 7×5 de constantes de tiempo

        Returns:
            (tau_max, output_idx, input_idx): Valor máximo y su ubicación
        """
        flat_idx = np.argmax(tau_matrix.flatten())
        output_idx, input_idx = np.unravel_index(flat_idx, tau_matrix.shape)
        tau_max = tau_matrix[output_idx, input_idx]

        return tau_max, int(output_idx), int(input_idx)


from typing import Tuple


# Función conveniente para análisis rápido
def quick_bandwidth_check(
    tau_matrix: np.ndarray,
    Np: int = 15,
    Nc: int = 5,
    dt: float = 1.0,
) -> Dict:
    """
    Realiza análisis rápido de ancho de banda.

    Args:
        tau_matrix: Matriz 7×5
        Np: Horizonte predicción MPC
        Nc: Horizonte control MPC
        dt: Tiempo de muestreo

    Returns:
        result: Diccionario con análisis
    """
    analyzer = BandwidthAnalyzer(dt=dt)
    result = analyzer.evaluate_bandwidth_compliance(tau_matrix, Np, Nc, dt)
    return result
