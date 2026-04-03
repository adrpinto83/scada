"""
FastAPI backend para SCADA Fraccionadora — Shell Control Problem.

Servicios:
  - Simulación FOPDT en tiempo real (1 Hz)
  - Control MPC multivariable
  - WebSocket para streaming (1 Hz)
  - Motor dual Python/Octave con switching en caliente
  - Gestión de alarmas
  - Carga de escenarios de prueba
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import asyncio
import numpy as np
import logging
import json
import time
from datetime import datetime
from typing import Dict, List, Optional
from collections import deque

from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from simulation.fopdt_model import FOPDTModel
from simulation.uncertainty import UncertaintyManager, generate_test_case_epsilons
from simulation.process_matrix import K_MATRIX, TAU_MATRIX, THETA_MATRIX, DELTA_K_MATRIX
from control.controller import MPCController
from control.constraints import ConstraintChecker, ConstraintFormatter
from analysis.bandwidth import BandwidthAnalyzer
from analysis.scaling import ScalingAnalyzer
from engines import get_engine_factory

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ============================================================================
# MODELOS PYDANTIC
# ============================================================================


class SetpointRequest(BaseModel):
    """Request para actualizar setpoints."""
    y1_sp: float = Field(..., ge=-0.5, le=0.5)
    y2_sp: float = Field(..., ge=-0.5, le=0.5)


class UncertaintyRequest(BaseModel):
    """Request para actualizar incertidumbres."""
    epsilons: List[float] = Field(..., min_length=5, max_length=5)


class AnalyzerFaultRequest(BaseModel):
    """Request para simular fallo de analizador."""
    analyzer: str = Field(..., pattern="^(y1|y2)$")
    fault: bool


class EngineSwitchRequest(BaseModel):
    """Request para cambiar motor de cálculo."""
    engine: str = Field(..., pattern="^(python|octave)$")


class ControllerSwitchRequest(BaseModel):
    """Request para cambiar tipo de controlador."""
    controller: str = Field(..., pattern="^(mpc|decentralized)$")


class ScenarioRequest(BaseModel):
    """Request para cargar escenario de prueba."""
    case: int = Field(..., ge=1, le=1)  # Solo caso nominal (ε=0)


# ============================================================================
# APLICACIÓN FASTAPI
# ============================================================================

app = FastAPI(
    title="SCADA Fraccionadora — Shell Control Problem",
    description="Sistema de simulación y control multivariable",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# ESTADO GLOBAL DEL SISTEMA
# ============================================================================


class SimulationState:
    """Estado persistente de la simulación."""

    def __init__(self):
        # Modelo y controlador
        self.fopdt_model = FOPDTModel(dt=1.0)
        self.uncertainty_manager = UncertaintyManager()

        # Escalado CondMin (pre-calculado con K nominal)
        self.scaling_analyzer = ScalingAnalyzer()
        self.scaling_analyzer.compute_from_K_full(K_MATRIX)  # Calcula L, R una sola vez

        # Controller MPC con escalado
        self.mpc_controller = MPCController(
            Np=15, Nc=5, dt=1.0,
            scaling_analyzer=self.scaling_analyzer  # Inyecta escalador
        )
        self.constraint_checker = ConstraintChecker()
        self.bandwidth_analyzer = BandwidthAnalyzer(dt=1.0)

        # Motor de cálculo
        self.engine_factory = get_engine_factory(default_engine="python")

        # Estado actual
        self.t = 0.0  # Tiempo simulado [minutos]
        self.y = np.zeros(7)  # Salidas
        self.u = np.zeros(3)  # Entradas manipuladas
        self.d = np.zeros(2)  # Perturbaciones medidas
        self.u_setpoint = np.array([0.0, 0.0])  # Setpoints [y1_sp, y2_sp]

        # Históricos (buffer circular)
        self.history_size = 1000
        self.y_history = deque(maxlen=self.history_size)
        self.u_history = deque(maxlen=self.history_size)
        self.d_history = deque(maxlen=self.history_size)
        self.t_history = deque(maxlen=self.history_size)

        # Alarmas
        self.alarms: List[Dict] = []
        self.max_alarms = 100

        # Fallo de analizadores
        self.analyzer_faults = {"y1": False, "y2": False}

        # Modo de ejecución
        self.running = False
        self.dt_simulation = 1.0  # Δt = 1 minuto

    def reset(self):
        """Reinicia simulación a estado inicial."""
        self.t = 0.0
        self.y = np.zeros(7)
        self.u = np.zeros(3)
        self.d = np.zeros(2)
        self.u_setpoint = np.array([0.0, 0.0])
        self.y_history.clear()
        self.u_history.clear()
        self.d_history.clear()
        self.t_history.clear()
        self.alarms.clear()
        self.fopdt_model.reset()
        self.constraint_checker.reset()
        self.uncertainty_manager.reset()

    def add_alarm(self, severity: str, title: str, message: str):
        """Añade alarma a lista."""
        alarm = {
            "timestamp": datetime.now().isoformat(),
            "severity": severity,  # "LL", "L", "H", "HH"
            "title": title,
            "message": message,
            "acknowledged": False,
        }
        self.alarms.append(alarm)
        if len(self.alarms) > self.max_alarms:
            self.alarms.pop(0)

    def get_state_dict(self) -> Dict:
        """Retorna estado completo para serialización."""
        # Información de motor
        engine = self.engine_factory.get_active_engine()

        return {
            "t": self.t,
            "y": self.y.tolist(),
            "u": self.u.tolist(),
            "d": self.d.tolist(),
            "u_setpoint": self.u_setpoint.tolist(),
            "analyzer_faults": self.analyzer_faults,
            "alarms": self.alarms[-20:],  # Últimas 20 alarmas
            "engine": {
                "active": engine.engine_name,
                "available_engines": {
                    "python": self.engine_factory.python_engine.is_available,
                    "octave": self.engine_factory.octave_engine.is_available,
                },
            },
        }


# Instancia global
sim_state = SimulationState()

# ============================================================================
# LOOP DE SIMULACIÓN
# ============================================================================


async def simulation_loop():
    """
    Loop principal de simulación (1 Hz).

    Ejecuta en background:
    1. Calcula acción de control MPC
    2. Aplica restricciones
    3. Simula paso FOPDT
    4. Actualiza alarmas
    """
    while sim_state.running:
        try:
            # Combina setpoints
            y_sp_full = np.zeros(7)
            y_sp_full[0] = sim_state.u_setpoint[0]
            y_sp_full[1] = sim_state.u_setpoint[1]

            # Obtiene ganancias reales con incertidumbre
            K_real = sim_state.uncertainty_manager.get_K_real()

            # Calcula control MPC
            engine = sim_state.engine_factory.get_active_engine()
            control_result = engine.compute_control(
                sim_state.y,
                y_sp_full,
                sim_state.u,
                sim_state.d,
                K_real,
            )

            if control_result["status"] == "ok" and control_result["u_optimal"] is not None:
                u_proposed = np.array(control_result["u_optimal"])
            else:
                logger.warning("Control MPC fallido, usando u=0")
                u_proposed = np.zeros(3)

            # Aplica restricciones
            constraint_result = sim_state.constraint_checker.check_constraints(
                u_proposed, sim_state.y
            )
            u_actual = constraint_result["u_limited"]

            # Detecta violaciones y genera alarmas
            if not constraint_result["is_feasible"]:
                violations = ConstraintFormatter.format_violations(
                    constraint_result["violations"]
                )
                for v in violations:
                    sim_state.add_alarm("H", "Restricción", v)

            # Simula paso FOPDT
            y_new = sim_state.fopdt_model.step(u_actual, sim_state.d)

            # Actualiza estado
            sim_state.y = y_new
            sim_state.u = u_actual
            sim_state.t += sim_state.dt_simulation

            # Registra histórico
            sim_state.t_history.append(sim_state.t)
            sim_state.y_history.append(sim_state.y.copy())
            sim_state.u_history.append(sim_state.u.copy())
            sim_state.d_history.append(sim_state.d.copy())

            # Chequea alarmas de salida
            if sim_state.y[6] < -0.5:  # y7 mínimo
                sim_state.add_alarm("H", "RC-5", "y7 por debajo de -0.5")

            # Espera hasta siguiente ciclo (1 Hz = 1 segundo)
            await asyncio.sleep(1.0)

        except Exception as e:
            logger.error(f"Error en simulation loop: {e}")
            await asyncio.sleep(1.0)


# ============================================================================
# REST ENDPOINTS
# ============================================================================


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "simulation_running": sim_state.running,
    }


@app.get("/api/state")
async def get_state():
    """Retorna estado completo del sistema."""
    return sim_state.get_state_dict()


@app.post("/api/control/setpoints")
async def set_setpoints(req: SetpointRequest):
    """Actualiza setpoints de control."""
    sim_state.u_setpoint = np.array([req.y1_sp, req.y2_sp])
    return {
        "success": True,
        "setpoints": sim_state.u_setpoint.tolist(),
    }


@app.post("/api/uncertainty")
async def set_uncertainty(req: UncertaintyRequest):
    """Actualiza vector de incertidumbre ε."""
    try:
        epsilons = np.array(req.epsilons)
        sim_state.uncertainty_manager.set_epsilons(epsilons)
        sim_state.fopdt_model.set_uncertainties(epsilons)
        return {
            "success": True,
            "epsilons": epsilons.tolist(),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/analyzer/fault")
async def set_analyzer_fault(req: AnalyzerFaultRequest):
    """Simula fallo de analizador."""
    sim_state.analyzer_faults[req.analyzer] = req.fault
    sim_state.mpc_controller.set_analyzer_fault(req.analyzer, req.fault)

    status = "fallido" if req.fault else "operativo"
    sim_state.add_alarm(
        "L" if req.fault else "H",
        "Analizador",
        f"Analizador {req.analyzer} ahora {status}",
    )

    return {
        "success": True,
        "analyzer": req.analyzer,
        "fault": req.fault,
    }


@app.get("/api/analysis/conditioning")
async def get_conditioning_analysis():
    """
    Retorna análisis de condicionamiento de G0 (submatriz 3×3).

    Ejecuta CondMin en Python (siempre) y en Octave (si disponible, async).
    """
    python_result = sim_state.scaling_analyzer.get_conditioning_info()

    # Octave async (no bloquea)
    octave_result = None
    octave_engine = sim_state.engine_factory.octave_engine
    if octave_engine.is_available:
        try:
            G0 = K_MATRIX[np.ix_([0, 1, 6], [0, 1, 2])]  # Submatriz 3×3
            octave_result = octave_engine.compute_scaling(G0)
        except Exception as e:
            logger.warning(f"Octave conditioning error: {e}")
            octave_result = {"status": "error", "msg": str(e)}

    return {
        "python": python_result,
        "octave": octave_result,
        "octave_available": octave_engine.is_available,
    }


@app.post("/api/scenario/load")
async def load_scenario(req: ScenarioRequest):
    """Carga uno de los 5 casos de prueba."""
    try:
        epsilons, d1, d2 = generate_test_case_epsilons(req.case)

        # Reinicia simulación
        sim_state.reset()

        # Aplica incertidumbres
        sim_state.uncertainty_manager.set_epsilons(epsilons)
        sim_state.fopdt_model.set_uncertainties(epsilons)

        # Aplica escalones en perturbaciones
        sim_state.d = np.array([d1, d2])

        sim_state.add_alarm(
            "L",
            "Escenario",
            f"Caso {req.case} cargado: ε={epsilons.tolist()}, d1={d1}, d2={d2}",
        )

        return {
            "success": True,
            "case": req.case,
            "epsilons": epsilons.tolist(),
            "d_disturbance": [d1, d2],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/simulation/start")
async def start_simulation(background_tasks: BackgroundTasks):
    """Inicia simulación."""
    if not sim_state.running:
        sim_state.running = True
        background_tasks.add_task(simulation_loop)
        return {"success": True, "message": "Simulación iniciada"}
    return {"success": False, "message": "Simulación ya en ejecución"}


@app.post("/api/simulation/stop")
async def stop_simulation():
    """Detiene simulación."""
    sim_state.running = False
    return {"success": True, "message": "Simulación detenida"}


@app.post("/api/simulation/reset")
async def reset_simulation():
    """Reinicia simulación."""
    sim_state.running = False
    await asyncio.sleep(0.5)  # Espera a que se detenga
    sim_state.reset()
    return {"success": True, "message": "Simulación reiniciada"}


@app.get("/api/engine/status")
async def get_engine_status():
    """Retorna estado de motores de cálculo."""
    return sim_state.engine_factory.get_engine_status()


@app.post("/api/engine/switch")
async def switch_engine(req: EngineSwitchRequest):
    """Cambia motor de cálculo en tiempo de ejecución."""
    result = sim_state.engine_factory.switch_engine(req.engine)
    return result


@app.get("/api/controller/info")
async def get_controller_info():
    """Retorna información del controlador activo."""
    engine = sim_state.engine_factory.get_active_engine()
    if hasattr(engine, 'get_controller_info'):
        return engine.get_controller_info()
    return {"error": "Engine actual no soporta info de controlador"}


@app.post("/api/controller/switch")
async def switch_controller(req: ControllerSwitchRequest):
    """
    Cambia entre controlador MPC centralizado y SISO descentralizado.

    Opciones:
    - 'mpc': Control Predictivo Multivariable (7CV×3MV)
    - 'decentralized': Control Descentralizado SISO (3 lazos PI independientes)
    """
    engine = sim_state.engine_factory.get_active_engine()
    if hasattr(engine, 'switch_controller'):
        result = engine.switch_controller(req.controller)

        # Agrega alarma informativa
        controller_name = "Descentralizado SISO" if req.controller == "decentralized" else "Centralizado MPC"
        sim_state.add_alarm(
            message=f"Controlador cambiado a: {controller_name}",
            severity="INFO",
            tag="CTRL-SYSTEM"
        )

        return result
    return {"success": False, "message": "Engine actual no soporta cambio de controlador"}


@app.get("/api/engine/benchmark")
async def run_benchmark():
    """Ejecuta benchmark comparativo Python vs Octave."""
    # Test simple: simular 5 pasos
    results = {
        "python": None,
        "octave": None,
        "delta": None,
        "timestamp": datetime.now().isoformat(),
    }

    try:
        # Test Python
        engine_python = sim_state.engine_factory.python_engine
        u_test = np.array([0.1, 0.1, 0.1])
        d_test = np.array([0.0, 0.0])

        start = time.time()
        for _ in range(5):
            _ = engine_python.simulate_step({}, u_test, d_test, dt=1.0)
        results["python"] = {
            "duration_ms": (time.time() - start) * 1000,
            "available": True,
        }
    except Exception as e:
        results["python"] = {"error": str(e), "available": False}

    try:
        # Test Octave
        engine_octave = sim_state.engine_factory.octave_engine
        if engine_octave.is_available:
            start = time.time()
            for _ in range(5):
                _ = engine_octave.simulate_step({}, u_test, d_test, dt=1.0)
            results["octave"] = {
                "duration_ms": (time.time() - start) * 1000,
                "available": True,
                "version": engine_octave.octave_version,
            }
        else:
            results["octave"] = {
                "available": False,
                "message": "GNU Octave no instalado",
            }
    except Exception as e:
        results["octave"] = {"error": str(e), "available": False}

    return results


# ============================================================================
# WEBSOCKET
# ============================================================================


@app.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket para streaming en tiempo real (1 Hz).

    Envía estado del sistema incluyendo y, u, d, alarmas, etc.
    """
    await websocket.accept()
    logger.info("Cliente WebSocket conectado")

    try:
        while True:
            # Construye mensaje con estado actual
            engine = sim_state.engine_factory.get_active_engine()

            # Calcula BW para estado actual
            bw_info = sim_state.bandwidth_analyzer.evaluate_bandwidth_compliance(
                TAU_MATRIX,
                Np=sim_state.mpc_controller.Np,
                Nc=sim_state.mpc_controller.Nc,
                dt=sim_state.dt_simulation,
            )

            # Obtiene información de condicionamiento
            conditioning_info = sim_state.scaling_analyzer.get_conditioning_info()

            message = {
                "t": float(sim_state.t),
                "y": sim_state.y.tolist(),
                "u": sim_state.u.tolist(),
                "d": sim_state.d.tolist(),
                "u_setpoint": sim_state.u_setpoint.tolist(),
                "analyzer_faults": {k: bool(v) for k, v in sim_state.analyzer_faults.items()},
                "alarms": sim_state.alarms[-10:],  # Últimas 10
                "engine": {"active": engine.engine_name},
                "bandwidth": {
                    "bw_ol": float(bw_info.get("bw_ol", 0)),
                    "bw_cl": float(bw_info.get("bw_cl", 0)),
                    "ratio": float(bw_info.get("ratio", 0)),
                    "compliant": bool(bw_info.get("compliant", False)),
                    "ratio_min": float(bw_info.get("ratio_min", 0)),
                    "ratio_max": float(bw_info.get("ratio_max", 1)),
                },
                "conditioning": {
                    "computed": conditioning_info.get("computed", False),
                    "kappa_original": float(conditioning_info.get("kappa_original", 0)),
                    "kappa_scaled": float(conditioning_info.get("kappa_scaled", 0)),
                    "sv_original": [float(x) for x in conditioning_info.get("sv_original", [])],
                    "sv_scaled": [float(x) for x in conditioning_info.get("sv_scaled", [])],
                    "L_diag": [float(x) for x in conditioning_info.get("L_diag", [])],
                    "R_diag": [float(x) for x in conditioning_info.get("R_diag", [])],
                },
                "history": {
                    "t": list(sim_state.t_history)[-200:],
                    "y": [y.tolist() for y in list(sim_state.y_history)[-200:]],
                    "u": [u.tolist() for u in list(sim_state.u_history)[-200:]],
                    "d": [d.tolist() for d in list(sim_state.d_history)[-200:]],
                },
            }

            await websocket.send_json(message)
            await asyncio.sleep(1.0)  # Envía cada segundo

    except Exception as e:
        import traceback
        logger.error(f"WebSocket error: {e}")
        logger.error(traceback.format_exc())
    finally:
        logger.info("Cliente WebSocket desconectado")


# ============================================================================
# STARTUP / SHUTDOWN
# ============================================================================


@app.on_event("startup")
async def startup_event():
    """Evento de startup."""
    logger.info("Backend SCADA iniciado")
    logger.info(f"Motor por defecto: Python")
    logger.info(f"Octave disponible: {sim_state.engine_factory.octave_engine.is_available}")


@app.on_event("shutdown")
async def shutdown_event():
    """Evento de shutdown."""
    sim_state.running = False
    logger.info("Backend SCADA cerrado")


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    import os
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info",
    )
