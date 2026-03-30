"""
Fábrica y gestor del motor de cálculo dual.

Maneja:
  - Creación e inicialización de motores
  - Switching en tiempo de ejecución (hot-swap)
  - Fallback automático a Python
  - Detección de disponibilidad de Octave
"""

import os
import logging
from typing import Optional, Dict
import numpy as np

from engines.base_engine import CalcEngine
from engines.python_engine import PythonEngine
from engines.octave_engine import OctaveEngine

logger = logging.getLogger(__name__)


class EngineFactory:
    """
    Fábrica para crear y gestionar motores de cálculo dual.
    """

    def __init__(
        self,
        default_engine: str = "python",
        octave_bin: Optional[str] = None,
        octave_scripts_dir: Optional[str] = None,
        octave_timeout: float = 30.0,
    ):
        """
        Inicializa la fábrica.

        Args:
            default_engine: Motor inicial ('python' | 'octave')
            octave_bin: Ruta a octave-cli (auto-detect si None)
            octave_scripts_dir: Directorio con scripts .m
            octave_timeout: Timeout para Octave [segundos]
        """
        self.default_engine = default_engine
        self.octave_bin = octave_bin or os.environ.get("OCTAVE_BIN")
        self.octave_scripts_dir = octave_scripts_dir or os.environ.get(
            "OCTAVE_SCRIPTS_DIR",
            os.path.join(os.path.dirname(__file__), "..", "octave_scripts"),
        )
        self.octave_timeout = float(
            os.environ.get("OCTAVE_TIMEOUT", str(octave_timeout))
        )

        # Crea instancias de motores
        self.python_engine = PythonEngine()
        self.octave_engine = OctaveEngine(
            octave_bin=self.octave_bin,
            scripts_dir=self.octave_scripts_dir,
            timeout_s=self.octave_timeout,
            fallback_engine=self.python_engine,
        )

        # Motor activo
        self.active_engine = self._select_engine(default_engine)
        self.fallback_active = False

    def _select_engine(self, engine_name: str) -> CalcEngine:
        """Selecciona motor por nombre."""
        if engine_name.lower() == "octave":
            if self.octave_engine.is_available:
                return self.octave_engine
            else:
                logger.warning(
                    "Octave solicitado pero no disponible. "
                    "Usando fallback Python."
                )
                self.fallback_active = True
                return self.python_engine
        else:
            return self.python_engine

    def switch_engine(self, engine_name: str) -> Dict:
        """
        Cambia el motor activo en tiempo de ejecución (hot-swap).

        Args:
            engine_name: 'python' | 'octave'

        Returns:
            result: Diccionario con estado de cambio
        """
        if engine_name.lower() == self.active_engine.engine_name:
            return {
                "success": True,
                "active": self.active_engine.engine_name,
                "message": f"Motor ya activo: {engine_name}",
            }

        new_engine = self._select_engine(engine_name)

        if new_engine.engine_name == "octave" and not new_engine.is_available:
            return {
                "success": False,
                "active": self.active_engine.engine_name,
                "message": "GNU Octave no está disponible. Instalarlo con:\n"
                           "  Linux/WSL: sudo apt install octave\n"
                           "  macOS: brew install octave\n"
                           "  Windows: winget install GNU.Octave",
            }

        self.active_engine = new_engine
        logger.info(f"Motor de cálculo cambiado a: {new_engine.engine_name}")

        return {
            "success": True,
            "active": self.active_engine.engine_name,
            "message": f"Motor cambiado a {engine_name} correctamente",
        }

    def get_engine_status(self) -> Dict:
        """Retorna estado de disponibilidad de motores."""
        return {
            "active": self.active_engine.engine_name,
            "active_is_fallback": self.fallback_active,
            "python_available": self.python_engine.is_available,
            "octave_available": self.octave_engine.is_available,
            "octave_bin": self.octave_engine.octave_bin,
            "octave_version": self.octave_engine.octave_version,
            "octave_timeout_s": self.octave_timeout,
            "octave_scripts_dir": self.octave_scripts_dir,
        }

    def get_benchmark_info(self) -> Dict:
        """
        Retorna información para benchmarking de motores.

        Se usa para validar que Python y Octave produzcan resultados equivalentes.
        """
        return {
            "python_engine_available": self.python_engine.is_available,
            "octave_engine_available": self.octave_engine.is_available,
            "octave_version": self.octave_engine.octave_version,
            "test_params": {
                "num_test_steps": 10,
                "u_test": [0.1, 0.1, 0.1],
                "d_test": [0.0, 0.0],
            },
        }

    def get_active_engine(self) -> CalcEngine:
        """Retorna motor activo."""
        return self.active_engine

    def reset_all(self):
        """Reinicia todos los motores."""
        self.python_engine.reset()
        if self.octave_engine.is_available:
            self.octave_engine.reset()


# Singleton global
_factory_instance: Optional[EngineFactory] = None


def get_engine_factory(
    default_engine: str = "python",
    octave_bin: Optional[str] = None,
    octave_scripts_dir: Optional[str] = None,
) -> EngineFactory:
    """
    Obtiene o crea la fábrica singleton.

    Args:
        default_engine: Motor inicial
        octave_bin: Ruta a octave-cli
        octave_scripts_dir: Directorio de scripts

    Returns:
        EngineFactory: Instancia singleton
    """
    global _factory_instance
    if _factory_instance is None:
        _factory_instance = EngineFactory(
            default_engine=default_engine,
            octave_bin=octave_bin,
            octave_scripts_dir=octave_scripts_dir,
        )
    return _factory_instance


def get_calc_engine() -> CalcEngine:
    """Obtiene motor de cálculo activo."""
    return get_engine_factory().get_active_engine()
