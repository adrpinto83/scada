# SCADA Fraccionadora — Shell Control Problem

Sistema SCADA completo para simulación y control de la **Fraccionadora de Petróleo Pesado** del Shell Control Problem (Sección 3.3) con motor de cálculo dual Python/Octave intercambiable en tiempo de ejecución.

## 🎯 Características

- **Simulación FOPDT completa**: Modelo 7×5 (7 salidas × 5 entradas) con tiempo muerto discreto (buffers FIFO)
- **Control MPC multivariable**: Seguimiento de setpoints + minimización de demanda de reflujo + rechazo de perturbaciones
- **Motor dual Python/Octave**: Switching en caliente sin reinicio del servidor
- **WebSocket en tiempo real**: Streaming 1 Hz de estado del proceso
- **Panel P&ID animado**: Visualización interactiva con códigos de colores dinámicos
- **Tendencias históricas**: Gráficas en tiempo real de CVs, MVs, DVs con bandas de restricción
- **Gestión de alarmas**: Severidad HH/H/L/LL con timestamps
- **Incertidumbre paramétrica**: Sliders de -1 a +1 para los 5 parámetros de incertidumbre
- **5 casos de prueba**: Escenarios predefinidos para validar control

## 📋 Requisitos

### Mínimos (Python nativo)
- **Python 3.11+**
- **Node.js 18+** (para frontend)
- **Git**

### Opcionales (para Octave)
- **GNU Octave 7.0+**
- **Paquetes Octave**: optim, signal

## ⚡ Inicio Rápido

### Opción 1: Docker Compose (Recomendado)

```bash
# Clona/descarga el proyecto
cd /home/adrpinto/scada

# Ejecuta con Docker Compose
docker-compose up -d

# Frontend:   http://localhost:3000
# Backend:    http://localhost:8000/api/health
```

### Opción 2: Instalación Manual

#### Backend

```bash
cd backend

# Crea entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/macOS
# o
venv\Scripts\activate     # Windows

# Instala dependencias
pip install -r requirements.txt

# Ejecuta backend
python main.py
# Escucha en: http://0.0.0.0:8000
```

#### Frontend

```bash
cd frontend

# Instala dependencias
npm install

# Ejecuta desarrollo (HMR habilitado)
npm run dev
# Accesible en: http://localhost:3000

# O build para producción
npm run build
npm run preview
```

## 🔌 Instalación de GNU Octave

### Linux / WSL (Debian/Ubuntu)
```bash
sudo apt update
sudo apt install octave octave-optim octave-signal

# Verifica instalación
octave --version
octave-cli --version
```

### macOS (Homebrew)
```bash
brew install octave
octave --version
```

### Windows
```powershell
winget install GNU.Octave

# Luego, desde línea de comandos de Octave:
octave
pkg install -forge optim
pkg install -forge signal
quit
```

## 📖 Uso

### Interfaz Web

1. **Abre** http://localhost:3000
2. **Presiona** "▶ Iniciar" para comenzar la simulación
3. **Ajusta** setpoints (y1_sp, y2_sp) en el panel operador
4. **Modifica** incertidumbres (ε₁-ε₅) con los sliders
5. **Carga** uno de los 5 casos de prueba (CASO 1-5)
6. **Cambia** motor activo (Python ↔ Octave) en el panel motor
7. **Monitorea** alarmas en tiempo real

### API REST

Todos los endpoints están documentados en `http://localhost:8000/docs` (Swagger).

#### Ejemplos principales:

```bash
# Obtener estado actual
curl http://localhost:8000/api/state

# Establecer setpoints
curl -X POST http://localhost:8000/api/control/setpoints \
  -H "Content-Type: application/json" \
  -d '{"y1_sp": 0.1, "y2_sp": -0.05}'

# Cambiar incertidumbre
curl -X POST http://localhost:8000/api/uncertainty \
  -H "Content-Type: application/json" \
  -d '{"epsilons": [0.5, -0.3, 0.0, 0.2, -0.1]}'

# Cambiar motor de cálculo
curl -X POST http://localhost:8000/api/engine/switch \
  -H "Content-Type: application/json" \
  -d '{"engine": "octave"}'

# Ejecutar benchmark
curl http://localhost:8000/api/engine/benchmark
```

