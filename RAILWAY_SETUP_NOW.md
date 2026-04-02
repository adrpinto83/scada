# 🚂 Configurar Railway AHORA

## ✅ Proyecto Creado
- **Nombre**: scada-fraccionadora
- **URL**: https://railway.com/project/19ddb4fb-a869-49e4-bcde-8f9ad31284d9

## 📋 Pasos Siguientes (5 minutos)

### 1. Abrir el Proyecto en Railway

1. Abre: https://railway.com/project/19ddb4fb-a869-49e4-bcde-8f9ad31284d9
2. Deberías ver un proyecto vacío

### 2. Crear Servicio Backend

1. Click en **"+ New"** (esquina superior derecha)
2. Selecciona **"GitHub Repo"**
3. Busca y selecciona: **adrpinto83/scada**
4. Railway creará un servicio

Ahora configúralo:
1. Click en el servicio que acaba de crearse
2. Click en **"Settings"** (⚙️ icono arriba a la derecha)
3. En **"Service Name"**, cámbialo a: `backend`
4. Scroll down hasta **"Root Directory"**
   - Escribe: `backend`
5. Scroll down hasta **"Watch Paths"**
   - Click en "Configure"
   - Añade: `backend/**`
6. En **"Healthcheck Path"**:
   - Escribe: `/api/health`
7. Click en **"Deploy"** (arriba)

Espera 2-3 minutos a que compile y despliegue.

### 3. Copiar URL del Backend

1. Cuando termine el despliegue (verás ✓ Success)
2. Click en el servicio backend
3. Ve a la pestaña **"Settings"**
4. Busca **"Domains"** o **"Public Networking"**
5. Verás una URL como: `backend-production-xxxx.up.railway.app`
6. Click en **"Generate Domain"** si no existe
7. **COPIA ESTA URL COMPLETA** (la necesitarás para el frontend)

### 4. Verificar Backend

Abre en tu navegador:
```
https://TU-BACKEND-URL/api/health
```

Deberías ver:
```json
{"status":"ok","timestamp":"...","simulation_running":false}
```

Si ves eso: ✅ **Backend funcionando!**

### 5. Crear Servicio Frontend

1. En el proyecto, click en **"+ New"** nuevamente
2. Selecciona **"GitHub Repo"**
3. Selecciona el mismo repo: **adrpinto83/scada**
4. Railway creará otro servicio

Ahora configúralo:
1. Click en el nuevo servicio
2. Click en **"Settings"**
3. En **"Service Name"**, cámbialo a: `frontend`
4. En **"Root Directory"**: `frontend`
5. En **"Watch Paths"**: `frontend/**`

### 6. Configurar Variable de Entorno del Frontend

**MUY IMPORTANTE:**
1. En el servicio frontend, click en **"Variables"** tab
2. Click en **"+ New Variable"**
3. Añade:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://TU-BACKEND-URL-AQUI` (la que copiaste en el paso 3.7)
   - ⚠️ **SIN barra final** (NO pongas `/` al final)
4. Click en **"Add"**
5. El servicio se redespleará automáticamente

Espera 2-3 minutos.

### 7. Verificar Frontend

1. Cuando termine el despliegue
2. Click en el servicio frontend → Settings → Domains
3. Abre la URL del frontend en tu navegador
4. Presiona **F12** para abrir Developer Tools
5. Ve a la pestaña **"Console"**
6. **NO** deberías ver errores rojos

### 8. Probar la Aplicación

1. En la aplicación web, click en **"▶ INICIAR"**
2. Verifica que:
   - ✅ El tiempo avanza (t = 0.0 → 1.0 → 2.0...)
   - ✅ Los gráficos se dibujan
   - ✅ Los valores cambian
3. Intenta cambiar setpoints en el panel derecho
4. Verifica que las alarmas funcionen

## 🎯 Resultado Final

Tendrás dos servicios corriendo:

- **Backend**: `https://backend-production-xxxx.up.railway.app`
  - API Docs: `/docs`
  - Health: `/api/health`

- **Frontend**: `https://frontend-production-xxxx.up.railway.app`
  - Interfaz SCADA completa

## 📊 Monitorear desde Terminal

Una vez configurado, vuelve a la terminal y ejecuta:

```bash
# Vincular el proyecto localmente
cd /home/adrpinto/scada/scada
railway link

# Ver logs del backend en tiempo real
railway logs backend --follow

# Ver logs del frontend en tiempo real
railway logs frontend --follow

# Ver estado de todos los servicios
railway status
```

## 🔧 Troubleshooting Rápido

### Backend no inicia
```bash
railway logs backend
```
Busca errores en Python/dependencias.

### Frontend no conecta
1. Verifica que `VITE_API_URL` esté configurada
2. Debe ser HTTPS (no HTTP)
3. Sin `/` al final

### WebSocket falla
- Abre consola del navegador (F12)
- Busca errores de WebSocket
- Verifica que la URL del backend sea correcta

---

**¡Tiempo estimado total: 5-7 minutos!**
