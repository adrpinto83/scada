#!/bin/sh
# Entrypoint script para configurar nginx con puerto dinámico

# Usar PORT de variable de entorno o 3000 por defecto
PORT=${PORT:-3000}

echo "Configurando nginx en puerto $PORT..."

# Reemplazar ${PORT} en el template con el valor real
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Nginx configurado. Iniciando servidor..."

# Iniciar nginx
exec nginx -g 'daemon off;'
