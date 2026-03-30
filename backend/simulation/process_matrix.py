"""
Matriz de parámetros del proceso FOPDT — Fraccionadora de Petróleo Pesado.

Este módulo define la matriz de ganancias 7×5 completa (7 salidas × 5 entradas),
constantes de tiempo τ, tiempos muertos θ e incertidumbre paramétrica ΔK.

Variables controladas (CVs, salidas y):
  y1 = Punto Final Superior
  y2 = Punto Final Lateral
  y3 = Temperatura Superior
  y4 = Temperatura Reflujo Superior
  y5 = Temperatura Extracción Lateral
  y6 = Temperatura Reflujo Intermedio
  y7 = Temperatura Reflujo Fondo

Variables manipuladas (MVs, entradas u):
  u1 = Extracción Superior
  u2 = Extracción Lateral
  u3 = Demanda Reflujo Fondo

Variables de perturbación (DVs, entradas medidas d):
  d1 = Demanda Reflujo Intermedio
  d2 = Demanda Reflujo Superior

Modelo FOPDT individual:
  G_ij(s) = K_ij * exp(-θ_ij*s) / (τ_ij*s + 1)
"""

import numpy as np
from typing import Dict, List, Tuple


# ============================================================================
# MATRIZ DE GANANCIAS K — 7 salidas × 5 entradas
# ============================================================================
K_MATRIX = np.array([
    # y1 (Punto Final Sup.)
    [4.05, 1.77, 5.88, 1.20, 1.44],
    # y2 (Punto Final Lat.)
    [5.39, 5.72, 6.90, 1.52, 1.83],
    # y3 (Temp. Superior)
    [3.66, 1.65, 5.53, 1.16, 1.27],
    # y4 (Temp. Refl. Superior)
    [5.92, 2.54, 8.10, 1.73, 1.79],
    # y5 (Temp. Ext. Lateral)
    [4.13, 2.38, 6.23, 1.31, 1.26],
    # y6 (Temp. Refl. Intermedio)
    [4.06, 4.18, 6.53, 1.19, 1.17],
    # y7 (Temp. Refl. Fondo)
    [4.38, 4.42, 7.20, 1.14, 1.26],
])


# ============================================================================
# MATRIZ DE CONSTANTES DE TIEMPO τ [minutos] — 7×5
# ============================================================================
TAU_MATRIX = np.array([
    # y1
    [50, 60, 50, 45, 40],
    # y2
    [50, 60, 40, 25, 20],
    # y3
    [9, 30, 40, 11, 6],
    # y4
    [12, 27, 20, 5, 19],
    # y5
    [8, 19, 10, 2, 22],
    # y6
    [13, 33, 9, 19, 24],
    # y7
    [33, 44, 19, 27, 32],
])


# ============================================================================
# MATRIZ DE TIEMPOS MUERTOS θ [minutos] — 7×5
# ============================================================================
THETA_MATRIX = np.array([
    # y1
    [27, 28, 27, 27, 27],
    # y2
    [18, 14, 15, 15, 15],
    # y3
    [2, 20, 2, 0, 0],
    # y4
    [11, 12, 2, 0, 0],
    # y5
    [5, 7, 2, 0, 0],
    # y6
    [8, 4, 1, 0, 0],
    # y7
    [20, 22, 0, 0, 0],
])


# ============================================================================
# MATRIZ DE INCERTIDUMBRE ΔK — 7×5
# Rango: K_real = K_nominal + ΔK * εᵢ, donde -1 ≤ εᵢ ≤ 1
# ============================================================================
DELTA_K_MATRIX = np.array([
    # y1 (Punto Final Sup.)
    [2.11, 0.39, 0.59, 0.12, 0.16],
    # y2 (Punto Final Lat.)
    [3.29, 0.57, 0.89, 0.13, 0.13],
    # y3 (Temp. Superior)
    [2.29, 0.35, 0.67, 0.08, 0.08],
    # y4 (Temp. Refl. Superior)
    [2.34, 0.24, 0.32, 0.02, 0.04],
    # y5 (Temp. Ext. Lateral)
    [1.71, 0.93, 0.30, 0.03, 0.02],
    # y6 (Temp. Refl. Intermedio)
    [2.39, 0.35, 0.72, 0.08, 0.01],
    # y7 (Temp. Refl. Fondo)
    [3.11, 0.73, 1.33, 0.18, 0.18],
])


