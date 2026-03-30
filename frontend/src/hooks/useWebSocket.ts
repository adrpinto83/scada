import { useEffect, useRef, useState, useCallback } from "react";
import type { ProcessState } from "../types";

interface UseWebSocketOptions {
  url?: string;
  onMessage?: (data: ProcessState) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * Hook para WebSocket en tiempo real (1 Hz).
 *
 * Gestiona reconexión automática y parsing de JSON.
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/realtime`,
    onMessage,
    onError,
    onOpen,
    onClose,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [lastData, setLastData] = useState<ProcessState | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("WebSocket conectado");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data: ProcessState = JSON.parse(event.data);
          setLastData(data);
          onMessage?.(data);
        } catch (e) {
          console.error("Error parseando WebSocket:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        onError?.(error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("WebSocket desconectado");
        setIsConnected(false);
        onClose?.();

        // Reconecta automáticamente
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(
            `Reintentando conexión en ${reconnectInterval}ms (intento ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );
          setTimeout(connect, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error("Error creando WebSocket:", e);
      setIsConnected(false);
    }
  }, [url, onMessage, onError, onOpen, onClose, reconnectInterval, maxReconnectAttempts]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastData,
    send: (data: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    },
    reconnect: () => {
      wsRef.current?.close();
      reconnectAttemptsRef.current = 0;
      connect();
    },
  };
}
