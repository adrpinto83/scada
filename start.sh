#!/bin/bash
# ============================================================
#  SCADA Fraccionadora — Script de Inicio
#  Shell Control Problem · UDO · Control Avanzado
# ============================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# ── Colores ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Banner ───────────────────────────────────────────────────
echo -e ""
echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}  ║   SCADA FRACCIONADORA — Shell Control Problem ║${NC}"
echo -e "${CYAN}${BOLD}  ║   UDO · Postgrado Automatización · 2024       ║${NC}"
echo -e "${CYAN}${BOLD}  ╚══════════════════════════════════════════════╝${NC}"
echo -e ""

# ── Verificar directorios ─────────────────────────────────────
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌  No se encontró: $BACKEND_DIR${NC}"
    exit 1
fi
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌  No se encontró: $FRONTEND_DIR${NC}"
    exit 1
fi

# ── Detectar Python 3 ────────────────────────────────────────
PYTHON=$(command -v python3 || command -v python)
if [ -z "$PYTHON" ]; then
    echo -e "${RED}❌  Python 3 no encontrado. Instálalo con:${NC}"
    echo -e "    sudo apt install python3 python3-venv python3-pip"
    exit 1
fi
PYTHON_VER=$($PYTHON --version 2>&1)
echo -e "${GREEN}✓  ${PYTHON_VER} detectado${NC}"

# ── Detectar Node / npm ──────────────────────────────────────
if ! command -v npm &>/dev/null; then
    echo -e "${RED}❌  npm no encontrado. Instálalo con:${NC}"
    echo -e "    sudo apt install nodejs npm"
    echo -e "    # o usando nvm: https://github.com/nvm-sh/nvm"
    exit 1
fi
echo -e "${GREEN}✓  $(node --version) / npm $(npm --version) detectados${NC}"

# ── Limpiar procesos previos ──────────────────────────────────
echo -e ""
echo -e "${YELLOW}⏹  Limpiando procesos previos...${NC}"
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# ── Cleanup al salir ─────────────────────────────────────────
cleanup() {
    echo -e ""
    echo -e "${YELLOW}⏹  Deteniendo servicios...${NC}"
    [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    wait 2>/dev/null
    echo -e "${GREEN}✓  Servicios detenidos. ¡Hasta luego!${NC}"
    echo -e ""
}
trap cleanup EXIT INT TERM

# ════════════════════════════════════════════════════════════
# BACKEND
# ════════════════════════════════════════════════════════════
echo -e ""
echo -e "${BLUE}${BOLD}▶  BACKEND (FastAPI + MPC)${NC}"

cd "$BACKEND_DIR"

# Crear virtual environment si no existe
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}   Creando entorno virtual Python...${NC}"
    $PYTHON -m venv venv
fi

# Activar venv
# shellcheck disable=SC1091
source venv/bin/activate

# Instalar dependencias si faltan
if ! python -c "import fastapi" 2>/dev/null; then
    echo -e "${YELLOW}   Instalando dependencias Python...${NC}"
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    echo -e "${GREEN}   ✓ Dependencias instaladas${NC}"
fi

# Verificar CVXPY (opcional pero importante para MPC)
if python -c "import cvxpy" 2>/dev/null; then
    echo -e "${GREEN}   ✓ CVXPY disponible — MPC activado${NC}"
else
    echo -e "${YELLOW}   ⚠  CVXPY no instalado — se usará controlador proporcional${NC}"
    echo -e "${YELLOW}      Para instalar: pip install cvxpy${NC}"
fi

# Iniciar backend
echo -e "${CYAN}   Iniciando servidor en http://0.0.0.0:8001 ...${NC}"
python main.py > /tmp/scada_backend.log 2>&1 &
BACKEND_PID=$!

# Esperar a que el backend esté listo (hasta 15 seg)
echo -ne "${YELLOW}   Esperando backend"
for i in $(seq 1 15); do
    sleep 1
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e ""
        echo -e "${RED}❌  Backend falló al iniciar. Ver log:${NC}"
        tail -20 /tmp/scada_backend.log
        exit 1
    fi
    if curl -s http://localhost:8001/health &>/dev/null || \
       curl -s http://localhost:8001/api/status &>/dev/null || \
       curl -s http://localhost:8001/ &>/dev/null; then
        break
    fi
    echo -ne "."
done
echo -e "${NC}"

echo -e "${GREEN}   ✓ Backend listo  →  http://localhost:8001${NC}"
echo -e "${CYAN}      API Docs     →  http://localhost:8001/docs${NC}"

# ════════════════════════════════════════════════════════════
# FRONTEND
# ════════════════════════════════════════════════════════════
echo -e ""
echo -e "${BLUE}${BOLD}▶  FRONTEND (React + Vite)${NC}"

cd "$FRONTEND_DIR"

# Instalar dependencias npm si faltan
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   Instalando dependencias npm...${NC}"
    npm install --silent
    echo -e "${GREEN}   ✓ Dependencias npm instaladas${NC}"
fi

# Iniciar frontend
echo -e "${CYAN}   Iniciando servidor en http://localhost:3000 ...${NC}"
npm run dev -- --port 3000 --host > /tmp/scada_frontend.log 2>&1 &
FRONTEND_PID=$!

# Esperar a que el frontend esté listo (hasta 20 seg)
echo -ne "${YELLOW}   Esperando frontend"
for i in $(seq 1 20); do
    sleep 1
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e ""
        echo -e "${RED}❌  Frontend falló al iniciar. Ver log:${NC}"
        tail -20 /tmp/scada_frontend.log
        exit 1
    fi
    if curl -s http://localhost:3000 &>/dev/null; then
        break
    fi
    echo -ne "."
done
echo -e "${NC}"

echo -e "${GREEN}   ✓ Frontend listo →  http://localhost:3000${NC}"

# ════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ════════════════════════════════════════════════════════════
echo -e ""
echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}  ║        ✅  SCADA INICIADO CORRECTAMENTE       ║${NC}"
echo -e "${CYAN}${BOLD}  ╚══════════════════════════════════════════════╝${NC}"
echo -e ""
echo -e "  🌐  Interfaz SCADA  →  ${GREEN}${BOLD}http://localhost:3000${NC}"
echo -e "  🔌  API Backend     →  ${BLUE}http://localhost:8001${NC}"
echo -e "  📚  Docs API        →  ${BLUE}http://localhost:8001/docs${NC}"
echo -e "  📄  Log Backend     →  /tmp/scada_backend.log"
echo -e "  📄  Log Frontend    →  /tmp/scada_frontend.log"
echo -e ""
echo -e "${YELLOW}  Presiona ${BOLD}Ctrl+C${NC}${YELLOW} para detener todos los servicios${NC}"
echo -e ""

# Mantener el script vivo
wait
