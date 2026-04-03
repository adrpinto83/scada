"""
Análisis de escalado óptimo (CondMin) para mejorar el número de condición.

Minimiza cond(L @ K @ R) donde L, R son matrices diagonales,
equivalente al algoritmo SQP del ejemplo Octave.

Referencia: Shell Control Problem — Escalado para estabilidad numérica del MPC
"""

import numpy as np
from scipy.optimize import minimize
from typing import Tuple, Dict


# Índices fila de G0 en K_MATRIX: y1=0, y2=1, y7=6
G0_ROW_INDICES = [0, 1, 6]
# Índices columna de G0: u1=0, u2=1, u3=2
G0_COL_INDICES = [0, 1, 2]


def _extract_G0(K_full: np.ndarray) -> np.ndarray:
    """
    Extrae submatriz G0 (3×3) de K completa (7×5).

    G0 representa las 3 CVs principales (y1, y2, y7) controladas por 3 MVs (u1, u2, u3).

    Args:
        K_full: Matriz de ganancia completa (7×5)

    Returns:
        G0: Submatriz (3×3)
    """
    return K_full[np.ix_(G0_ROW_INDICES, G0_COL_INDICES)]


def _condition_number_objective(x: np.ndarray, K: np.ndarray) -> float:
    """
    Función objetivo: número de condición cond(L @ K @ R).

    Usa espacio logarítmico para garantizar positividad sin restricciones explicitas:
        L_i = exp(x_i)      para i < m
        R_j = exp(x_{m+j})  para j < n

    Args:
        x: Vector de parámetros (m+n,) en espacio log
        K: Matriz objetivo (m×n)

    Returns:
        κ = cond(L @ K @ R) = σ_max / σ_min
    """
    m, n = K.shape
    # Exponencial garantiza positividad
    L_diag = np.exp(x[:m])
    R_diag = np.exp(x[m:])
    L = np.diag(L_diag)
    R = np.diag(R_diag)

    # Valores singulares de la matriz escalada
    scaled = L @ K @ R
    sv = np.linalg.svd(scaled, compute_uv=False)

    # Evita división por cero en caso de singularidad (nunca debería pasar con nuestro K)
    if sv[-1] < 1e-12:
        return 1e12

    return sv[0] / sv[-1]


def cond_min(K: np.ndarray) -> Tuple[np.ndarray, np.ndarray, float, Dict]:
    """
    Minimiza el número de condición de una matriz mediante escalado diagonal óptimo.

    Resuelve: min_{L,R diagonal} cond(L @ K @ R)

    Args:
        K: Matriz objetivo (m×n), típicamente 3×3 (G0)

    Returns:
        L: Matriz diagonal (m×m) de escalado de salidas
        R: Matriz diagonal (n×n) de escalado de entradas
        kappa_min: Número de condición mínimo alcanzado
        info: Diccionario con metadatos (SVD original, escalado, éxito del optimizador)
    """
    m, n = K.shape

    # Valores singulares originales
    sv_original = np.linalg.svd(K, compute_uv=False)
    kappa_original = sv_original[0] / sv_original[-1]

    # Punto inicial: x = 0 ⟹ L = I, R = I
    x0 = np.zeros(m + n)

    # Optimización SLSQP (sin restricciones en espacio log)
    result = minimize(
        fun=_condition_number_objective,
        x0=x0,
        args=(K,),
        method='SLSQP',
        options={'maxiter': 500, 'ftol': 1e-8}
    )

    # Transformar de vuelta del espacio log
    L_diag = np.exp(result.x[:m])
    R_diag = np.exp(result.x[m:])
    L = np.diag(L_diag)
    R = np.diag(R_diag)

    # Validar resultado
    K_scaled = L @ K @ R
    sv_scaled = np.linalg.svd(K_scaled, compute_uv=False)
    kappa_min = sv_scaled[0] / sv_scaled[-1]

    return L, R, kappa_min, {
        "success": result.success,
        "message": result.message,
        "sv_original": sv_original.tolist(),
        "sv_scaled": sv_scaled.tolist(),
        "kappa_original": float(kappa_original),
        "kappa_scaled": float(kappa_min),
        "L_diag": L_diag.tolist(),
        "R_diag": R_diag.tolist(),
        "G0_scaled": K_scaled.tolist(),
    }


