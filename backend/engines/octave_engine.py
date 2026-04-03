"""
Motor de cálculo Octave — usa GNU Octave local via subprocess.

Comunica con octave-cli mediante JSON-base64 en stdin/stdout,
con timeout configurable y fallback automático a Python.
"""

import numpy as np
import subprocess
import json
import base64
import shutil
import logging
from typing import Dict, Optional
import os
from datetime import datetime

from engines.python_engine import PythonEngine

logger = logging.getLogger(__name__)


class OctaveEngine:
    """
    Motor de cálculo basado en GNU Octave (subprocess).

    Comunica con octave-cli para ejecutar scripts .m que implementan
    las mismas funciones que PythonEngine.
    """

    def __init__(
        self,
        octave_bin: str = None,
        scripts_dir: str = None,
        timeout_s: float = 30.0,
        fallback_engine: Optional[PythonEngine] = None,
    ):
        """
        Inicializa el motor Octave.

        Args:
            octave_bin: Ruta al binario octave-cli (auto-detect si None)
            scripts_dir: Directorio con scripts .m
            timeout_s: Timeout para llamadas a Octave [segundos]
            fallback_engine: Motor Python para fallback (auto-crea si None)
        """
        self._name = "octave"
        self.timeout_s = timeout_s
        self.fallback_engine = fallback_engine or PythonEngine()
        self.scripts_dir = scripts_dir or os.path.join(
            os.path.dirname(__file__), "..", "octave_scripts"
        )

        # Detecta binario Octave
        if octave_bin is None:
            octave_bin = shutil.which("octave-cli") or shutil.which("octave")

        self.octave_bin = octave_bin
        self._available = octave_bin is not None
        self._octave_version = None

        if self._available:
            try:
                self._detect_version()
            except Exception as e:
                logger.warning(f"No se pudo detectar versión de Octave: {e}")

        # Historial de llamadas (ring buffer)
        self.call_history = []
        self.max_history = 100

    @property
    def engine_name(self) -> str:
        """Retorna nombre del motor."""
        return self._name

    @property
    def is_available(self) -> bool:
        """Retorna disponibilidad (True si octave-cli fue encontrado)."""
        return self._available

    @property
    def octave_version(self) -> Optional[str]:
        """Retorna versión de Octave detectada."""
        return self._octave_version

    def _detect_version(self):
        """Detecta versión de Octave ejecutando 'octave --version'."""
        try:
            result = subprocess.run(
                [self.octave_bin, "--version"],
                capture_output=True,
                text=True,
                timeout=5.0,
            )
            # Parsea versión del output
            output = result.stdout + result.stderr
            # Busca patrón "version X.Y.Z"
            import re
            match = re.search(r"version\s+(\d+\.\d+\.\d+)", output)
            if match:
                self._octave_version = match.group(1)
            else:
                self._octave_version = "unknown"
        except Exception as e:
            logger.warning(f"Error detectando versión Octave: {e}")
            self._octave_version = None

    def _call_octave(self, script_name: str, payload: Dict) -> Dict:
        """
        Llama a un script Octave via subprocess.

        Protocolo:
          - stdin: JSON → base64 (single line)
          - stdout: JSON (single line)
          - stderr: capturado como warning

        Args:
            script_name: Nombre del script .m (ej. "fopdt_step.m")
            payload: Dict a serializar como JSON

        Returns:
            result: Dict deserializado de stdout

        Lanza:
            TimeoutError si se supera timeout_s
            RuntimeError si Octave retorna error
        """
        script_path = os.path.join(self.scripts_dir, script_name)

        if not os.path.exists(script_path):
            raise FileNotFoundError(f"Script Octave no encontrado: {script_path}")

        # Serializa payload: JSON → base64
        json_str = json.dumps(payload)
        b64_input = base64.b64encode(json_str.encode()).decode()

        # Comando Octave: ejecuta el script con input por stdin
        cmd = [
            self.octave_bin,
            "--no-gui",
            "--quiet",
            script_path,
        ]

        try:
            # Ejecuta con timeout
            proc = subprocess.run(
                cmd,
                input=b64_input,
                capture_output=True,
                text=True,
                timeout=self.timeout_s,
            )

            # Captura stderr como warning
            if proc.stderr:
                logger.warning(f"Octave stderr [{script_name}]: {proc.stderr}")

            # Parsea resultado JSON de stdout
            if not proc.stdout:
                raise RuntimeError(f"Octave retornó stdout vacío")

            # Intenta deserializar último JSON del stdout
            # (puede haber output anterior que ignoramos)
            lines = proc.stdout.strip().split('\n')
            result_json = None
            for line in reversed(lines):
                try:
                    result_json = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue

            if result_json is None:
                raise RuntimeError(f"No se encontró JSON válido en stdout: {proc.stdout}")

            # Registra en historial
            self._log_call(script_name, True, None)

            return result_json

        except subprocess.TimeoutExpired:
            self._log_call(script_name, False, "TimeoutExpired")
            raise TimeoutError(f"Octave timeout después de {self.timeout_s}s ejecutando {script_name}")
        except Exception as e:
            self._log_call(script_name, False, str(e))
            raise

    def _log_call(self, script_name: str, success: bool, error: Optional[str]):
        """Registra una llamada a Octave en historial."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "script": script_name,
            "success": success,
            "error": error,
        }
        self.call_history.append(entry)
        if len(self.call_history) > self.max_history:
            self.call_history.pop(0)

    def simulate_step(
        self,
        state: Dict,
        u: np.ndarray,
        d: np.ndarray,
        dt: float = 1.0,
    ) -> Dict:
        """Simula paso FOPDT via Octave con fallback a Python."""
        if not self.is_available:
            logger.warning("Octave no disponible, usando fallback Python")
            return self.fallback_engine.simulate_step(state, u, d, dt)

        try:
            u = np.array(u, dtype=np.float64).flatten()
            d = np.array(d, dtype=np.float64).flatten()

            payload = {
                "u": u.tolist(),
                "d": d.tolist(),
                "dt": float(dt),
                "state": state.get("model_state") if state else None,
            }

            result = self._call_octave("fopdt_step.m", payload)

            if result.get("status") == "error":
                logger.error(f"Octave error: {result.get('msg')}")
                return self.fallback_engine.simulate_step(state, u, d, dt)

            return {
                "y": result.get("outputs"),
                "status": "ok",
                "msg": "",
            }
        except Exception as e:
            logger.warning(f"Octave simulat_step fallback: {e}")
            return self.fallback_engine.simulate_step(state, u, d, dt)

    def compute_control(
        self,
        y_current: np.ndarray,
        y_setpoint: np.ndarray,
        u_previous: np.ndarray,
        d_measured: np.ndarray,
        K_real: np.ndarray,
        constraints: Dict = None,
    ) -> Dict:
        """Calcula control MPC via Octave con fallback."""
        if not self.is_available:
            return self.fallback_engine.compute_control(
                y_current, y_setpoint, u_previous, d_measured, K_real, constraints
            )

        try:
            payload = {
                "y": np.array(y_current).flatten().tolist(),
                "y_sp": np.array(y_setpoint).flatten().tolist(),
                "u_prev": np.array(u_previous).flatten().tolist(),
                "d": np.array(d_measured).flatten().tolist(),
                "K_real": np.array(K_real).tolist(),
                "constraints": constraints or {},
            }

            result = self._call_octave("mpc_solve.m", payload)

            if result.get("status") == "error":
                logger.error(f"Octave MPC error: {result.get('msg')}")
                return self.fallback_engine.compute_control(
                    y_current, y_setpoint, u_previous, d_measured, K_real, constraints
                )

            return {
                "u_optimal": result.get("outputs"),
                "cost": result.get("cost"),
                "feasible": result.get("feasible", False),
                "status": "ok",
                "msg": "",
            }
        except Exception as e:
            logger.warning(f"Octave compute_control fallback: {e}")
            return self.fallback_engine.compute_control(
                y_current, y_setpoint, u_previous, d_measured, K_real, constraints
            )

    def check_constraints(
        self,
        u_proposed: np.ndarray,
        u_previous: np.ndarray,
        y_current: np.ndarray,
    ) -> Dict:
        """Chequea restricciones via Octave con fallback."""
        if not self.is_available:
            return self.fallback_engine.check_constraints(u_proposed, u_previous, y_current)

        try:
            payload = {
                "u": np.array(u_proposed).flatten().tolist(),
                "u_prev": np.array(u_previous).flatten().tolist(),
                "y": np.array(y_current).flatten().tolist(),
            }

            result = self._call_octave("check_constraints.m", payload)

            if result.get("status") == "error":
                logger.error(f"Octave constraints error: {result.get('msg')}")
                return self.fallback_engine.check_constraints(u_proposed, u_previous, y_current)

            return {
                "u_limited": result.get("outputs"),
                "violations": result.get("violations", {}),
                "status": "ok",
                "msg": "",
            }
        except Exception as e:
            logger.warning(f"Octave check_constraints fallback: {e}")
            return self.fallback_engine.check_constraints(u_proposed, u_previous, y_current)

    def compute_bandwidth(
        self,
        tau_matrix: np.ndarray,
        Np: int = 15,
        Nc: int = 5,
        dt: float = 1.0,
    ) -> Dict:
        """Calcula ancho de banda via Octave con fallback."""
        if not self.is_available:
            return self.fallback_engine.compute_bandwidth(tau_matrix, Np, Nc, dt)

        try:
            payload = {
                "tau": np.array(tau_matrix).tolist(),
                "Np": int(Np),
                "Nc": int(Nc),
                "dt": float(dt),
            }

            result = self._call_octave("bandwidth_analysis.m", payload)

            if result.get("status") == "error":
                logger.error(f"Octave bandwidth error: {result.get('msg')}")
                return self.fallback_engine.compute_bandwidth(tau_matrix, Np, Nc, dt)

            return {
                **result,
                "status": "ok",
                "msg": "",
            }
        except Exception as e:
            logger.warning(f"Octave compute_bandwidth fallback: {e}")
            return self.fallback_engine.compute_bandwidth(tau_matrix, Np, Nc, dt)

    def apply_uncertainty(
        self,
        K_nominal: np.ndarray,
        delta_K: np.ndarray,
        epsilons: np.ndarray,
    ) -> Dict:
        """Aplica incertidumbre via Octave con fallback."""
        if not self.is_available:
            return self.fallback_engine.apply_uncertainty(K_nominal, delta_K, epsilons)

        try:
            payload = {
                "K_nom": np.array(K_nominal).tolist(),
                "dK": np.array(delta_K).tolist(),
                "eps": np.array(epsilons).flatten().tolist(),
            }

            result = self._call_octave("apply_uncertainty.m", payload)

            if result.get("status") == "error":
                logger.error(f"Octave uncertainty error: {result.get('msg')}")
                return self.fallback_engine.apply_uncertainty(K_nominal, delta_K, epsilons)

            return {
                "K_real": result.get("outputs"),
                "status": "ok",
                "msg": "",
            }
        except Exception as e:
            logger.warning(f"Octave apply_uncertainty fallback: {e}")
            return self.fallback_engine.apply_uncertainty(K_nominal, delta_K, epsilons)

    def compute_scaling(self, G0: np.ndarray) -> Dict:
        """
        Calcula escalado óptimo CondMin vía Octave/sqp.

        Minimiza cond(L @ G0 @ R) con L, R diagonales.

        Args:
            G0: Submatriz 3×3 (y1, y2, y7 × u1, u2, u3)

        Returns:
            Dict con:
                - status: 'ok' o 'error'
                - sv_original, sv_scaled: valores singulares
                - kappa_original, kappa_scaled: números de condición
                - L_diag, R_diag: factores de escalado
                - engine: 'octave'
        """
        if not self.is_available:
            return {"status": "error", "msg": "Octave no disponible", "engine": "octave"}

        try:
            payload = {
                "G0": np.array(G0).tolist(),
            }
            result = self._call_octave("scaling_analysis.m", payload)

            if result.get("status") == "error":
                logger.error(f"Octave scaling error: {result.get('msg')}")
                return result

            return {
                **result,
                "status": "ok",
                "engine": "octave",
            }
        except Exception as e:
            logger.warning(f"Octave compute_scaling fallback: {e}")
            return {"status": "error", "msg": str(e), "engine": "octave"}

    def get_call_history(self, limit: int = 50) -> list:
        """Retorna últimas N llamadas a Octave."""
        return self.call_history[-limit:]

    def reset(self):
        """Reinicia el motor (principalmente el historial)."""
        self.call_history.clear()
        self.fallback_engine.reset()
