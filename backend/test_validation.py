"""
Script de validación para SCADA Fraccionadora.

Prueba:
  - Carga de modelos
  - Simulación FOPDT (5 pasos)
  - Control MPC
  - Restricciones
  - Análisis de ancho de banda
  - Motor dual Python/Octave (si Octave disponible)
  - Casos de prueba 1-5
"""

import sys
import numpy as np
from pathlib import Path

# Agrega backend al path
sys.path.insert(0, str(Path(__file__).parent))

from simulation.process_matrix import get_process_info, apply_uncertainty
from simulation.uncertainty import UncertaintyManager, generate_test_case_epsilons
from simulation.fopdt_model import FOPDTModel
from control.controller import MPCController
from control.constraints import ConstraintChecker, ConstraintFormatter
from analysis.bandwidth import BandwidthAnalyzer
from engines import get_engine_factory

# Colores para output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"


def print_header(text):
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}{text:^60}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")


def print_pass(msg):
    print(f"{GREEN}✓{RESET} {msg}")


def print_fail(msg):
    print(f"{RED}✗{RESET} {msg}")


def print_info(msg):
    print(f"{BLUE}ℹ{RESET} {msg}")


def test_process_matrix():
    """Valida carga de matriz del proceso."""
    print_header("Test 1: Carga de Matriz del Proceso")

    try:
        info = get_process_info()
        assert info["num_outputs"] == 7, "Debería haber 7 salidas"
        assert info["num_mv_inputs"] == 3, "Debería haber 3 MVs"
        assert info["num_dv_inputs"] == 2, "Debería haber 2 DVs"
        assert info["K_nominal"].shape == (7, 5), "Matriz K debe ser 7×5"
        assert info["tau"].shape == (7, 5), "Matriz τ debe ser 7×5"
        assert info["theta"].shape == (7, 5), "Matriz θ debe ser 7×5"

        print_pass("Matriz de proceso cargada correctamente")
        print_info(f"CVs: {info['num_outputs']}, MVs: {info['num_mv_inputs']}, DVs: {info['num_dv_inputs']}")
        return True
    except Exception as e:
        print_fail(f"Error en carga de matriz: {e}")
        return False


def test_uncertainty():
    """Valida gestión de incertidumbre."""
    print_header("Test 2: Gestión de Incertidumbre")

    try:
        manager = UncertaintyManager()
        manager.set_epsilons(np.array([0.5, -0.3, 0.0, 0.2, -0.5]))
        K_real = manager.get_K_real()

        assert K_real.shape == (7, 5), "K_real debe ser 7×5"
        assert np.all(np.isfinite(K_real)), "K_real debe ser finita"

        print_pass("Incertidumbre aplicada correctamente")
        print_info(f"K_real[0,0] nominal: 4.05, con ε₁=0.5: {K_real[0, 0]:.3f}")
        return True
    except Exception as e:
        print_fail(f"Error en incertidumbre: {e}")
        return False


def test_fopdt_simulation():
    """Valida simulación FOPDT."""
    print_header("Test 3: Simulación FOPDT")

    try:
        model = FOPDTModel(dt=1.0)
        u = np.array([0.1, 0.0, 0.0])
        d = np.array([0.0, 0.0])

        # Simula 5 pasos
        y_trajectory = []
        for step in range(5):
            y = model.step(u, d)
            y_trajectory.append(y.copy())
            assert y.shape == (7,), "y debe ser vector 7"
            assert np.all(np.isfinite(y)), "y debe ser finita"

        print_pass("Simulación FOPDT completada (5 pasos)")
        print_info(f"t=0: y1={y_trajectory[0][0]:.4f}")
        print_info(f"t=5: y1={y_trajectory[-1][0]:.4f}")
        return True
    except Exception as e:
        print_fail(f"Error en FOPDT: {e}")
        return False


