# Railway - Guía Rápida de Configuración

## Resumen

Tu proyecto ahora está listo para desplegarse en Railway con dos servicios separados.

## Pasos Rápidos

### 1. Backend (servicio 1)

En Railway:
1. New Service → GitHub Repo
2. Settings:
   - **Root Directory**: `backend`
   - **Watch Paths**: `backend/**`
3. Railway asignará automáticamente el puerto vía variable `PORT`
4. Copia la URL pública del backend (ej: `https://xxx.up.railway.app`)

### 2. Frontend (servicio 2)

En Railway:
1. New Service → GitHub Repo (mismo repositorio)
2. Settings:
   - **Root Directory**: `frontend`
   - **Watch Paths**: `frontend/**`
3. Variables → Raw Editor:
   ```env
   VITE_API_URL=https://TU-URL-BACKEND-AQUI.up.railway.app
   ```
4. Despliega

## Verificación

1. Abre la URL del frontend
2. Presiona F12 (consola del navegador)
3. Verifica que no haya errores de conexión
4. Prueba iniciar la simulación

## Cambios Realizados

### Backend (`/backend`)
- ✅ `Dockerfile`: Configurado para puerto dinámico
- ✅ `main.py`: Usa variable `PORT` de entorno
- ✅ `railway.toml`: Configuración de salud y reinicio

### Frontend (`/frontend`)
- ✅ `Dockerfile`: Acepta `VITE_API_URL` como build arg
- ✅ `src/config.ts`: Maneja URLs API/WebSocket
- ✅ `nginx.conf`: Simplificado para Railway
- ✅ Todos los componentes actualizados para usar `apiURL()`
- ✅ `railway.toml`: Configuración de nginx

## Solución Rápida de Problemas

### "Python 3 no encontrado"
- ✅ **YA SOLUCIONADO**: No uses `start.sh` en Railway
- Railway usa los Dockerfiles directamente

### Frontend no conecta al backend
1. Verifica `VITE_API_URL` en variables del frontend
2. No incluyas `/` al final de la URL
3. Asegúrate de usar la URL pública del backend

### WebSocket no conecta
1. La configuración automática convierte `https://` → `wss://`
2. Verifica en consola del navegador que la URL sea correcta

---

Para más detalles, ver `RAILWAY_DEPLOYMENT.md`
