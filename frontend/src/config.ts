/**
 * Configuración de URLs para API y WebSocket.
 *
 * En desarrollo local usa el proxy de Vite.
 * En producción (Railway) usa la variable de entorno VITE_API_URL.
 */

const isDevelopment = import.meta.env.DEV;
const apiUrl = import.meta.env.VITE_API_URL || '';

/**
 * URL base para llamadas REST a la API.
 * En desarrollo: usa rutas relativas (proxy de Vite)
 * En producción: usa VITE_API_URL
 */
export const API_BASE_URL = isDevelopment ? '' : apiUrl;

/**
 * URL para WebSocket.
 * En desarrollo: construye desde window.location
 * En producción: construye desde VITE_API_URL
 */
export function getWebSocketURL(): string {
  if (isDevelopment) {
    // Desarrollo local: usa window.location (proxy de Vite maneja /ws)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/realtime`;
  } else {
    // Producción: construye desde VITE_API_URL
    if (!apiUrl) {
      console.error('VITE_API_URL no configurada en producción');
      return 'ws://localhost:8001/ws/realtime';
    }
    const wsUrl = apiUrl.replace(/^http/, 'ws');
    return `${wsUrl}/ws/realtime`;
  }
}

/**
 * Construye URL completa para endpoint de API.
 */
export function apiURL(path: string): string {
  // Asegura que path empiece con /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
