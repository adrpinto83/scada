/**
 * TypeScript tipos para SCADA Fraccionadora
 */

export interface CVState {
  y1: number; // Punto Final Superior
  y2: number; // Punto Final Lateral
  y3: number; // Temperatura Superior
  y4: number; // Temperatura Reflujo Superior
  y5: number; // Temperatura Extracción Lateral
  y6: number; // Temperatura Reflujo Intermedio
  y7: number; // Temperatura Reflujo Fondo
}

export interface MVState {
  u1: number; // Extracción Superior
  u2: number; // Extracción Lateral
  u3: number; // Demanda Reflujo Fondo
}

export interface DVState {
  d1: number; // Demanda Reflujo Intermedio
  d2: number; // Demanda Reflujo Superior
}

export interface ProcessState {
  t: number; // Tiempo simulado [min]
  y: number[]; // 7 CVs
  u: number[]; // 3 MVs
  d: number[]; // 2 DVs
  u_setpoint: number[]; // [y1_sp, y2_sp]
  analyzer_faults: {
    y1: boolean;
    y2: boolean;
  };
  alarms: Alarm[];
  engine: {
    active: "python" | "octave";
  };
  bandwidth?: BandwidthInfo;
  history?: {
    t: number[];
    y: number[][];
    u: number[][];
    d: number[][];
  };
}

export interface Alarm {
  timestamp: string;
  severity: "LL" | "L" | "H" | "HH";
  title: string;
  message: string;
  acknowledged: boolean;
}

export interface BandwidthInfo {
  bw_ol: number;
  bw_cl: number;
  ratio: number;
  compliant: boolean;
  ratio_min: number;
  ratio_max: number;
}

export interface EngineStatus {
  active: "python" | "octave";
  active_is_fallback: boolean;
  python_available: boolean;
  octave_available: boolean;
  octave_bin?: string;
  octave_version?: string;
  octave_timeout_s: number;
}

export interface UncertaintyValues {
  epsilon1: number; // ε₁ (u1)
  epsilon2: number; // ε₂ (u2)
  epsilon3: number; // ε₃ (u3)
  epsilon4: number; // ε₄ (d1)
  epsilon5: number; // ε₅ (d2)
}

export interface ControlParams {
  y1_sp: number;
  y2_sp: number;
  epsilons: UncertaintyValues;
  analyzer_faults: {
    y1: boolean;
    y2: boolean;
  };
}

export interface Scenario {
  case: number;
  epsilons: number[];
  d_disturbance: [number, number];
}
