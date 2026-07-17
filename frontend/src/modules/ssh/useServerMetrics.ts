import { useState, useCallback } from 'react';
import type { ServerMetrics } from '../../types';
import { getServerMetrics } from '../../services/ssh.service';

export function useServerMetrics() {
  const [metrics, setMetrics] = useState<Record<string, ServerMetrics>>({});
  const [metricsLoading, setMetricsLoading] = useState(false);

  const fetchMetrics = useCallback(async (id: string) => {
    if (!id) return;
    setMetricsLoading(true);
    try {
      const m = await getServerMetrics(id);
      setMetrics(prev => ({ ...prev, [id]: m }));
    } catch (e) {
      setMetrics(prev => ({ ...prev, [id]: { cpu_usage: 0, mem_total: 0, mem_used: 0, disk_total: 0, disk_used: 0, uptime: 0, load_avg: '', error: String(e) } }));
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  return { metrics, metricsLoading, fetchMetrics };
}
