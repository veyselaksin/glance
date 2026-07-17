import { useState, useEffect, useCallback } from 'react';
import type { ContainerInfo } from '../../types';
import { getContainers, stopContainer, startContainer, deleteContainer, streamContainerLogs } from '../../services/docker.service';

export function useContainers() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const fetchContainers = useCallback(async () => {
    try {
      const list = await getContainers();
      setContainers(list ?? []);
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
    try { await stopContainer(id); await fetchContainers(); }
    catch (e) { setError(String(e)); }
    finally { setActionPending(null); }
  }, [fetchContainers]);

  const handleStart = useCallback(async (id: string) => {
    setActionPending(id + ':start');
    try { await startContainer(id); await fetchContainers(); }
    catch (e) { setError(String(e)); }
    finally { setActionPending(null); }
  }, [fetchContainers]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Force-remove this container? This cannot be undone.')) return;
    setActionPending(id + ':delete');
    try { await deleteContainer(id); await fetchContainers(); }
    catch (e) { setError(String(e)); }
    finally { setActionPending(null); }
  }, [fetchContainers]);

  return {
    containers, loading, error,
    expandedId, logs, logsLoading, logsError, actionPending,
    fetchContainers, handleLogs, handleStop, handleStart, handleDelete,
  };
}
