"""
Gestión de incertidumbre paramétrica en la matriz de ganancias.

La incertidumbre en el proceso se modela como:
  K_real_ij = K_nominal_ij + ΔK_ij * εᵢ

donde -1 ≤ εᵢ ≤ 1 para cada entrada i (5 parámetros de incertidumbre).

Este módulo proporciona funciones para:
  - Aplicar valores de ε en tiempo real
  - Validar rangos
  - Generar instancias de incertidumbre aleatorias
"""

import numpy as np
from typing import Optional, Tuple
from .process_matrix import (
    K_MATRIX,
    DELTA_K_MATRIX,
    apply_uncertainty as apply_uncertainty_nominal,
)


class UncertaintyManager:
    """
    Gestor de incertidumbre paramétrica.

    Mantiene un vector ε persistente y aplicable a las ganancias
    en cualquier momento.
    """

    def __init__(self, epsilons: Optional[np.ndarray] = None):
        """
        Inicializa el gestor con vector de incertidumbre.

        Args:
            epsilons: Vector [ε₁, ε₂, ε₃, ε₄, ε₅] en [-1, 1].
                     Si es None, usa [0, 0, 0, 0, 0] (sin incertidumbre).
        """
        if epsilons is None:
            self.epsilons = np.zeros(5)
        else:
            self.epsilons = np.array(epsilons, dtype=np.float64)
            self._validate_epsilons()

    def _validate_epsilons(self):
        """Valida que todos los ε estén en [-1, 1]."""
        if not np.all(np.abs(self.epsilons) <= 1.0):
            raise ValueError("Todos los ε deben estar en el rango [-1.0, 1.0]")

    def set_epsilons(self, epsilons: np.ndarray):
        """
        Actualiza el vector de incertidumbre.

        Args:
            epsilons: Vector [ε₁, ε₂, ε₃, ε₄, ε₅]

        Lanza:
            ValueError si algún ε está fuera de [-1, 1]
        """
        self.epsilons = np.array(epsilons, dtype=np.float64)
        self._validate_epsilons()

    def set_single_epsilon(self, input_idx: int, value: float):
        """
        Actualiza un único parámetro de incertidumbre.

        Args:
            input_idx: Índice de entrada (0-4)
            value: Valor en [-1.0, 1.0]

        Lanza:
            ValueError si value está fuera de rango
            IndexError si input_idx es inválido
        """
        if not (0 <= input_idx < 5):
            raise IndexError(f"input_idx debe estar en [0, 4], recibido {input_idx}")
        if not (-1.0 <= value <= 1.0):
            raise ValueError(f"Valor debe estar en [-1.0, 1.0], recibido {value}")

        self.epsilons[input_idx] = value

    def get_K_real(self) -> np.ndarray:
        """
        Retorna la matriz de ganancias reales actual con incertidumbre aplicada.

        Returns:
            K_real: Matriz 7×5 de ganancias con incertidumbre
        """
        return K_MATRIX + DELTA_K_MATRIX * self.epsilons[np.newaxis, :]

    def get_K_channel(self, output_idx: int, input_idx: int) -> float:
        """
        Retorna la ganancia de un canal específico.

        Args:
            output_idx: Índice de salida (0-6)
            input_idx: Índice de entrada (0-4)

        Returns:
            Ganancia real K_ij con incertidumbre aplicada
        """
        K_real = self.get_K_real()
        return K_real[output_idx, input_idx]

    def get_epsilons(self) -> np.ndarray:
        """Retorna copia del vector actual de ε."""
        return self.epsilons.copy()

    def reset(self):
        """Reinicia incertidumbre a cero (modelo nominal)."""
        self.epsilons = np.zeros(5)

    def randomize(self, seed: Optional[int] = None):
        """
        Genera vector de incertidumbre aleatorio uniforme en [-1, 1].

        Args:
            seed: Seed de RNG para reproducibilidad (opcional)
        """
        if seed is not None:
            np.random.seed(seed)
        self.epsilons = np.random.uniform(-1.0, 1.0, 5)

    def get_info(self) -> dict:
        """Retorna información diagnóstica del gestor."""
        return {
            "epsilons": self.epsilons.tolist(),
            "labels": [
                "ε₁ (u1 - Ext. Superior)",
                "ε₂ (u2 - Ext. Lateral)",
                "ε₃ (u3 - Dem. Refl. Fondo)",
                "ε₄ (d1 - Dem. Refl. Inter.)",
                "ε₅ (d2 - Dem. Refl. Super.)",
            ],
            "K_real": self.get_K_real().tolist(),
            "K_nominal": K_MATRIX.tolist(),
        }


def generate_test_case_epsilons(case_num: int) -> Tuple[np.ndarray, float, float]:
    """
    Genera vector de ε para la condición nominal única (ε = 0).

    PROTOTIPO ÚNICO:
      CASO 1: ε₁=ε₂=ε₃=ε₄=ε₅=0 (modelo nominal sin incertidumbre paramétrica)
              d1=+0.5, d2=+0.5

    El sistema se valida solo bajo condición nominal. Las variaciones en perturbaciones
    d1, d2 se usan para validar rechazo de perturbaciones.

    Args:
        case_num: Debe ser 1 (única opción)

    Returns:
        (epsilons, d1_step, d2_step): tupla con ε=0 y perturbaciones

    Raises:
        ValueError si case_num ≠ 1
    """
    if case_num != 1:
        raise ValueError(
            f"Solo existe el CASO 1 (condición nominal, ε=0). "
            f"Recibido case_num={case_num}"
        )
    return np.array([0.0, 0.0, 0.0, 0.0, 0.0]), 0.5, 0.5
