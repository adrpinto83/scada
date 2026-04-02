# 🚂 Próximos Pasos - Railway Deployment

## ✅ Completado
- [x] Código subido a GitHub (commit: 5776c15)
- [x] Dockerfiles configurados
- [x] Sistema de URLs dinámicas implementado

## 📋 Pasos para Railway (Hazlos en orden)

### Paso 1: Crear Proyecto en Railway

1. Ve a https://railway.app/
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza Railway para acceder a tu GitHub
5. Selecciona el repositorio: **adrpinto83/scada**

### Paso 2: Configurar Servicio Backend

Railway detectará automáticamente que hay Dockerfiles. Ahora:

1. Railway creará un servicio. Renómbralo a **"backend"**
2. Click en el servicio → **Settings**
3. Configura:
   - **Root Directory**: `backend`
   - **Watch Paths**: `backend/**`
   - **Health Check Path**: `/api/health`

4. El servicio se desplegará automáticamente
5. Espera a que termine el despliegue (verás "Success" en verde)
6. Click en el servicio → **Settings** → busca la URL pública
7. **COPIA LA URL** (ejemplo: `https://backend-production-xxxx.up.railway.app`)

### Paso 3: Configurar Servicio Frontend

1. En tu proyecto Railway, click en **"New Service"**
2. Selecciona **"GitHub Repo"** → mismo repositorio
3. Renombra el servicio a **"frontend"**
4. Click en Settings:
   - **Root Directory**: `frontend`
   - **Watch Paths**: `frontend/**`

5. **MUY IMPORTANTE**: Click en **"Variables"** tab
6. Click en **"RAW Editor"**
7. Pega esta línea (reemplaza con TU URL del backend del Paso 2.7):
   ```
   VITE_API_URL=https://backend-production-xxxx.up.railway.app
   ```
   ⚠️ **NO pongas `/` al final de la URL**

8. Click **"Save"** - el frontend se desplegará automáticamente

### Paso 4: Verificar Despliegue

#### Backend
1. Click en el servicio backend
2. Ve a la pestaña **"Deployments"**
3. Click en el deployment activo → **"View Logs"**
4. Busca esta línea:
   ```
   Backend SCADA iniciado
   Motor por defecto: Python
   ```
5. Prueba la URL del backend en tu navegador:
   - `https://TU-BACKEND-URL/api/health` → Debería mostrar `{"status":"ok"}`
   - `https://TU-BACKEND-URL/docs` → Debería mostrar FastAPI docs

#### Frontend
1. Click en el servicio frontend
2. Ve a **"Deployments"** → **"View Logs"**
3. Busca:
   ```
   ✓ built in XXs
   ```
4. Abre la URL pública del frontend
5. Presiona **F12** (consola del navegador)
6. Verifica que NO haya errores rojos de conexión

### Paso 5: Probar la Aplicación

1. Abre la URL del frontend
2. Click en **"INICIAR"** simulación
3. Verifica que:
   - ✅ El tiempo avanza (t = X.X min)
   - ✅ Los gráficos se actualizan
   - ✅ Los valores de y1, y2, etc. cambian
   - ✅ El panel de alarmas funciona

4. Prueba cambiar setpoints:
   - Panel derecho → Control
   - Cambia y1_sp y y2_sp
   - Click "Aplicar Setpoints"

## 🔍 Solución de Problemas

### "Build failed" en Backend
- Ve a Logs del deployment
- Busca errores en la instalación de dependencias
- Verifica que `requirements.txt` esté correcto

### "Build failed" en Frontend
- Verifica que `VITE_API_URL` esté configurada
- Ve a Settings → Variables → debe estar ahí
- Verifica que la URL del backend NO tenga `/` al final

### Frontend carga pero no conecta al backend
1. Abre la consola del navegador (F12)
2. Busca errores que digan:
   - `Failed to fetch` → La URL del backend está mal
   - `CORS error` → El backend no está corriendo
   - `WebSocket connection failed` → Verifica la URL en VITE_API_URL

3. Verifica:
   ```
   Variables del Frontend → VITE_API_URL → debe ser HTTPS (no HTTP)
   ```

### WebSocket no conecta
- El código convierte automáticamente `https://` → `wss://`
- Verifica en consola del navegador que la URL WebSocket sea correcta
- Debe ser: `wss://TU-BACKEND-URL/ws/realtime`

## 📊 Monitoreo

### Ver Logs en Tiempo Real
1. Click en el servicio → Deployments
2. Click en el deployment activo → View Logs
3. Los logs se actualizan en tiempo real

### Verificar Health Checks
- Railway verificará automáticamente cada 60 segundos
- Backend: GET `/api/health`
- Si falla 3 veces consecutivas, Railway reiniciará el servicio

## 🎯 URLs Finales

Después del despliegue tendrás:

- **Backend API**: `https://backend-production-xxxx.up.railway.app`
  - Docs: `/docs`
  - Health: `/api/health`
  - WebSocket: `/ws/realtime`

- **Frontend App**: `https://frontend-production-xxxx.up.railway.app`

## 💡 Tips

1. **Redeploy Manual**: Click en el servicio → Deployments → tres puntos → "Redeploy"
2. **Variables de Entorno**: Cambios requieren redeploy
3. **Logs Persistentes**: Railway guarda logs por 7 días
4. **Límite de Free Tier**: $5 USD/mes de créditos gratis

---

¿Problemas? Revisa `RAILWAY_DEPLOYMENT.md` para más detalles.
