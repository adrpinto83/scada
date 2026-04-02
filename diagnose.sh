#!/bin/bash
# Script de diagnóstico de conexión para SCADA

echo "════════════════════════════════════════"
echo "  SCADA - Diagnóstico de Conexión"
echo "════════════════════════════════════════"
echo ""

echo "1. Verificando servicios SCADA..."
echo "-----------------------------------"

# Backend
if curl -sf --max-time 3 http://localhost:8001/api/health > /dev/null 2>&1; then
    echo "✓ Backend (8001): OK"
    backend_status=$(curl -s http://localhost:8001/api/health)
    echo "  $backend_status"
else
    echo "✗ Backend (8001): NO RESPONDE"
fi

# Frontend
if curl -sf --max-time 3 http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Frontend (3000): OK"
else
    echo "✗ Frontend (3000): NO RESPONDE"
fi

echo ""
echo "2. Verificando procesos..."
echo "-----------------------------------"
ps aux | grep -E "(python main.py|vite)" | grep -v grep

echo ""
echo "3. Verificando puertos..."
echo "-----------------------------------"
netstat -tln 2>/dev/null | grep -E ":(8001|3000)" || ss -tln | grep -E ":(8001|3000)"

echo ""
echo "4. Verificando conexión a internet..."
echo "-----------------------------------"
if ping -c 2 8.8.8.8 > /dev/null 2>&1; then
    echo "✓ Conectividad IP: OK"
else
    echo "✗ Conectividad IP: FALLO"
fi

if ping -c 2 google.com > /dev/null 2>&1; then
    echo "✓ DNS: OK"
else
    echo "✗ DNS: FALLO"
fi

echo ""
echo "5. Configuración proxy..."
echo "-----------------------------------"
echo "HTTP_PROXY: ${HTTP_PROXY:-No configurado}"
echo "HTTPS_PROXY: ${HTTPS_PROXY:-No configurado}"
echo "NO_PROXY: ${NO_PROXY:-No configurado}"

echo ""
echo "6. Logs recientes..."
echo "-----------------------------------"
if [ -f /tmp/scada-backend.log ]; then
    echo "Backend (últimas 5 líneas):"
    tail -5 /tmp/scada-backend.log
fi

if [ -f /tmp/scada-frontend.log ]; then
    echo ""
    echo "Frontend (últimas 5 líneas):"
    tail -5 /tmp/scada-frontend.log
fi

echo ""
echo "════════════════════════════════════════"
echo "  Diagnóstico completado"
echo "════════════════════════════════════════"
