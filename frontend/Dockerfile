FROM node:18-alpine as build

WORKDIR /app

# Argumento para la URL del backend (se pasa durante el build)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copia archivos de proyecto
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./

# Copia código fuente
COPY src ./src

# Instala dependencias
RUN npm ci

# Build (Vite inyectará VITE_API_URL en el bundle)
RUN npm run build

# Etapa 2: Servir con nginx
FROM nginx:alpine

# Instalar gettext para envsubst
RUN apk add --no-cache gettext

COPY --from=build /app/dist /usr/share/nginx/html

# Copia template de nginx (no el archivo final)
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Copia script de entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Railway asigna un puerto dinámicamente
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
