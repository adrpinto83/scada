# ⚡ Guía de Inicio Rápido

## 1. Validación (5 minutos)

```bash
cd backend
pip install -r requirements.txt
python test_validation.py

# Esperado: ✓ VALIDACIÓN COMPLETA
```

## 2. Opción A: Docker (Recomendado)

```bash
cd /home/adrpinto/scada

docker-compose up -d

# Espera 10 segundos a que arranque
sleep 10

# Abre navegador:
# Frontend:  http://localhost:3000
# API Docs:  http://localhost:8000/docs

# Detener:
docker-compose down
```

## 3. Opción B: Manual (Desarrollo)

### Terminal 1 - Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # o venv\Scripts\activate en Windows
pip install -r requirements.txt
python main.py

# Escucha en http://0.0.0.0:8000
```

### Terminal 2 - Frontend
```bash
cd frontend
npm install
npm run dev

# Accesible en http://localhost:3000
```

## 4. Primeros Pasos en HMI

1. **Abre** http://localhost:3000
2. **Presiona** "▶ Iniciar" para comenzar simulación
3. **Carga** "CASO 1" en panel operador
4. **Observa** P&ID y tendencias actualizándose
5. **Modifica** setpoints: y1_sp=0.1, y2_sp=-0.05
6. **Ajusta** sliders de incertidumbre ε₁-ε₅
7. **Alterna** motor: Python ↔ Octave (si Octave instalado)
8. **Ejecuta** Benchmark para comparar velocidades

## 5. API REST (curl ejemplos)

```bash
# Estado actual
curl http://localhost:8000/api/state | jq

# Cambiar setpoints
curl -X POST http://localhost:8000/api/control/setpoints \
  -H "Content-Type: application/json" \
  -d '{"y1_sp": 0.15, "y2_sp": -0.08}'

# Cambiar motor
curl -X POST http://localhost:8000/api/engine/switch \
  -H "Content-Type: application/json" \
  -d '{"engine": "octave"}'  # Requiere Octave instalado

# Cargar CASO 2
curl -X POST http://localhost:8000/api/scenario/load \
  -H "Content-Type: application/json" \
  -d '{"case": 2}'
```

## 6. WebSocket (Node.js)

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/realtime');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`t=${data.t}, y1=${data.y[0]}, alarms=${data.alarms.length}`);
};
```

## 7. Instalar Octave (Opcional)

### Linux/WSL
```bash
sudo apt update && sudo apt install octave octave-optim octave-signal
```

### macOS
```bash
brew install octave
```

### Windows
```powershell
winget install GNU.Octave
# Luego: octave > pkg install -forge optim signal > quit
```

## 8. Troubleshooting

| Problema | Solución |
|---------|---------|
| Port 8000 ya en uso | `lsof -i :8000` (Linux) o cambiar puerto en `main.py` |
| WebSocket no conecta | Verifica firewall/proxy, URL debe ser `ws://localhost:8000` |
| CVXPY no encontrado | `pip install cvxpy` |
| Octave no encontrado | Instálalo (ver sección 7) o úsalo con Docker |
| Frontend no carga | Verifica `npm install` completó, limpia caché del navegador |

## 9. Documentación Completa

- **README.md** — Descripción arquitectura, API endpoints, deployment
- **test_validation.py** — Test suite con 9 validaciones
- **http://localhost:8000/docs** — Swagger UI (cuando backend corre)

## 10. Estructura Proyecto

```
scada/
├── backend/
│   ├── main.py                    ← FastAPI app
│   ├── simulation/fopdt_model.py  ← Modelo proceso
│   ├── control/controller.py      ← MPC controller
│   ├── engines/                   ← Motor dual Python/Octave
│   └── test_validation.py         ← Test suite
├── frontend/
│   ├── src/App.tsx                ← React app principal
│   ├── src/components/            ← Componentes (P&ID, Trends, etc)
│   └── src/hooks/                 ← Custom hooks (WebSocket, etc)
├── README.md                       ← Docs completa
├── QUICK_START.md                 ← Este archivo
├── docker-compose.yml             ← Orquestación containers
└── .env.example                   ← Variables de entorno
```

---

**¿Listo?** Ejecuta `docker-compose up` y ve a http://localhost:3000 🚀