### WebSocket

```javascript
// Conexión en tiempo real (automática en frontend)
const ws = new WebSocket('ws://localhost:8000/ws/realtime');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data contiene: t, y, u, d, alarms, bandwidth, history, etc.
  console.log(data);
};
```

## 🏗️ Arquitectura

### Backend (Python + FastAPI)

```
backend/
├── main.py                          # FastAPI app + WebSocket + endpoints
├── simulation/
│   ├── process_matrix.py            # Matrices FOPDT 7×5 (K, τ, θ, ΔK)
│   ├── fopdt_model.py               # Discretización Euler + buffers FIFO
│   └── uncertainty.py               # Gestión de ε₁-ε₅
├── control/
│   ├── controller.py                # MPC con CVXPY
│   └── constraints.py               # RC-1 a RC-6 enforcement
├── analysis/
│   └── bandwidth.py                 # BW_OL, BW_CL, validación OBJ-4
├── engines/                         # Motor dual
│   ├── base_engine.py               # Protocolo CalcEngine
│   ├── python_engine.py             # Implementación Python
│   ├── octave_engine.py             # Implementación Octave (subprocess)
│   └── engine_factory.py            # Factory + hot-swap
├── octave_scripts/                  # Scripts .m para Octave
│   ├── fopdt_step.m                 # Simulación FOPDT
│   ├── mpc_solve.m                  # Controlador MPC
│   ├── check_constraints.m          # Restricciones
│   ├── bandwidth_analysis.m         # Análisis BW
│   └── apply_uncertainty.m          # Incertidumbre
└── requirements.txt
```

### Frontend (React + TypeScript + Vite)

```
frontend/
├── src/
│   ├── App.tsx                      # Componente principal + layout
│   ├── types/
│   │   └── index.ts                 # Interfaces TypeScript
│   ├── hooks/
│   │   ├── useWebSocket.ts          # Conexión WebSocket con reconexión
│   │   └── useEngineStatus.ts       # Polling status motor
│   ├── components/
│   │   ├── PIDDiagram.tsx           # P&ID SVG interactivo
│   │   ├── Trends.tsx               # Gráficas tiempo real
│   │   ├── OperatorPanel.tsx        # Controles: setpoints, ε, casos
│   │   ├── AlarmPanel.tsx           # Listado de alarmas
│   │   └── EnginePanel.tsx          # Selector motor + benchmark
│   ├── App.css                      # Estilos (responsive)
│   ├── main.tsx                     # Entry point React
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── nginx.conf
```

## 🎮 Casos de Prueba

### CASO 1: Nominal + máximo disturbio
- ε₁=ε₂=ε₃=ε₄=ε₅=0 (sin incertidumbre)
- d1=+0.5, d2=+0.5 (máximo disturbio)
- **Esperado**: Control responde rápidamente, rechaza disturbios

### CASO 2: Mínima ganancia + mínimo disturbio
- ε₁=ε₂=ε₃=-1, ε₄=ε₅=+1 (ganancias reducidas)
- d1=-0.5, d2=-0.5 (máximo disturbio negativo)
- **Esperado**: Control más lento pero estable

### CASO 3: Ganancia heterogénea + mínimo disturbio
- ε₁=ε₃=ε₄=ε₅=+1, ε₂=-1 (ganancia u2 baja)
- d1=-0.5, d2=-0.5
- **Esperado**: Control desacoplado, posible oscilación en y2

### CASO 4: Máxima ganancia + disturbio mixto
- ε₁=ε₂=ε₃=ε₄=ε₅=+1 (todas las ganancias aumentadas)
- d1=-0.5, d2=+0.5 (disturbios opuestos)
- **Esperado**: Control agresivo, posible inestabilidad si MPC no está bien calibrado