class ScalingAnalyzer:
    """
    Gestor de escalado con cache para evitar recomputo.

    Calcula L, R una sola vez en inicialización y las reutiliza
    en cada paso del MPC sin cambios (pues ε=0 siempre).

    Attributes:
        _L: Matriz diagonal de escalado de salidas (3×3)
        _R: Matriz diagonal de escalado de entradas (3×3)
        _R_inv: Precomputada para eficiencia
        _L_inv: Precomputada para eficiencia
        _kappa_min: Número de condición escalado
        _info: Dict con metadatos de optimización
        _computed: Flag que indica si ya fue computado
    """

    def __init__(self):
        """Inicializa analizador vacío (debe llamar compute() después)."""
        self._L = None
        self._R = None
        self._R_inv = None
        self._L_inv = None
        self._kappa_min = None
        self._info = None
        self._computed = False

    def compute_from_K_full(self, K_full: np.ndarray):
        """
        Calcula escalado usando G0 extraída de K completa (7×5).

        Args:
            K_full: Matriz de ganancia completa (7×5)
        """
        G0 = _extract_G0(K_full)
        self.compute(G0)

    def compute(self, G0: np.ndarray):
        """
        Calcula escalado CondMin para G0.

        Args:
            G0: Submatriz 3×3
        """
        L, R, kappa_min, info = cond_min(G0)
        self._L = L
        self._R = R
        self._R_inv = np.diag(1.0 / np.diag(R))
        self._L_inv = np.diag(1.0 / np.diag(L))
        self._kappa_min = kappa_min
        self._info = info
        self._computed = True

    @property
    def L(self) -> np.ndarray:
        """Matriz diagonal L de escalado de salidas (y1, y2, y7)."""
        if not self._computed:
            raise RuntimeError(
                "ScalingAnalyzer.compute() no ha sido llamado. "
                "Llama compute_from_K_full(K_MATRIX) primero."
            )
        return self._L

    @property
    def R(self) -> np.ndarray:
        """Matriz diagonal R de escalado de entradas (u1, u2, u3)."""
        if not self._computed:
            raise RuntimeError("ScalingAnalyzer no inicializado. Llama compute() primero.")
        return self._R

    @property
    def R_inv(self) -> np.ndarray:
        """Inversa precomputada de R (para transformar de vuelta)."""
        if not self._computed:
            raise RuntimeError("ScalingAnalyzer no inicializado.")
        return self._R_inv

    @property
    def L_inv(self) -> np.ndarray:
        """Inversa precomputada de L."""
        if not self._computed:
            raise RuntimeError("ScalingAnalyzer no inicializado.")
        return self._L_inv

    @property
    def kappa_min(self) -> float:
        """Número de condición mínimo alcanzado."""
        if not self._computed:
            raise RuntimeError("ScalingAnalyzer no inicializado.")
        return self._kappa_min

    def get_conditioning_info(self) -> Dict:
        """
        Retorna información completa de condicionamiento para visualización frontend.

        Returns:
            Dict con claves:
                - computed: bool
                - kappa_original, kappa_scaled: float
                - sv_original, sv_scaled: list[float]
                - L_diag, R_diag: list[float]
                - G0_row_indices, G0_col_indices: list[int]
        """
        if not self._computed:
            return {"computed": False}

        return {
            "computed": True,
            **self._info,
            "G0_row_indices": G0_ROW_INDICES,
            "G0_col_indices": G0_COL_INDICES,
        }

    @property
    def is_computed(self) -> bool:
        """Indica si el análisis ya fue computado."""
        return self._computed
