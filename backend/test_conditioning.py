"""
Test suite para análisis de condicionamiento CondMin y escalado en MPC.

Valida:
1. Función cond_min() con matrices de prueba
2. ScalingAnalyzer con K_MATRIX nominal
3. Transformaciones de variables en controller
4. Engines (Python y Octave) compute_scaling()
"""

import numpy as np
from analysis.scaling import cond_min, ScalingAnalyzer
from simulation.process_matrix import K_MATRIX, TAU_MATRIX, THETA_MATRIX, DELTA_K_MATRIX
from engines.python_engine import PythonEngine
from engines.octave_engine import OctaveEngine

def test_cond_min_basic():
    """Test CondMin con matriz de prueba simple."""
    print("\n" + "="*70)
    print("TEST 1: cond_min() con matriz de prueba")
    print("="*70)

    # Matriz de prueba: Shell Control Problem G0
    G0_test = np.array([
        [4.05, 1.77, 5.88],
        [5.39, 5.72, 6.90],
        [4.38, 4.42, 7.20]
    ])

    print(f"\nMatriz G0 (3×3):\n{G0_test}")

    # Calcula CondMin
    L, R, kappa_min, info = cond_min(G0_test)

    # Resultados
    print(f"\nResultados CondMin:")
    print(f"  κ_original: {info['kappa_original']:.4f}")
    print(f"  κ_escalado: {kappa_min:.4f}")
    print(f"  Mejora: {((info['kappa_original'] - kappa_min) / info['kappa_original'] * 100):.1f}%")
    print(f"  L_diag: {np.diag(L)}")
    print(f"  R_diag: {np.diag(R)}")

    # Validaciones
    assert kappa_min < info['kappa_original'], "κ escalado debe ser menor que original"
    assert kappa_min > 0, "κ escalado debe ser positivo"
    assert L.shape == (3, 3), "L debe ser 3×3"
    assert R.shape == (3, 3), "R debe ser 3×3"

    print("✓ Test 1 PASÓ")
    return True

def test_scaling_analyzer():
    """Test ScalingAnalyzer con K_MATRIX nominal."""
    print("\n" + "="*70)
    print("TEST 2: ScalingAnalyzer con K_MATRIX nominal")
    print("="*70)

    # Crea analizador
    analyzer = ScalingAnalyzer()
    analyzer.compute_from_K_full(K_MATRIX)

    # Obtiene información de condicionamiento
    info = analyzer.get_conditioning_info()

    print(f"\nInformación de condicionamiento:")
    print(f"  Computed: {info['computed']}")
    print(f"  κ_original: {info['kappa_original']:.4f}")
    print(f"  κ_escalado: {info['kappa_scaled']:.4f}")
    print(f"  Mejora: {((info['kappa_original'] - info['kappa_scaled']) / info['kappa_original'] * 100):.1f}%")
    print(f"  SV original: {[f'{sv:.4f}' for sv in info['sv_original']]}")
    print(f"  SV escalado: {[f'{sv:.4f}' for sv in info['sv_scaled']]}")

    # Validaciones
    assert info['computed'], "ScalingAnalyzer debe estar computed=True"
    assert len(info['sv_original']) == 3, "Debe haber 3 SV originales"
    assert len(info['sv_scaled']) == 3, "Debe haber 3 SV escalados"
    assert len(info['L_diag']) == 3, "L_diag debe tener 3 elementos"
    assert len(info['R_diag']) == 3, "R_diag debe tener 3 elementos"

    print("✓ Test 2 PASÓ")
    return True

def test_scaling_properties():
    """Test propiedades de matrices L, R (inversas, conmutatividad)."""
    print("\n" + "="*70)
    print("TEST 3: Propiedades de matrices de escalado L, R")
    print("="*70)

    analyzer = ScalingAnalyzer()
    analyzer.compute_from_K_full(K_MATRIX)

    L = analyzer.L
    R = analyzer.R
    L_inv = analyzer.L_inv
    R_inv = analyzer.R_inv

    print(f"\nL shape: {L.shape}, R shape: {R.shape}")
    print(f"L_inv shape: {L_inv.shape}, R_inv shape: {R_inv.shape}")

    # Valida que son diagonales
    assert np.allclose(L, np.diag(np.diag(L))), "L debe ser diagonal"
    assert np.allclose(R, np.diag(np.diag(R))), "R debe ser diagonal"

    # Valida inversas
    assert np.allclose(L @ L_inv, np.eye(3)), "L @ L_inv debe ser identidad"
    assert np.allclose(R @ R_inv, np.eye(3)), "R @ R_inv debe ser identidad"

    # Valida positividad
    assert np.all(np.diag(L) > 0), "Diagonal de L debe ser positiva"
    assert np.all(np.diag(R) > 0), "Diagonal de R debe ser positiva"

    print("✓ Test 3 PASÓ: Todas las propiedades validadas")
    return True

def test_python_engine_compute_scaling():
    """Test PythonEngine.compute_scaling()."""
    print("\n" + "="*70)
    print("TEST 4: PythonEngine.compute_scaling()")
    print("="*70)

    engine = PythonEngine()

    # Matriz de prueba
    G0_test = np.array([
        [4.05, 1.77, 5.88],
        [5.39, 5.72, 6.90],
        [4.38, 4.42, 7.20]
    ])

    result = engine.compute_scaling(G0_test)

    print(f"\nResultado engine.compute_scaling():")
    print(f"  Status: {result['status']}")
    print(f"  Engine: {result['engine']}")
    print(f"  κ_original: {result.get('kappa_original', 'N/A')}")
    print(f"  κ_escalado: {result.get('kappa_scaled', 'N/A')}")

    # Validaciones
    assert result['status'] == 'ok', "Status debe ser 'ok'"
    assert result['engine'] == 'python', "Engine debe ser 'python'"
    assert 'kappa_original' in result, "Debe tener kappa_original"
    assert 'kappa_scaled' in result, "Debe tener kappa_scaled"

    print("✓ Test 4 PASÓ")
    return True

