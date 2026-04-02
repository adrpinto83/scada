#!/bin/bash
# Script de monitoreo para SCADA - Verifica y mantiene servicios activos

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BACKEND_URL="http://localhost:8001/api/health"
FRONTEND_URL="http://localhost:3000"
CHECK_INTERVAL=10  # segundos
MAX_FAILURES=3

backend_failures=0
frontend_failures=0

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  SCADA Monitor - Iniciado${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}\n"

check_backend() {
    if curl -sf --max-time 5 "$BACKEND_URL" > /dev/null 2>&1; then
        backend_failures=0
        return 0
    else
        ((backend_failures++))
        return 1
    fi
}

check_frontend() {
    if curl -sf --max-time 5 "$FRONTEND_URL" > /dev/null 2>&1; then
        frontend_failures=0
        return 0
    else
        ((frontend_failures++))
        return 1
    fi
}

restart_backend() {
    echo -e "${RED}⚠️  Backend no responde - Reiniciando...${NC}"
    pkill -f "python main.py" 2>/dev/null || true
    sleep 2
    cd /home/adrpinto/scada/scada/backend
    source venv/bin/activate
    nohup python main.py > /tmp/scada-backend.log 2>&1 &
    echo -e "${GREEN}✓ Backend reiniciado${NC}"
    backend_failures=0
}

restart_frontend() {
    echo -e "${RED}⚠️  Frontend no responde - Reiniciando...${NC}"
    pkill -f "vite" 2>/dev/null || true
    sleep 2
    cd /home/adrpinto/scada/scada/frontend
    nohup npm run dev > /tmp/scada-frontend.log 2>&1 &
    echo -e "${GREEN}✓ Frontend reiniciado${NC}"
    frontend_failures=0
}

# Monitoreo continuo
while true; do
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Verifica backend
    if check_backend; then
        echo -e "${timestamp} - ${GREEN}✓${NC} Backend OK"
    else
        echo -e "${timestamp} - ${RED}✗${NC} Backend error (failures: $backend_failures/$MAX_FAILURES)"
        if [ $backend_failures -ge $MAX_FAILURES ]; then
            restart_backend
        fi
    fi

    # Verifica frontend
    if check_frontend; then
        echo -e "${timestamp} - ${GREEN}✓${NC} Frontend OK"
    else
        echo -e "${timestamp} - ${RED}✗${NC} Frontend error (failures: $frontend_failures/$MAX_FAILURES)"
        if [ $frontend_failures -ge $MAX_FAILURES ]; then
            restart_frontend
        fi
    fi

    echo ""
    sleep $CHECK_INTERVAL
done