def test_constraints():
    """Valida verificación de restricciones."""
    print_header("Test 4: Verificación de Restricciones")

    try:
        checker = ConstraintChecker()

        # Caso 1: Entrada dentro de límites
        u_ok = np.array([0.3, 0.2, 0.1])
        y = np.zeros(7)
        result = checker.check_constraints(u_ok, y)
        assert result["is_feasible"], "Entrada dentro de límites debe ser factible"
        print_pass("Restricción RC-1/2 OK para entrada dentro de límites")

        # Caso 2: Entrada fuera de límites
        u_over = np.array([0.7, 0.2, 0.1])
        result = checker.check_constraints(u_over, y)
        assert not result["is_feasible"], "Entrada fuera de límites debe ser infactible"
        assert result["u_limited"][0] <= 0.5, "u1 debe saturarse a ≤ 0.5"
        print_pass("Saturación RC-1/2 funcionando")

        # Caso 3: Rate limit
        checker.u_prev = np.array([0.0, 0.0, 0.0])
        u_jump = np.array([0.1, 0.1, 0.1])
        result = checker.check_constraints(u_jump, y)
        # Después de rate limit
        du = result["u_limited"] - np.array([0.0, 0.0, 0.0])
        assert np.all(np.abs(du) <= 0.05), "Rate limit debe limitar cambios a ±0.05"
        print_pass("Rate limit RC-3 funcionando")

        return True
    except Exception as e:
        print_fail(f"Error en restricciones: {e}")
        return False


def test_bandwidth():
    """Valida análisis de ancho de banda."""
    print_header("Test 5: Análisis de Ancho de Banda")

    try:
        from simulation.process_matrix import TAU_MATRIX
        analyzer = BandwidthAnalyzer(dt=1.0)

        result = analyzer.evaluate_bandwidth_compliance(TAU_MATRIX, Np=15, Nc=5, dt=1.0)

        assert "bw_ol" in result, "Debe incluir BW_OL"
        assert "bw_cl" in result, "Debe incluir BW_CL"
        assert "ratio" in result, "Debe incluir ratio"
        assert "compliant" in result, "Debe incluir cumplimiento"

        compliant = "Cumple" if result["compliant"] else "No cumple"
        print_pass(f"Análisis BW completado: BW_OL={result['bw_ol']:.4f}")
        print_info(f"BW_CL={result['bw_cl']:.4f}, Ratio={result['ratio']:.3f}")
        print_info(f"OBJ-4: {compliant} [{result['ratio_min']}, {result['ratio_max']}]")
        return True
    except Exception as e:
        print_fail(f"Error en análisis BW: {e}")
        return False


def test_mpc_control():
    """Valida controlador MPC."""
    print_header("Test 6: Controlador MPC")

    try:
        controller = MPCController(Np=15, Nc=5, dt=1.0)
        from simulation.process_matrix import K_MATRIX

        y = np.zeros(7)
        y_sp = np.array([0.1, -0.05, 0, 0, 0, 0, 0])
        u_prev = np.zeros(3)
        d = np.zeros(2)

        result = controller.compute_control(y, y_sp, u_prev, d, K_MATRIX)

        assert "u_optimal" in result, "Debe retornar u_optimal"
        assert result["status"] in ["ok", "infeasible"], "Status debe ser válido"

        u_opt = result["u_optimal"]
        assert len(u_opt) == 3, "u_optimal debe tener 3 elementos"
        assert np.all(np.abs(u_opt) <= 0.5), "MV debe respetar límites"

        print_pass("MPC completado correctamente")
        print_info(f"u_optimal = {[f'{u:.4f}' for u in u_opt]}")
        print_info(f"Cost = {result.get('cost', 'N/A')}")
        return True
    except Exception as e:
        print_fail(f"Error en MPC: {e}")
        return False


def test_dual_engine():
    """Valida motor dual Python/Octave."""
    print_header("Test 7: Motor Dual Python/Octave")

    try:
        factory = get_engine_factory()

        # Status del motor
        status = factory.get_engine_status()
        print_pass("Motor Python disponible" if status["python_available"] else "Motor Python no disponible")

        if status["octave_available"]:
            print_pass("Motor Octave disponible")
            print_info(f"Versión: {status['octave_version']}")
        else:
            print_info("Octave no instalado (fallback a Python)")

        # Test switching
        engine = factory.get_active_engine()
        print_pass(f"Motor activo: {engine.engine_name}")

        return True
    except Exception as e:
        print_fail(f"Error en motor dual: {e}")
        return False


