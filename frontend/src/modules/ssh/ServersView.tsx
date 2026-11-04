import { Icon } from '../../components/Icon';
import { useState, useEffect, useCallback } from 'react';
import type { ServerConfig } from '../../types';
import { useServers } from './useServers';
import { useServerMetrics } from './useServerMetrics';
import { ServerForm } from './ServerForm';
import { ServerList } from './ServerList';
import { ServerMetricsPanel } from './ServerMetricsPanel';
import { TerminalPanel } from './TerminalPanel';

export function ServersView() {
  const { servers, pings, fetchServers, handleDelete: deleteServer } = useServers();
  const { metrics, metricsLoading, fetchMetrics } = useServerMetrics();
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServerConfig | null>(null);
  const [terminalMode, setTerminalMode] = useState(false);

  useEffect(() => {
    if (selectedID && !terminalMode) {
      fetchMetrics(selectedID);
      const interval = setInterval(() => fetchMetrics(selectedID), 15_000);
      return () => clearInterval(interval);
    }
  }, [selectedID, terminalMode, fetchMetrics]);

  const handleDelete = useCallback(async (id: string) => {
    const removed = await deleteServer(id);
    if (removed && selectedID === id) setSelectedID(null);
  }, [deleteServer, selectedID]);

  const handleFormSaved = () => {
    setShowForm(false);
    setEditing(null);
    fetchServers();
  };

  const handleEdit = useCallback((s: ServerConfig) => {
    setEditing(s);
    setShowForm(true);
  }, []);

  const selectServer = useCallback((id: string) => {
    setSelectedID(id);
    setTerminalMode(false);
  }, []);

  const selectedServer = servers.find(s => s.id === selectedID);
  const selectedMetrics = selectedID ? metrics[selectedID] : undefined;
  const selectedPing = selectedID ? pings[selectedID] : undefined;

  return (
    <div className="animate-page-in h-full flex flex-col">
      <div className="mb-md flex items-center justify-end">
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-xs bg-primary text-on-primary px-md py-1.5 rounded font-body-sm text-body-sm font-semibold hover:brightness-110 active:scale-95 duration-100 transition-all cursor-pointer"
        >
          <Icon name="add" size={16} />
          Add Server
        </button>
      </div>

      {showForm && (
        <div className="mb-md">
          <ServerForm onSaved={handleFormSaved} onCancel={() => { setShowForm(false); setEditing(null); }} editing={editing} />
        </div>
      )}

      <div className="flex-1 flex gap-gutter min-h-0">
        <ServerList
          servers={servers}
          pings={pings}
          selectedID={selectedID}
          onSelect={selectServer}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        <div className="flex-1 min-w-0">
          {!selectedServer ? (
            <div className="h-full flex items-center justify-center bg-surface-container border border-outline rounded-xl">
              <div className="text-center">
                <Icon name="terminal" size={64} className="text-on-surface-variant/20" />
                <p className="text-on-surface-variant font-body-md mt-md">Select a server to view metrics or start a terminal session.</p>
              </div>
            </div>
          ) : terminalMode ? (
            <TerminalPanel
              serverID={selectedServer.id}
              serverName={selectedServer.name}
              onDisconnect={() => setTerminalMode(false)}
            />
          ) : (
            <ServerMetricsPanel
              server={selectedServer}
              metrics={selectedMetrics}
              ping={selectedPing}
              metricsLoading={metricsLoading}
              fetchMetrics={fetchMetrics}
              onOpenTerminal={() => setTerminalMode(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
