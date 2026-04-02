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

COPY --from=build /app/dist /usr/share/nginx/html

# Copia configuración nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
