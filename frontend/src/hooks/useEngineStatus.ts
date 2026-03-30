import { useEffect, useState } from "react";
import type { EngineStatus } from "../types";

interface UseEngineStatusOptions {
  pollInterval?: number; // ms
}

/**
 * Hook para obtener estado del motor de cálculo.
 *
 * Hace polling a /api/engine/status cada 2 segundos.
 */
export function useEngineStatus(options: UseEngineStatusOptions = {}) {
  const { pollInterval = 2000 } = options;
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/engine/status");
        if (!response.ok) throw new Error("Error fetching engine status");
        const data: EngineStatus = await response.json();
        setEngineStatus(data);
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        console.error("Error fetching engine status:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval]);

  return { engineStatus, loading, error };
}
