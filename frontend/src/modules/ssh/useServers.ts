import { useState, useEffect, useCallback } from 'react';
import type { ServerConfig, PingResult } from '../../types';
import { getServers, deleteServer, getServerPing } from '../../services/ssh.service';

export function useServers() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [pings, setPings] = useState<Record<string, PingResult>>({});

  const fetchServers = useCallback(async () => {
    try {
      const list = await getServers();
      setServers(list ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    if (servers.length === 0) return;
    servers.forEach(async (s) => {
      try {
        const ping = await getServerPing(s.ip);
        setPings(prev => ({ ...prev, [s.id]: ping }));
      } catch {
        setPings(prev => ({ ...prev, [s.id]: { host: s.ip, online: false, latency: 0, error: 'failed' } }));
      }
    });
  }, [servers]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Remove this server?')) return;
    try {
      await deleteServer(id);
      fetchServers();
      return true;
    } catch (e) {
      alert(String(e));
      return false;
    }
  }, [fetchServers]);

  return { servers, pings, fetchServers, handleDelete };
}