### CASO 5: Desacoplamiento u1/u2
- ε₁=-1, ε₂=+1, ε₃=ε₄=ε₅=0
- d1=-0.5, d2=-0.5
- **Esperado**: Efecto acoplado en y1/y2 requiere coordinación

## 📊 Monitoreo del Sistema

### Restricciones (RC)

| Restricción | Descripción | Límite |
|------------|-------------|--------|
| RC-1 | Extracción Superior (u1) | [-0.5, +0.5] |
| RC-2 | Demanda Reflujo Fondo (u3) | [-0.5, +0.5] |
| RC-3 | Rate limit MV | ±0.05/min |
| RC-4 | Tiempo muestreo | 1 min |
| RC-5 | Temp Reflujo Fondo (y7) | ≥ -0.5 |
| RC-6 | Punto Final Superior (y1) | [-0.5, +0.5] |

### Objetivos (OBJ)

| Objetivo | Descripción | Métrica |
|---------|-------------|--------|
| OBJ-1 | Seguimiento setpoints y1, y2 | Error SS < 0.005 |
| OBJ-2 | Maximizar generación vapor | Minimizar u3 |
| OBJ-3 | Rechazo perturbaciones | Funciona con fallos analizador |
| OBJ-4 | Velocidad respuesta | 0.8 ≤ BW_CL/BW_OL ≤ 1.25 |

## 🔄 Motor Dual: Switching en Caliente

### Cambiar en HMI
1. Ve a "Motor de Cálculo"
2. Selecciona "Python" o "GNU Octave"
3. Simula­ción continúa **sin reinicio**

### Cambiar por variable de entorno
```bash
# Al arrancar backend, antes de crear instancia
export CALC_ENGINE=octave  # o python
python main.py
```

### Benchmark y Validación
```bash
# GET /api/engine/benchmark
# Ejecuta los 5 módulos en ambos motores
# Retorna tiempos de ejecución y delta numérico (debe ser < 1e-6)
curl http://localhost:8000/api/engine/benchmark | jq
```

## 🔧 Solución de Problemas

### CVXPY no instalado
```bash
pip install cvxpy
```

### Octave no detectado
- Verifica: `which octave-cli` (Linux/macOS) o `where octave` (Windows)
- Instala según sección **Instalación de GNU Octave**
- Establece `OCTAVE_BIN` en `.env`

### WebSocket falla a conectar
- Verifica firewall/proxy
- Backend debe escuchar en `0.0.0.0:8000`
- Frontend debe estar en `http://localhost:3000` (o con proxy Vite)

### MPC infeasible
- Reduce penalización de restricción en `controller.py`
- Aumenta horizonte control `Nc`
- Chequea que incertidumbre no sea extrema

## 📝 Documentación Adicional

- **Teórica**: Ver requisito original (Shell Control Problem, Sección 3.3)
- **API**: http://localhost:8000/docs (Swagger interactivo)
- **Código**: Comentarios en español en todos los archivos

## 🚀 Deployment

### Producción con Docker

```bash
# Build
docker-compose build

# Run
docker-compose up -d

# Logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop
docker-compose down
```

### Nginx (reverse proxy)

```nginx
upstream backend {
    server localhost:8000;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name scada.example.com;

    location / {
        proxy_pass http://frontend;
    }

    location /api {
        proxy_pass http://backend;
    }

    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 📄 Licencia

Este proyecto implementa el Shell Control Problem (referencia académica) con fines educativos.

## 👤 Autor

Desarrollado con Claude para demostrar dominio de:
- Simulación de procesos (FOPDT)
- Control multivariable (MPC)
- Arquitectura dual motor
- Full-stack web (FastAPI + React)
- Tiempo real (WebSocket)

---

**¿Problemas?** Abre un issue o revisa los logs del backend:
```bash
docker-compose logs backend
```
