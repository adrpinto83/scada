"""
Modelo FOPDT discreto (Primer Orden con Tiempo Muerto) para la Fraccionadora.

Implementa simulación en tiempo discreto con:
  - Integración Euler para dinámicas de primer orden
  - Buffers FIFO circulares para tiempo muerto por cada canal (i,j)
  - Δt = 1 minuto (tiempo de muestreo discreto)
  - Manejo de entrada medida (u, d) con saturación previa en MV

Función de transferencia individual:
    G_ij(s) = K_ij * exp(-θ_ij*s) / (τ_ij*s + 1)

Discretización Euler:
    y_ij[k+1] = y_ij[k] + (Δt/τ_ij) * (K_ij * u_delayed_ij - y_ij[k])

donde u_delayed_ij es la entrada después de pasar por el buffer de tiempo muerto.
"""

import numpy as np
from typing import Optional, Tuple
from collections import deque
from .process_matrix import get_fopdt_params


class FOPDTChannel:
    """
    Simula un canal FOPDT individual (un par entrada-salida).

    Estado interno:
      - y_state: Estado de la dinámica de primer orden
      - theta_buffer: FIFO queue para el tiempo muerto (retardo discreto)
    """

    def __init__(
        self,
        K: float,
        tau: float,
        theta: float,
        dt: float = 1.0,
        initial_state: float = 0.0,
    ):
        """
        Inicializa un canal FOPDT.

        Args:
            K: Ganancia estática
            tau: Constante de tiempo [minutos]
            theta: Tiempo muerto [minutos]
            dt: Tiempo de muestreo [minutos], default 1.0
            initial_state: Condición inicial de la salida, default 0.0
        """
        self.K = K
        self.tau = max(tau, 0.01)  # Evita división por cero
        self.theta = theta
        self.dt = dt
        self.y_state = initial_state

        # Buffer circular para tiempo muerto (discreto)
        # Tamaño = ceil(theta / dt) + 1
        buffer_size = max(1, int(np.ceil(theta / dt)) + 1)
        self.theta_buffer = deque([0.0] * buffer_size, maxlen=buffer_size)

    def step(self, u_input: float) -> float:
        """
        Calcula un paso de simulación (Δt).

        Algoritmo:
          1. Pushea u_input al buffer de retardo (FIFO)
          2. Obtiene u_delayed del extremo opuesto del buffer
          3. Aplica integración Euler: y[k+1] = y[k] + (Δt/τ) * (K*u_delayed - y[k])

        Args:
            u_input: Entrada al canal en tiempo actual

        Returns:
            y_output: Salida actual (después de integración)
        """
        # Pushea entrada al buffer (automáticamente saca la más vieja)
        self.theta_buffer.appendleft(u_input)
        # Obtiene entrada retardada (la más vieja en el buffer)
        u_delayed = self.theta_buffer[-1]

        # Integración Euler
        # dy/dt = (K*u - y) / tau  →  y[k+1] = y[k] + (Δt/τ) * (K*u_delayed - y[k])
        alpha = self.dt / self.tau
        self.y_state = self.y_state + alpha * (self.K * u_delayed - self.y_state)

        return self.y_state

    def reset(self, initial_state: float = 0.0):
        """Reinicia el canal a condición inicial."""
        self.y_state = initial_state
        self.theta_buffer = deque([0.0] * len(self.theta_buffer), maxlen=len(self.theta_buffer))

    def get_state(self) -> dict:
        """Retorna estado interno para diagnóstico."""
        return {
            "y_state": self.y_state,
            "theta_buffer": list(self.theta_buffer),
            "K": self.K,
            "tau": self.tau,
            "theta": self.theta,
        }


