#!/bin/bash
# Script para iniciar automáticamente backend y frontend de SCADA

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  SCADA Fraccionadora — Inicializador${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}\n"

# Verifica que estamos en el directorio correcto
if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Error: Directorios backend/frontend no encontrados${NC}"
    exit 1
fi

# Limpia procesos anteriores
echo -e "${YELLOW}  Limpiando procesos anteriores...${NC}"
pkill -9 -f "python main.py" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "node" 2>/dev/null || true
sleep 2

# Función para limpiar procesos al salir
cleanup() {
    echo -e "\n${YELLOW}⏹️  Deteniendo servicios...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✓ Servicios detenidos${NC}"
}

trap cleanup EXIT INT TERM

# ============================================================================
# BACKEND
# ============================================================================
echo -e "${BLUE}📦 Iniciando BACKEND...${NC}"

cd "$BACKEND_DIR"

# Verifica/crea venv
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}  Creando virtual environment...${NC}"
    python3 -m venv venv
fi

# Activa venv e instala dependencias
source venv/bin/activate
if [ ! -f "venv/bin/uvicorn" ]; then
    echo -e "${YELLOW}  Instalando dependencias...${NC}"
    pip install -q -r requirements.txt
fi

# Inicia backend en background
echo -e "${GREEN}  ✓ Backend iniciado${NC}"
python main.py &
BACKEND_PID=$!

# Espera a que backend esté listo
echo -e "${YELLOW}  Esperando a que Backend esté listo...${NC}"
sleep 3

# Verifica que el proceso sigue vivo
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Error: Backend falló al iniciar${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ Backend listo en http://0.0.0.0:8000${NC}"

# ============================================================================
# FRONTEND
# ============================================================================
echo -e "\n${BLUE}📦 Iniciando FRONTEND...${NC}"

cd "$FRONTEND_DIR"

# Verifica/instala dependencias
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  Instalando dependencias npm...${NC}"
    npm install -q
fi

# Inicia frontend en background (puerto 5173)
echo -e "${GREEN}  ✓ Frontend iniciado${NC}"
VITE_PORT=5173 npm run dev -- --port 5173 &
FRONTEND_PID=$!

# Espera a que frontend esté listo
echo -e "${YELLOW}  Esperando a que Frontend esté listo...${NC}"
sleep 4

# Verifica que el proceso sigue vivo
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Error: Frontend falló al iniciar${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ Frontend listo en http://localhost:5173${NC}"

# ============================================================================
# RESUMEN
# ============================================================================
echo -e "\n${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ SCADA INICIADO CORRECTAMENTE${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}\n"

echo -e "${BLUE}URLs de Acceso:${NC}"
echo -e "  🌐 Frontend:   ${GREEN}http://localhost:5173${NC}"
echo -e "  🔌 Backend:    ${GREEN}http://0.0.0.0:8000${NC}"
echo -e "  📚 API Docs:   ${GREEN}http://localhost:8000/docs${NC}\n"

echo -e "${YELLOW}Procesos ejecutándose:${NC}"
echo -e "  Backend PID:  ${BACKEND_PID}"
echo -e "  Frontend PID: ${FRONTEND_PID}\n"

echo -e "${YELLOW}Presiona CTRL+C para detener todos los servicios${NC}"

# Espera indefinidamente
wait
