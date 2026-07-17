import { useState, useEffect, useCallback, useRef } from 'react';
import type { ContainerInfo } from '../../types';
import type { ToastData } from '../../components/Toast';
import { getContainers, stopContainer, startContainer, restartContainer, deleteContainer, streamContainerLogs } from '../../services/docker.service';

export interface ContainerStats {
  cpu_usage: number;
  mem_usage: number;
  mem_percent: number;
  network_rx: number;
  network_tx: number;
  io_read: number;
  io_write: number;
  pid_count: number;
}

export function useContainers() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, ContainerStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const snapshotRef = useRef<ContainerInfo[] | null>(null);

  const fetchContainers = useCallback(async () => {
    try {
      const list = await getContainers();
      const arr = list ?? [];
      setContainers(arr);
      const sm: Record<string, ContainerStats> = {};
      for (const c of arr) {
        sm[c.id] = {
          cpu_usage: c.cpu_usage,
          mem_usage: c.mem_usage,
          mem_percent: c.mem_percent,
          network_rx: c.network_rx,
          network_tx: c.network_tx,
          io_read: c.io_read,
          io_write: c.io_write,
          pid_count: c.pid_count,
        };
      }
      setStatsMap(sm);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  useEffect(() => {
    const id = setInterval(() => {
      getContainers().then(list => {
        const sm: Record<string, ContainerStats> = {};
        for (const c of (list ?? [])) {
          sm[c.id] = {
            cpu_usage: c.cpu_usage,
            mem_usage: c.mem_usage,
            mem_percent: c.mem_percent,
            network_rx: c.network_rx,
            network_tx: c.network_tx,
            io_read: c.io_read,
            io_write: c.io_write,
            pid_count: c.pid_count,
          };
        }
        setStatsMap(sm);
      }).catch(() => {});
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogs = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setLogsLoading(true);
    setLogsError(null);
    setLogs('');
    try {
      const text = await streamContainerLogs(id, 200);
      setLogs(text || '(no log output)');
    } catch (e) {
      setLogsError(String(e));
    } finally {
      setLogsLoading(false);
    }
  }, [expandedId]);

  const handleStop = useCallback(async (id: string) => {
    setActionPending(id + ':stop');
    snapshotRef.current = containers;
    setContainers(prev => prev.map(c =>
      c.id === id ? { ...c, state: 'stopped', status: 'Stopping\u2026', cpu_usage: 0, mem_usage: 0, mem_percent: 0, network_rx: 0, network_tx: 0, io_read: 0, io_write: 0, pid_count: 0 } : c
    ));
    try {
      await stopContainer(id);
      setToast({ message: 'Container stopped', type: 'success' });
      await fetchContainers();
    } catch (e) {
      setContainers(snapshotRef.current!);
      setToast({ message: `Stop failed: ${e}`, type: 'error' });
    } finally {
      setActionPending(null);
      snapshotRef.current = null;
    }
  }, [containers, fetchContainers]);

  const handleStart = useCallback(async (id: string) => {
    setActionPending(id + ':start');
    snapshotRef.current = containers;
    setContainers(prev => prev.map(c =>
      c.id === id ? { ...c, state: 'running', status: 'Starting\u2026' } : c
    ));
    try {
      await startContainer(id);
      setToast({ message: 'Container started', type: 'success' });
      await fetchContainers();
    } catch (e) {
      setContainers(snapshotRef.current!);
      setToast({ message: `Start failed: ${e}`, type: 'error' });
    } finally {
      setActionPending(null);
      snapshotRef.current = null;
    }
  }, [containers, fetchContainers]);

  const handleRestart = useCallback(async (id: string) => {
    setActionPending(id + ':restart');
    snapshotRef.current = containers;
    setContainers(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'Restarting\u2026', cpu_usage: 0, mem_usage: 0, mem_percent: 0, network_rx: 0, network_tx: 0, io_read: 0, io_write: 0, pid_count: 0 } : c
    ));
    try {
      await restartContainer(id);
      setToast({ message: 'Container restarted', type: 'success' });
      await fetchContainers();
    } catch (e) {
      setContainers(snapshotRef.current!);
      setToast({ message: `Restart failed: ${e}`, type: 'error' });
    } finally {
      setActionPending(null);
      snapshotRef.current = null;
    }
  }, [containers, fetchContainers]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Force-remove this container? This cannot be undone.')) return;
    setActionPending(id + ':delete');
    snapshotRef.current = containers;
    setContainers(prev => prev.filter(c => c.id !== id));
    try {
      await deleteContainer(id);
      setToast({ message: 'Container removed', type: 'success' });
      await fetchContainers();
    } catch (e) {
      setContainers(snapshotRef.current!);
      setToast({ message: `Delete failed: ${e}`, type: 'error' });
    } finally {
      setActionPending(null);
      snapshotRef.current = null;
    }
  }, [containers, fetchContainers]);

  return {
    containers, statsMap, loading, error,
    expandedId, logs, logsLoading, logsError, actionPending,
    toast,
    fetchContainers, handleLogs, handleStop, handleStart, handleRestart, handleDelete,
    dismissToast: () => setToast(null),
  };
}
