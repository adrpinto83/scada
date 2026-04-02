# Guía de Despliegue en Railway

Este proyecto SCADA está configurado para desplegarse en Railway como **dos servicios separados**: Backend (FastAPI) y Frontend (React + nginx).

## Requisitos Previos

1. Cuenta en [Railway](https://railway.app/)
2. Proyecto Railway creado
3. Railway CLI instalado (opcional, pero recomendado)

## Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────┐
│                    Railway Project                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────┐    ┌──────────────────────┐ │
│  │   Backend Service     │    │  Frontend Service    │ │
│  │   (FastAPI + Python)  │    │   (React + nginx)    │ │
│  │                       │    │                      │ │
│  │  - Puerto: dinámico   │◄───┤  - Puerto: 3000      │ │
│  │  - Health: /api/health│    │  - Conecta vía URL   │ │
│  │  - WebSocket: /ws     │    │                      │ │
│  └───────────────────────┘    └──────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Pasos de Despliegue

### 1. Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app/) y crea un nuevo proyecto
2. Conecta tu repositorio GitHub

### 2. Crear Servicio Backend

1. En tu proyecto Railway, haz clic en **"New Service"**
2. Selecciona **"GitHub Repo"** y elige tu repositorio
3. Configura el servicio:
   - **Name**: `scada-backend`
   - **Root Directory**: `/backend`
   - **Dockerfile Path**: `backend/Dockerfile`

4. Configura las variables de entorno:
   - Railway asignará automáticamente `PORT`
   - No necesitas configurar nada más para el backend

5. Despliega el servicio y espera a que termine
6. **IMPORTANTE**: Copia la URL pública del backend (ejemplo: `https://scada-backend-production.up.railway.app`)

### 3. Crear Servicio Frontend

1. En tu proyecto Railway, haz clic en **"New Service"** nuevamente
2. Selecciona el mismo repositorio
3. Configura el servicio:
   - **Name**: `scada-frontend`
   - **Root Directory**: `/frontend`
   - **Dockerfile Path**: `frontend/Dockerfile`

4. Configura las variables de entorno:
   - Click en **"Variables"**
   - Añade la siguiente variable:
     ```
     VITE_API_URL=https://scada-backend-production.up.railway.app
     ```
     ⚠️ **IMPORTANTE**: Reemplaza la URL con la URL real de tu backend del paso 2.6
     ⚠️ **NO** incluyas una barra final `/` en la URL

5. En la configuración de build, añade el build argument:
   - Ve a **"Settings"** > **"Build"**
   - En **"Build Args"** añade:
     ```
     VITE_API_URL=$VITE_API_URL
     ```

6. Despliega el servicio

### 4. Verificar Despliegue

1. Abre la URL pública del frontend
2. Verifica que la aplicación cargue correctamente
3. Comprueba la consola del navegador (F12) para errores de conexión
4. Intenta:
   - Iniciar la simulación
   - Verificar que el WebSocket conecte
   - Cambiar setpoints
   - Cargar escenarios de prueba

## Configuración Opcional

### Health Checks

Railway verificará automáticamente:
- **Backend**: `GET /api/health` cada 60 segundos
- **Frontend**: `GET /` cada 60 segundos

### Logs

Para ver los logs:
```bash
# Backend
railway logs scada-backend

# Frontend
railway logs scada-frontend
```

### Reiniciar Servicios

```bash
# Backend
railway restart scada-backend

# Frontend
railway restart scada-frontend
```

## Solución de Problemas

### Frontend no conecta al backend

1. Verifica que `VITE_API_URL` esté configurada correctamente en las variables de entorno del frontend
2. Asegúrate de que la URL no tenga barra final `/`
3. Verifica que el backend esté desplegado y saludable
4. Revisa los logs del frontend: `railway logs scada-frontend`
5. Abre la consola del navegador (F12) y busca errores de CORS o red

### Backend falla al iniciar

1. Revisa los logs: `railway logs scada-backend`
2. Verifica que todas las dependencias en `requirements.txt` estén instaladas
3. Comprueba que el puerto se esté leyendo correctamente de la variable `PORT`

### WebSocket no conecta

1. Verifica que el frontend esté usando la URL correcta (debe convertir `https://` a `wss://`)
2. Revisa los logs del backend para ver intentos de conexión WebSocket
3. Comprueba que no haya problemas de CORS

### Build del frontend falla

1. Verifica que `VITE_API_URL` esté configurada en **Build Args**
2. Asegúrate de que `package.json` y `package-lock.json` estén actualizados
3. Revisa los logs de build en Railway

## Variables de Entorno

### Backend
- `PORT`: Puerto del servidor (asignado automáticamente por Railway)

### Frontend
- `VITE_API_URL`: URL completa del backend (ejemplo: `https://scada-backend-production.up.railway.app`)

## Estructura de Archivos Railway

```
/home/adrpinto/scada/scada/
├── backend/
│   ├── Dockerfile          # Dockerfile del backend
│   ├── railway.toml        # Configuración Railway backend
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── Dockerfile          # Dockerfile del frontend
│   ├── railway.toml        # Configuración Railway frontend
│   ├── package.json
│   └── src/
│       └── config.ts       # Configuración de URLs API/WS
└── .env.example            # Ejemplo de variables de entorno
```

## Comandos Útiles

```bash
# Ver status de todos los servicios
railway status

# Ver logs en tiempo real
railway logs --follow scada-backend
railway logs --follow scada-frontend

# Redeploy
railway up
```

## URLs de Producción

Después del despliegue, tendrás dos URLs:

- **Backend API**: `https://scada-backend-production.up.railway.app`
  - Docs: `https://scada-backend-production.up.railway.app/docs`
  - Health: `https://scada-backend-production.up.railway.app/api/health`

- **Frontend**: `https://scada-frontend-production.up.railway.app`

## Próximos Pasos

1. Configura un dominio personalizado (opcional)
2. Configura alertas de monitoreo
3. Habilita auto-despliegue desde GitHub
4. Considera agregar Redis para caché (opcional)

---

**Desarrollado para el Postgrado de Automatización e Informática Industrial - UDO**
