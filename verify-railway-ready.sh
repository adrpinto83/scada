#!/bin/bash
# ============================================================
#  Script de Verificación Pre-Despliegue Railway
#  Verifica que todos los archivos necesarios estén listos
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Verificación Pre-Despliegue Railway - SCADA Project  ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

ERRORS=0

# Función para verificar archivos
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1 ${RED}(FALTA)${NC}"
        ((ERRORS++))
    fi
}

# Función para verificar directorios
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
    else
        echo -e "${RED}✗${NC} $1/ ${RED}(FALTA)${NC}"
        ((ERRORS++))
    fi
}

# Verificar estructura backend
echo -e "${BLUE}▶ Backend${NC}"
check_dir "backend"
check_file "backend/Dockerfile"
check_file "backend/railway.toml"
check_file "backend/requirements.txt"
check_file "backend/main.py"
echo ""

# Verificar estructura frontend
echo -e "${BLUE}▶ Frontend${NC}"
check_dir "frontend"
check_file "frontend/Dockerfile"
check_file "frontend/railway.toml"
check_file "frontend/package.json"
check_file "frontend/src/config.ts"
check_file "frontend/nginx.conf"
echo ""

# Verificar documentación
echo -e "${BLUE}▶ Documentación${NC}"
check_file "RAILWAY_DEPLOYMENT.md"
check_file "RAILWAY_SETUP_QUICK.md"
echo ""

# Verificar configuración de puerto dinámico en main.py
echo -e "${BLUE}▶ Verificaciones de Código${NC}"
if grep -q 'os.getenv("PORT"' backend/main.py; then
    echo -e "${GREEN}✓${NC} Backend usa PORT dinámico"
else
    echo -e "${RED}✗${NC} Backend no usa PORT dinámico"
    ((ERRORS++))
fi

# Verificar que config.ts existe en frontend
if [ -f "frontend/src/config.ts" ]; then
    echo -e "${GREEN}✓${NC} Frontend tiene config.ts"
else
    echo -e "${RED}✗${NC} Frontend no tiene config.ts"
    ((ERRORS++))
fi

# Verificar que Dockerfile del frontend acepta VITE_API_URL
if grep -q 'ARG VITE_API_URL' frontend/Dockerfile; then
    echo -e "${GREEN}✓${NC} Frontend Dockerfile acepta VITE_API_URL"
else
    echo -e "${RED}✗${NC} Frontend Dockerfile no acepta VITE_API_URL"
    ((ERRORS++))
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ Todo listo para desplegar en Railway!${NC}"
    echo ""
    echo -e "${YELLOW}Próximos pasos:${NC}"
    echo "1. Sube tus cambios a GitHub:"
    echo "   git add ."
    echo "   git commit -m 'Configuración para Railway'"
    echo "   git push"
    echo ""
    echo "2. Ve a railway.app y crea dos servicios:"
    echo "   - Backend (root: backend/)"
    echo "   - Frontend (root: frontend/)"
    echo ""
    echo "3. Lee RAILWAY_SETUP_QUICK.md para instrucciones detalladas"
    echo ""
else
    echo -e "${RED}✗ Se encontraron $ERRORS errores${NC}"
    echo -e "${YELLOW}Por favor corrige los errores antes de desplegar${NC}"
    exit 1
fi