def test_test_cases():
    """Valida carga de los 5 casos de prueba."""
    print_header("Test 8: Casos de Prueba")

    try:
        results = []
        for case_num in range(1, 6):
            epsilons, d1, d2 = generate_test_case_epsilons(case_num)

            # Valida epsilons
            assert epsilons.shape == (5,), f"Caso {case_num}: epsilons debe ser vector 5"
            assert np.all(np.abs(epsilons) <= 1.0), f"Caso {case_num}: epsilons fuera de rango"

            # Valida disturbios
            assert -0.5 <= d1 <= 0.5, f"Caso {case_num}: d1 fuera de rango"
            assert -0.5 <= d2 <= 0.5, f"Caso {case_num}: d2 fuera de rango"

            results.append((case_num, epsilons, d1, d2))
            print_pass(f"CASO {case_num}: ε={epsilons.tolist()}, d1={d1}, d2={d2}")

        return True
    except Exception as e:
        print_fail(f"Error en casos de prueba: {e}")
        return False


def test_end_to_end():
    """Test E2E completo: un paso de simulación + control."""
    print_header("Test 9: End-to-End (Simulación + Control)")

    try:
        # Carga modelos
        model = FOPDTModel(dt=1.0)
        controller = MPCController(Np=15, Nc=5, dt=1.0)
        constraint_checker = ConstraintChecker()
        uncertainty_manager = UncertaintyManager()

        from simulation.process_matrix import K_MATRIX

        # Loop simulado: 10 pasos
        u = np.zeros(3)
        d = np.array([0.2, -0.1])
        y_sp = np.array([0.1, -0.05, 0, 0, 0, 0, 0])

        for step in range(10):
            # Obtiene ganancias reales
            K_real = uncertainty_manager.get_K_real()

            # Calcula control
            control_result = controller.compute_control(y, y_sp, u, d, K_real)
            if control_result["status"] != "ok":
                print_fail(f"Paso {step}: Control fallido")
                return False

            # Aplica restricciones
            u_proposed = np.array(control_result["u_optimal"])
            constraint_result = constraint_checker.check_constraints(u_proposed, model.y)
            u_actual = constraint_result["u_limited"]

            # Simula paso
            y = model.step(u_actual, d)
            u = u_actual

        print_pass("Simulación E2E completada (10 pasos sin errores)")
        print_info(f"y final = {y.tolist()}")
        return True
    except Exception as e:
        print_fail(f"Error en E2E: {e}")
        return False


def main():
    """Ejecuta todos los tests."""
    print(f"\n{BOLD}{BLUE}VALIDACIÓN — SCADA FRACCIONADORA{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")

    tests = [
        ("Carga Matriz Proceso", test_process_matrix),
        ("Gestión Incertidumbre", test_uncertainty),
        ("Simulación FOPDT", test_fopdt_simulation),
        ("Restricciones RC-1/2/3", test_constraints),
        ("Análisis Ancho de Banda", test_bandwidth),
        ("Controlador MPC", test_mpc_control),
        ("Motor Dual Python/Octave", test_dual_engine),
        ("Casos de Prueba 1-5", test_test_cases),
        ("End-to-End Simulación+Control", test_end_to_end),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            passed = test_func()
            results.append((test_name, passed))
        except Exception as e:
            print_fail(f"Error no capturado: {e}")
            results.append((test_name, False))

    # Resumen
    print_header("RESUMEN DE VALIDACIÓN")
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)

    for test_name, passed in results:
        status = f"{GREEN}PASÓ{RESET}" if passed else f"{RED}FALLÓ{RESET}"
        print(f"  {test_name:40s} ... {status}")

    print(f"\n{BOLD}Total: {passed_count}/{total_count}{RESET}\n")

    if passed_count == total_count:
        print(f"{GREEN}{BOLD}✓ VALIDACIÓN COMPLETA - SISTEMA LISTO{RESET}\n")
        return 0
    else:
        print(f"{RED}{BOLD}✗ VALIDACIÓN INCOMPLETA - REVISAR ERRORES{RESET}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