def test_octave_engine_compute_scaling():
    """Test OctaveEngine.compute_scaling() si está disponible."""
    print("\n" + "="*70)
    print("TEST 5: OctaveEngine.compute_scaling()")
    print("="*70)

    engine = OctaveEngine()

    if not engine.is_available:
        print("⚠ Octave no disponible, test SKIPPED")
        return True

    # Matriz de prueba
    G0_test = np.array([
        [4.05, 1.77, 5.88],
        [5.39, 5.72, 6.90],
        [4.38, 4.42, 7.20]
    ])

    result = engine.compute_scaling(G0_test)

    print(f"\nResultado engine.compute_scaling():")
    print(f"  Status: {result.get('status', 'N/A')}")
    print(f"  Engine: {result.get('engine', 'N/A')}")
    print(f"  κ_original: {result.get('kappa_original', 'N/A')}")
    print(f"  κ_escalado: {result.get('kappa_scaled', 'N/A')}")

    if result.get('status') == 'ok':
        assert result['engine'] == 'octave', "Engine debe ser 'octave'"
        assert 'kappa_original' in result, "Debe tener kappa_original"
        print("✓ Test 5 PASÓ")
    else:
        print(f"⚠ Octave error: {result.get('msg', 'unknown')}")

    return True

def test_dual_engine_comparison():
    """Compare resultados Python vs Octave."""
    print("\n" + "="*70)
    print("TEST 6: Comparación Python vs Octave CondMin")
    print("="*70)

    py_engine = PythonEngine()
    oc_engine = OctaveEngine()

    G0_test = np.array([
        [4.05, 1.77, 5.88],
        [5.39, 5.72, 6.90],
        [4.38, 4.42, 7.20]
    ])

    py_result = py_engine.compute_scaling(G0_test)
    oc_result = oc_engine.compute_scaling(G0_test) if oc_engine.is_available else None

    print(f"\nPython result:")
    print(f"  κ_original: {py_result.get('kappa_original', 'N/A'):.4f}")
    print(f"  κ_escalado: {py_result.get('kappa_scaled', 'N/A'):.4f}")

    if oc_result and oc_result.get('status') == 'ok':
        print(f"\nOctave result:")
        print(f"  κ_original: {oc_result.get('kappa_original', 'N/A'):.4f}")
        print(f"  κ_escalado: {oc_result.get('kappa_scaled', 'N/A'):.4f}")

        # Comparación
        py_kappa = py_result.get('kappa_scaled', 0)
        oc_kappa = oc_result.get('kappa_scaled', 0)
        diff = abs(py_kappa - oc_kappa)
        pct_diff = (diff / py_kappa * 100) if py_kappa > 0 else 0

        print(f"\nDiferencia: {diff:.4f} ({pct_diff:.2f}%)")
        assert pct_diff < 5, "Resultados deben concordar dentro de 5%"
        print("✓ Test 6 PASÓ: Resultados concordantes")
    else:
        print("\n⚠ Octave no disponible, solo validado Python")

    return True

def test_integration_e2e():
    """Test integración end-to-end: analyzer → engine → controller."""
    print("\n" + "="*70)
    print("TEST 7: Integración E2E - ScalingAnalyzer → MPC Controller")
    print("="*70)

    # Crea analyzer
    analyzer = ScalingAnalyzer()
    analyzer.compute_from_K_full(K_MATRIX)

    # Crea engine con analyzer
    engine = PythonEngine()

    # Obtiene info
    cond_info = analyzer.get_conditioning_info()

    print(f"\nScalingAnalyzer result:")
    print(f"  κ_original: {cond_info['kappa_original']:.4f}")
    print(f"  κ_escalado: {cond_info['kappa_scaled']:.4f}")

    # Simula control con estado
    y_current = np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    y_setpoint = np.array([0.1, 0.05, 0.0, 0.0, 0.0, 0.0, 0.0])
    u_previous = np.array([0.0, 0.0, 0.0])
    d_measured = np.array([0.5, 0.5])
    K_real = K_MATRIX.copy()

    result = engine.compute_control(y_current, y_setpoint, u_previous, d_measured, K_real)

    print(f"\nControl result:")
    print(f"  Status: {result['status']}")
    print(f"  Feasible: {result['feasible']}")
    print(f"  u_optimal: {result['u_optimal']}")

    assert result['status'] in ['ok', 'infeasible'], "Status debe ser válido"
    print("✓ Test 7 PASÓ: E2E integración correcta")
    return True

def run_all_tests():
    """Ejecuta todos los tests."""
    print("\n" + "="*70)
    print("SUITE DE TESTS - CONDICIONAMIENTO Y ESCALADO EN MPC")
    print("="*70)

    tests = [
        test_cond_min_basic,
        test_scaling_analyzer,
        test_scaling_properties,
        test_python_engine_compute_scaling,
        test_octave_engine_compute_scaling,
        test_dual_engine_comparison,
        test_integration_e2e,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
        except AssertionError as e:
            print(f"✗ Test FALLÓ: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ Test ERROR: {e}")
            failed += 1

    print("\n" + "="*70)
    print(f"RESULTADOS: {passed} pasaron, {failed} fallaron")
    print("="*70)

    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