class FOPDTModel:
    """
    Modelo FOPDT completo 7×5 para la Fraccionadora.

    Mantiene 35 canales FOPDT (7 salidas × 5 entradas) y coordina
    la simulación en tiempo discreto.

    Variables:
      - y ∈ ℝ⁷: salidas controladas (CVs)
      - u ∈ ℝ³: entradas manipuladas (MVs)
      - d ∈ ℝ²: perturbaciones medidas (DVs)
      - Entradas totales (internamente): [u₁, u₂, u₃, d₁, d₂] ∈ ℝ⁵
    """

    def __init__(self, dt: float = 1.0, epsilons: Optional[np.ndarray] = None):
        """
        Inicializa el modelo FOPDT 7×5.

        Args:
            dt: Tiempo de muestreo [minutos], default 1.0
            epsilons: Vector [ε₁, ε₂, ε₃, ε₄, ε₅] para incertidumbre.
                     Si es None, usa K nominal.
        """
        self.dt = dt
        self.epsilons = epsilons if epsilons is not None else np.zeros(5)
        self.t = 0.0

        # Inicializa los 35 canales (7 filas × 5 columnas)
        self.channels = []
        for i in range(7):  # 7 salidas
            row = []
            for j in range(5):  # 5 entradas
                K, tau, theta = get_fopdt_params(i, j, self.epsilons)
                channel = FOPDTChannel(K, tau, theta, dt=dt, initial_state=0.0)
                row.append(channel)
            self.channels.append(row)

        # Estado actual
        self.y = np.zeros(7)  # Salidas
        self.u_prev = np.zeros(3)  # MVs anteriores (para rate-limit check)
        self.d_prev = np.zeros(2)  # DVs anteriores

    def set_uncertainties(self, epsilons: np.ndarray):
        """
        Actualiza vector de incertidumbre y regenera parámetros de canales.

        Args:
            epsilons: Vector [ε₁, ε₂, ε₃, ε₄, ε₅]
        """
        self.epsilons = np.array(epsilons)
        for i in range(7):
            for j in range(5):
                K, tau, theta = get_fopdt_params(i, j, self.epsilons)
                # Actualiza parámetros pero preserva estado
                old_state = self.channels[i][j].y_state
                self.channels[i][j].K = K
                self.channels[i][j].tau = max(tau, 0.01)
                # No reiniciamos theta porque implicaría cambiar tamaño del buffer
                # En práctica, theta es fijo del diseño y no se parametriza con ε

    def step(self, u: np.ndarray, d: np.ndarray) -> np.ndarray:
        """
        Simula un paso Δt del sistema.

        Args:
            u: Vector [u₁, u₂, u₃] de entradas manipuladas (MVs)
            d: Vector [d₁, d₂] de perturbaciones medidas (DVs)

        Returns:
            y: Vector [y₁, ..., y₇] de salidas actuales (CVs)

        Notas:
          - Las entrada u y d se suponen ya saturadas/limitadas por el controlador
          - Cada salida es suma de contribuciones de las 5 entradas
            y_i = Σⱼ G_ij(u_j, d_j)
        """
        # Combina MVs y DVs en un vector de 5 entradas
        inputs = np.concatenate([u, d])

        # Propaga a través de cada canal y acumula contribuciones
        y_new = np.zeros(7)
        for i in range(7):  # Para cada salida
            for j in range(5):  # Para cada entrada
                channel_output = self.channels[i][j].step(inputs[j])
                y_new[i] += channel_output

        self.y = y_new
        self.t += self.dt
        self.u_prev = u.copy()
        self.d_prev = d.copy()

        return self.y.copy()

    def reset(self, t: float = 0.0):
        """Reinicia el modelo a estado cero."""
        for i in range(7):
            for j in range(5):
                self.channels[i][j].reset(initial_state=0.0)
        self.y = np.zeros(7)
        self.u_prev = np.zeros(3)
        self.d_prev = np.zeros(2)
        self.t = t

    def get_state(self) -> dict:
        """Retorna estado completo del modelo para serialización."""
        return {
            "t": self.t,
            "y": self.y.tolist(),
            "u_prev": self.u_prev.tolist(),
            "d_prev": self.d_prev.tolist(),
            "epsilons": self.epsilons.tolist(),
            "channels": [
                [self.channels[i][j].get_state() for j in range(5)]
                for i in range(7)
            ],
        }

    def set_state(self, state: dict):
        """Restaura estado completo del modelo."""
        self.t = state["t"]
        self.y = np.array(state["y"])
        self.u_prev = np.array(state["u_prev"])
        self.d_prev = np.array(state["d_prev"])
        self.epsilons = np.array(state["epsilons"])

        # Restaura canales
        for i in range(7):
            for j in range(5):
                ch_state = state["channels"][i][j]
                self.channels[i][j].y_state = ch_state["y_state"]
                self.channels[i][j].theta_buffer = deque(
                    ch_state["theta_buffer"],
                    maxlen=len(self.channels[i][j].theta_buffer)
                )


# Ejemplo de uso / verificación
if __name__ == "__main__":
    # Prueba básica: escalón unitario en u1 (entrada 0)
    model = FOPDTModel(dt=1.0)
    print("FOPDT Model initialized")
    print(f"Channels: 7 outputs × 5 inputs = 35 channels")

    # Simula 200 pasos (200 minutos)
    u = np.zeros(3)
    d = np.zeros(2)
    u[0] = 0.1  # Escalón en u1

    y_history = []
    for step in range(200):
        y = model.step(u, d)
        y_history.append(y.copy())

    y_history = np.array(y_history)
    print(f"\nSimulación completada: {len(y_history)} pasos")
    print(f"Salida y1 final: {y_history[-1, 0]:.4f}")
    print(f"Salida y2 final: {y_history[-1, 1]:.4f}")
