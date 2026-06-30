import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  GetServers, SaveServer, DeleteServer, SaveSSHKey,
  ConnectSSH, SSHWrite, SSHResize, DisconnectSSH,
  GetServerMetrics, GetServerPing,
} from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServerConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  auth_method: string;
  password?: string;
  private_key_path?: string;
}

interface ServerMetrics {
  cpu_usage: number;
  mem_total: number;
  mem_used: number;
  disk_total: number;
  disk_used: number;
  uptime: number;
  load_avg: string;
  error?: string;
}

interface PingResult {
  host: string;
  online: boolean;
  latency: number;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pct(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, (used / total) * 100);
}

// ─── Add/Edit Server Form ─────────────────────────────────────────────────────

function ServerForm({ onSaved, onCancel, editing }: {
  onSaved: () => void;
  onCancel: () => void;
  editing: ServerConfig | null;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [ip, setIp] = useState(editing?.ip ?? '');
  const [port, setPort] = useState(editing?.port ?? 22);
  const [username, setUsername] = useState(editing?.username ?? 'root');
  const [authMethod, setAuthMethod] = useState(editing?.auth_method ?? 'password');
  const [password, setPassword] = useState('');
  const [privateKeyContent, setPrivateKeyContent] = useState('');
  const [keyMode, setKeyMode] = useState<'paste' | 'path'>(
    editing?.private_key_path ? 'path' : 'paste'
  );
  const [privateKeyPath, setPrivateKeyPath] = useState(editing?.private_key_path ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() || !ip.trim()) {
      setError('Name and IP are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let keyPath = authMethod === 'private_key' ? privateKeyPath : '';

      // If the user pasted a private key, persist it securely via SaveSSHKey
      // first, then use the returned file path in the server config.
      if (authMethod === 'private_key' && keyMode === 'paste' && privateKeyContent.trim()) {
        const serverID = editing?.id ?? '';
        if (!serverID) {
          // Generate a temp ID so the key file has a deterministic name.
          // SaveServer will assign the real ID, but the key file name just
          // needs to be unique and safe. We use the server name as a hint.
          const tempID = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
          keyPath = await SaveSSHKey(tempID, privateKeyContent);
        } else {
          keyPath = await SaveSSHKey(serverID, privateKeyContent);
        }
      }

      await SaveServer({
        id: editing?.id ?? '',
        name: name.trim(),
        ip: ip.trim(),
        port,
        username: username.trim() || 'root',
        auth_method: authMethod,
        password: authMethod === 'password' ? password : '',
        private_key_path: authMethod === 'private_key' ? keyPath : '',
      });
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-container border border-outline rounded-xl p-md space-y-md animate-fade-in">
      <div className="flex items-center gap-xs text-primary">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dns</span>
        <span className="text-label-caps font-label-caps uppercase">{editing ? 'Edit Server' : 'Add Server'}</span>
      </div>

      {error && (
        <div className="px-sm py-xs text-error text-body-sm bg-error/10 rounded border border-error/30">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">Name</label>
          <input className="mac-input" value={name} onChange={e => setName(e.target.value)} placeholder="My VPS" spellCheck={false} />
        </div>
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">IP / Hostname</label>
          <input className="mac-input" value={ip} onChange={e => setIp(e.target.value)} placeholder="192.168.1.42" spellCheck={false} />
        </div>
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">Port</label>
          <input className="mac-input" type="number" value={port} onChange={e => setPort(parseInt(e.target.value) || 22)} />
        </div>
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">Username</label>
          <input className="mac-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="root" spellCheck={false} />
        </div>
      </div>

      {/* Secret Type */}
      <div className="space-y-sm">
        <label className="block text-label-caps font-label-caps text-on-surface-variant">Secret Type</label>
        <div className="flex gap-sm">
          <button
            onClick={() => setAuthMethod('password')}
            className={`flex items-center gap-xs px-md py-xs rounded text-body-sm font-body-sm transition-colors cursor-pointer ${authMethod === 'password' ? 'bg-primary text-on-primary' : 'bg-background border border-outline text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>key</span>
            Password
          </button>
          <button
            onClick={() => setAuthMethod('private_key')}
            className={`flex items-center gap-xs px-md py-xs rounded text-body-sm font-body-sm transition-colors cursor-pointer ${authMethod === 'private_key' ? 'bg-primary text-on-primary' : 'bg-background border border-outline text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>vpn_key</span>
            SSH Private Key
          </button>
        </div>
      </div>

      {authMethod === 'password' ? (
        <div className="space-y-sm">
          <label className="block text-label-caps font-label-caps text-on-surface-variant">
            Password {editing && <span className="text-on-surface-variant/50 normal-case">(leave blank to keep existing)</span>}
          </label>
          <input className="mac-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="off" />
        </div>
      ) : (
        <div className="space-y-sm">
          {/* Key input mode toggle */}
          <div className="flex items-center justify-between">
            <label className="block text-label-caps font-label-caps text-on-surface-variant">Private Key</label>
            <div className="flex gap-xs">
              <button
                onClick={() => setKeyMode('paste')}
                className={`px-sm py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${keyMode === 'paste' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Paste Key
              </button>
              <button
                onClick={() => setKeyMode('path')}
                className={`px-sm py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${keyMode === 'path' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                File Path
              </button>
            </div>
          </div>

          {keyMode === 'paste' ? (
            <div className="space-y-sm">
              <textarea
                className="mac-input font-mono text-[12px] leading-relaxed resize-y"
                style={{ minHeight: '140px', height: '140px', userSelect: 'text' }}
                value={privateKeyContent}
                onChange={e => setPrivateKeyContent(e.target.value)}
                placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmU...\n-----END OPENSSH PRIVATE KEY-----'}
                spellCheck={false}
                autoComplete="off"
              />
              <div className="flex items-center gap-xs text-[11px] text-on-surface-variant/60">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>lock</span>
                <span>Key is stored at <code className="text-primary font-mono">~/.glance/ssh_keys/</code> with 0600 permissions. Never written to config.json.</span>
              </div>
              {editing?.private_key_path && !privateKeyContent && (
                <div className="flex items-center gap-xs text-[11px] text-warning">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>info</span>
                  <span>A key is already saved. Paste a new key to replace it, or switch to "File Path" mode.</span>
                </div>
              )}
            </div>
          ) : (
            <input
              className="mac-input font-mono"
              value={privateKeyPath}
              onChange={e => setPrivateKeyPath(e.target.value)}
              placeholder="~/.ssh/id_rsa"
              spellCheck={false}
            />
          )}
        </div>
      )}

      <div className="flex justify-end gap-sm pt-sm">
        <button onClick={onCancel} className="px-md py-xs rounded text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors cursor-pointer">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-on-primary px-md py-1.5 rounded font-body-sm text-body-sm font-semibold hover:brightness-110 active:scale-95 duration-100 transition-all disabled:opacity-40 cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save Server'}
        </button>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, pctVal, color }: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  pctVal?: number;
  color: string;
}) {
  return (
    <div className="bg-background border border-outline rounded-lg p-md flex flex-col">
      <div className="flex items-center gap-xs mb-sm">
        <span className="material-symbols-outlined" style={{ fontSize: 16, color }}>{icon}</span>
        <span className="text-label-caps font-label-caps text-on-surface-variant uppercase">{label}</span>
      </div>
      <div className="text-[22px] font-bold font-mono leading-none mb-xs" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-on-surface-variant font-body-sm">{sub}</div>}
      {pctVal !== undefined && (
        <div className="mt-sm h-1.5 rounded-full bg-surface-container-high overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctVal}%`, backgroundColor: color }} />
        </div>
      )}
    </div>
  );
}

// ─── Terminal Panel ───────────────────────────────────────────────────────────

function TerminalPanel({ serverID, serverName, onDisconnect }: {
  serverID: string;
  serverName: string;
  onDisconnect: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIDRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, SF Mono, Fira Code, monospace',
      theme: {
        background: '#000000',
        foreground: '#e5e5e5',
        cursor: '#0A84FF',
        cursorAccent: '#000000',
        selectionBackground: '#0A84FF55',
        black: '#000000',
        red: '#FF453A',
        green: '#30D158',
        yellow: '#FF9500',
        blue: '#0A84FF',
        magenta: '#BF5AF2',
        cyan: '#64D2FF',
        white: '#e5e5e5',
        brightBlack: '#808080',
        brightRed: '#FF6961',
        brightGreen: '#42E680',
        brightYellow: '#FFB340',
        brightBlue: '#3D9BFF',
        brightMagenta: '#D070FF',
        brightCyan: '#85DCFF',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    term.writeln(`\x1b[38;2;10;132;255mConnecting to ${serverName}...\x1b[0m`);

    // Connect SSH
    ConnectSSH(serverID).then(sid => {
      sessionIDRef.current = sid;
      setConnected(true);
      term.writeln(`\x1b[38;2;10;132;255mConnected. Session: ${sid.slice(0, 8)}\x1b[0m\r\n`);

      // Send initial size
      SSHResize(sid, term.cols, term.rows).catch(() => {});
    }).catch(e => {
      setError(String(e));
      term.writeln(`\x1b[38;2;255;69;58mConnection failed: ${e}\x1b[0m`);
    });

    // Stream output from backend → terminal
    const offOutput = EventsOn('ssh_output', (payload: { session_id: string; data: string }) => {
      if (payload.session_id === sessionIDRef.current) {
        term.write(payload.data);
      }
    });

    const offClosed = EventsOn('ssh_closed', (payload: { session_id: string; reason: string }) => {
      if (payload.session_id === sessionIDRef.current) {
        term.writeln(`\r\n\x1b[38;2;255;69;58m[Session closed: ${payload.reason}]\x1b[0m`);
        setConnected(false);
      }
    });

    // Stream input from terminal → backend
    const inputDisp = term.onData(data => {
      if (sessionIDRef.current) {
        SSHWrite(sessionIDRef.current, data).catch(() => {});
      }
    });

    // Handle resize
    const resizeDisp = term.onResize(({ cols, rows }) => {
      if (sessionIDRef.current) {
        SSHResize(sessionIDRef.current, cols, rows).catch(() => {});
      }
    });

    // Window resize listener
    const onResize = () => {
      if (fitRef.current) {
        try { fitRef.current.fit(); } catch {}
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      offOutput();
      offClosed();
      inputDisp.dispose();
      resizeDisp.dispose();
      window.removeEventListener('resize', onResize);
      if (sessionIDRef.current) {
        DisconnectSSH(sessionIDRef.current).catch(() => {});
      }
      term.dispose();
    };
  }, [serverID, serverName]);

  const handleDisconnect = () => {
    if (sessionIDRef.current) {
      DisconnectSSH(sessionIDRef.current).catch(() => {});
      sessionIDRef.current = null;
    }
    setConnected(false);
    onDisconnect();
  };

  return (
    <div className="flex flex-col h-full bg-surface-container border border-outline rounded-xl overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-md py-sm bg-surface-container-high border-b border-outline">
        <div className="flex items-center gap-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary animate-status-pulse' : 'bg-warning'}`} />
          <span className="text-label-caps font-label-caps text-primary uppercase">{serverName} — Terminal</span>
          {connected && <span className="text-[10px] text-on-surface-variant font-code-sm">● LIVE</span>}
        </div>
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-xs px-sm py-xs rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors text-body-sm font-body-sm cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>power_off</span>
          Disconnect
        </button>
      </div>

      {/* Terminal area */}
      <div ref={containerRef} className="flex-1 bg-black overflow-hidden min-h-0" />

      {error && (
        <div className="px-md py-sm text-error text-body-sm bg-error/10 border-t border-error/30">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Main ServersView ─────────────────────────────────────────────────────────

export function ServersView() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServerConfig | null>(null);
  const [metrics, setMetrics] = useState<Record<string, ServerMetrics>>({});
  const [pings, setPings] = useState<Record<string, PingResult>>({});
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [terminalMode, setTerminalMode] = useState(false);

  const fetchServers = useCallback(async () => {
    try {
      const list = await GetServers();
      setServers(list ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Ping all servers on load and when server list changes
  useEffect(() => {
    if (servers.length === 0) return;
    servers.forEach(async (s) => {
      try {
        const ping = await GetServerPing(s.ip);
        setPings(prev => ({ ...prev, [s.id]: ping }));
      } catch {
        setPings(prev => ({ ...prev, [s.id]: { host: s.ip, online: false, latency: 0, error: 'failed' } }));
      }
    });
  }, [servers]);

  // Fetch metrics for selected server
  const fetchMetrics = useCallback(async (id: string) => {
    setMetricsLoading(true);
    try {
      const m = await GetServerMetrics(id);
      setMetrics(prev => ({ ...prev, [id]: m }));
    } catch (e) {
      setMetrics(prev => ({ ...prev, [id]: { cpu_usage: 0, mem_total: 0, mem_used: 0, disk_total: 0, disk_used: 0, uptime: 0, load_avg: '', error: String(e) } }));
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Auto-fetch metrics when a server is selected (and not in terminal mode)
  useEffect(() => {
    if (selectedID && !terminalMode) {
      fetchMetrics(selectedID);
      const interval = setInterval(() => fetchMetrics(selectedID), 15_000);
      return () => clearInterval(interval);
    }
  }, [selectedID, terminalMode, fetchMetrics]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this server?')) return;
    try {
      await DeleteServer(id);
      if (selectedID === id) setSelectedID(null);
      fetchServers();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleFormSaved = () => {
    setShowForm(false);
    setEditing(null);
    fetchServers();
  };

  const selectedServer = servers.find(s => s.id === selectedID);
  const selectedMetrics = selectedID ? metrics[selectedID] : undefined;
  const selectedPing = selectedID ? pings[selectedID] : undefined;

  return (
    <div className="animate-page-in h-[calc(100vh-130px)] flex flex-col">
      {/* Header */}
      <div className="mb-md flex items-center justify-between">
        <div>
          <h3 className="text-headline-md md:text-headline-lg font-headline-lg text-on-surface mb-xs">Servers / VPS</h3>
          <p className="text-on-surface-variant font-body-md">SSH terminal and real-time infrastructure monitoring.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-xs bg-primary text-on-primary px-md py-1.5 rounded font-body-sm text-body-sm font-semibold hover:brightness-110 active:scale-95 duration-100 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Add Server
        </button>
      </div>

      {showForm && (
        <div className="mb-md">
          <ServerForm onSaved={handleFormSaved} onCancel={() => { setShowForm(false); setEditing(null); }} editing={editing} />
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex-1 flex gap-gutter min-h-0">
        {/* Left: Server List */}
        <div className="w-72 shrink-0 bg-surface-container border border-outline rounded-xl flex flex-col overflow-hidden">
          <div className="px-md py-sm border-b border-outline flex items-center gap-xs text-primary">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dns</span>
            <span className="text-label-caps font-label-caps uppercase">Servers</span>
            <span className="ml-auto text-[11px] text-on-surface-variant font-code-sm">{servers.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {servers.length === 0 ? (
              <div className="px-md py-xl text-center text-on-surface-variant text-body-sm">
                No servers saved. Click <strong className="text-primary">Add Server</strong> to get started.
              </div>
            ) : (
              <div className="p-sm space-y-xs">
                {servers.map(s => {
                  const ping = pings[s.id];
                  const online = ping?.online;
                  const isHighLatency = online && ping!.latency > 100;
                  const isSelected = selectedID === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => { setSelectedID(s.id); setTerminalMode(false); }}
                      className={`group p-sm rounded-lg cursor-pointer transition-all duration-150 border ${isSelected ? 'bg-primary/10 border-primary/30' : 'bg-background border-transparent hover:border-outline hover:bg-white/5'}`}
                    >
                      <div className="flex items-start justify-between gap-sm">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-sm">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${online ? (isHighLatency ? 'bg-warning' : 'bg-primary animate-status-pulse') : 'bg-on-surface-variant/30'}`}
                              title={online ? `${ping!.latency.toFixed(1)}ms` : 'Offline'}
                            />
                            <span className={`text-body-sm font-body-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{s.name}</span>
                          </div>
                          <div className="text-[11px] text-on-surface-variant font-code-sm mt-xs truncate ml-sm">{s.username}@{s.ip}:{s.port}</div>
                          {online && (
                            <div className="text-[10px] mt-xs ml-sm" style={{ color: isHighLatency ? '#FF9500' : '#0A84FF' }}>
                              {ping!.latency.toFixed(0)}ms
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditing(s); setShowForm(true); }}
                            className="flex items-center justify-center w-6 h-6 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                            className="flex items-center justify-center w-6 h-6 rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_forever</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Dashboard or Terminal */}
        <div className="flex-1 min-w-0">
          {!selectedServer ? (
            /* Empty state */
            <div className="h-full flex items-center justify-center bg-surface-container border border-outline rounded-xl">
              <div className="text-center">
                <span className="material-symbols-outlined text-on-surface-variant/20" style={{ fontSize: 64 }}>terminal</span>
                <p className="text-on-surface-variant font-body-md mt-md">Select a server to view metrics or start a terminal session.</p>
              </div>
            </div>
          ) : terminalMode ? (
            /* Terminal mode */
            <TerminalPanel
              serverID={selectedServer.id}
              serverName={selectedServer.name}
              onDisconnect={() => setTerminalMode(false)}
            />
          ) : (
            /* Metrics dashboard */
            <div className="h-full bg-surface-container border border-outline rounded-xl flex flex-col overflow-hidden">
              {/* Dashboard header */}
              <div className="px-md py-sm border-b border-outline flex items-center justify-between">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>monitoring</span>
                  <div>
                    <span className="text-body-sm font-body-sm font-semibold text-on-surface">{selectedServer.name}</span>
                    <span className="text-on-surface-variant text-[11px] font-code-sm ml-sm">{selectedServer.username}@{selectedServer.ip}</span>
                  </div>
                  {selectedPing && (
                    <span className={`flex items-center gap-1 ml-md text-[11px] ${selectedPing.online ? 'text-primary' : 'text-warning'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedPing.online ? 'bg-primary' : 'bg-warning'}`} />
                      {selectedPing.online ? `${selectedPing.latency.toFixed(0)}ms` : 'Offline'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-sm">
                  <button
                    onClick={() => fetchMetrics(selectedServer.id)}
                    disabled={metricsLoading}
                    className="flex items-center gap-xs px-sm py-xs rounded text-on-surface-variant hover:text-primary transition-colors text-body-sm font-body-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{metricsLoading ? 'progress_activity' : 'refresh'}</span>
                    Refresh
                  </button>
                  <button
                    onClick={() => setTerminalMode(true)}
                    className="flex items-center gap-xs bg-primary text-on-primary px-md py-xs rounded font-body-sm text-body-sm font-semibold hover:brightness-110 active:scale-95 duration-100 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
                    Connect Terminal
                  </button>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-md">
                {selectedMetrics?.error ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className="material-symbols-outlined text-error/50" style={{ fontSize: 48 }}>error</span>
                    <p className="text-error text-body-sm mt-md font-code-sm">{selectedMetrics.error}</p>
                    <p className="text-on-surface-variant text-[11px] mt-xs">Check credentials and network connectivity.</p>
                  </div>
                ) : !selectedMetrics ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="material-symbols-outlined text-on-surface-variant/30 animate-spin" style={{ fontSize: 32 }}>progress_activity</span>
                  </div>
                ) : (
                  <div className="space-y-md">
                    {/* Metric cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
                      <MetricCard
                        icon="memory"
                        label="CPU Usage"
                        value={`${selectedMetrics.cpu_usage.toFixed(1)}%`}
                        sub={selectedMetrics.load_avg ? `Load: ${selectedMetrics.load_avg}` : undefined}
                        pctVal={selectedMetrics.cpu_usage}
                        color="#0A84FF"
                      />
                      <MetricCard
                        icon="memory_alt"
                        label="Memory"
                        value={formatBytes(selectedMetrics.mem_used)}
                        sub={`of ${formatBytes(selectedMetrics.mem_total)}`}
                        pctVal={pct(selectedMetrics.mem_used, selectedMetrics.mem_total)}
                        color="#30D158"
                      />
                      <MetricCard
                        icon="storage"
                        label="Disk"
                        value={formatBytes(selectedMetrics.disk_used)}
                        sub={`of ${formatBytes(selectedMetrics.disk_total)}`}
                        pctVal={pct(selectedMetrics.disk_used, selectedMetrics.disk_total)}
                        color="#FF9500"
                      />
                      <MetricCard
                        icon="schedule"
                        label="Uptime"
                        value={formatUptime(selectedMetrics.uptime)}
                        sub={selectedMetrics.load_avg ? `Load avg: ${selectedMetrics.load_avg}` : undefined}
                        color="#BF5AF2"
                      />
                    </div>

                    {/* Connection details */}
                    <div className="bg-background border border-outline rounded-lg p-md">
                      <div className="text-label-caps font-label-caps text-on-surface-variant uppercase mb-sm">Connection Details</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-md text-body-sm">
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Host</span>
                          <span className="font-code-sm text-on-surface">{selectedServer.ip}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Port</span>
                          <span className="font-code-sm text-on-surface">{selectedServer.port}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">User</span>
                          <span className="font-code-sm text-on-surface">{selectedServer.username}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Auth</span>
                          <span className="font-code-sm text-on-surface">{selectedServer.auth_method === 'private_key' ? 'Private Key' : 'Password'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick SSH command reference */}
                    <div className="bg-background border border-outline rounded-lg p-md">
                      <div className="text-label-caps font-label-caps text-on-surface-variant uppercase mb-sm">Quick Actions</div>
                      <div className="flex flex-wrap gap-sm">
                        <button
                          onClick={() => setTerminalMode(true)}
                          className="flex items-center gap-xs px-md py-xs bg-surface-container-high border border-outline rounded text-body-sm font-body-sm text-on-surface hover:border-primary hover:text-primary transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
                          Open SSH Shell
                        </button>
                        <button
                          onClick={() => fetchMetrics(selectedServer.id)}
                          className="flex items-center gap-xs px-md py-xs bg-surface-container-high border border-outline rounded text-body-sm font-body-sm text-on-surface hover:border-primary hover:text-primary transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                          Refresh Metrics
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