# ============================================================================
# ETIQUETAS Y DESCRIPCIÓN
# ============================================================================
CV_LABELS = [
    "y1: Punto Final Superior",
    "y2: Punto Final Lateral",
    "y3: Temperatura Superior",
    "y4: Temperatura Reflujo Superior",
    "y5: Temperatura Extracción Lateral",
    "y6: Temperatura Reflujo Intermedio",
    "y7: Temperatura Reflujo Fondo",
]

MV_LABELS = [
    "u1: Extracción Superior",
    "u2: Extracción Lateral",
    "u3: Demanda Reflujo Fondo",
]

DV_LABELS = [
    "d1: Demanda Reflujo Intermedio",
    "d2: Demanda Reflujo Superior",
]

# Equivalencias de entrada (u y d combinadas):
#   Entrada 0 → u1
#   Entrada 1 → u2
#   Entrada 2 → u3
#   Entrada 3 → d1
#   Entrada 4 → d2
INPUT_LABELS = [
    "u1: Extracción Superior",
    "u2: Extracción Lateral",
    "u3: Demanda Reflujo Fondo",
    "d1: Demanda Reflujo Intermedio",
    "d2: Demanda Reflujo Superior",
]


# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def get_fopdt_params(
    output_idx: int,
    input_idx: int,
    epsilons: np.ndarray = None
) -> Tuple[float, float, float]:
    """
    Obtiene parámetros FOPDT para un canal específico.

    Args:
        output_idx: Índice de la salida y (0-6)
        input_idx: Índice de la entrada u+d (0-4)
        epsilons: Vector [ε₁, ε₂, ε₃, ε₄, ε₅] para aplicar incertidumbre
                  Si es None, usa K nominal (ε = 0)

    Returns:
        (K_real, tau, theta): tupla de ganancia real, constante de tiempo, tiempo muerto
    """
    K_nom = K_MATRIX[output_idx, input_idx]
    tau = TAU_MATRIX[output_idx, input_idx]
    theta = THETA_MATRIX[output_idx, input_idx]

    if epsilons is not None:
        delta_k = DELTA_K_MATRIX[output_idx, input_idx]
        K_real = K_nom + delta_k * epsilons[input_idx]
    else:
        K_real = K_nom

    return K_real, tau, theta


def apply_uncertainty(
    epsilons: np.ndarray
) -> np.ndarray:
    """
    Aplica vector de incertidumbre ε a la matriz de ganancias.

    Args:
        epsilons: Vector [ε₁, ε₂, ε₃, ε₄, ε₅], cada uno en [-1, 1]

    Returns:
        K_real: Matriz 7×5 de ganancias reales

    Restricción:
        -1 ≤ εᵢ ≤ 1 para i = 1,2,3,4,5
    """
    assert epsilons.shape == (5,), "epsilons debe tener 5 elementos"
    assert np.all(np.abs(epsilons) <= 1.0), "cada ε debe estar en [-1, 1]"

    K_real = K_MATRIX + DELTA_K_MATRIX * epsilons[np.newaxis, :]
    return K_real


def get_process_info() -> Dict:
    """Retorna información de la planta completa."""
    return {
        "num_outputs": 7,
        "num_mv_inputs": 3,
        "num_dv_inputs": 2,
        "num_total_inputs": 5,
        "cv_labels": CV_LABELS,
        "mv_labels": MV_LABELS,
        "dv_labels": DV_LABELS,
        "input_labels": INPUT_LABELS,
        "K_nominal": K_MATRIX.copy(),
        "tau": TAU_MATRIX.copy(),
        "theta": THETA_MATRIX.copy(),
        "delta_K": DELTA_K_MATRIX.copy(),
    }
