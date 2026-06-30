import { useState, useEffect, useRef, Fragment } from 'react';
import './App.css';
import { SaveConfig, GetConfig, GetLastData, StartOAuthFlow, SignOut, GetContainers, StopContainer, StartContainer, DeleteContainer, StreamContainerLogs } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { SignInPage } from './SignInPage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Config {
  github_username: string;
  github_token: string;
  client_id: string;
  client_secret: string;
  server_host: string;
}

interface WidgetData {
  updated_at: string;
  github: { username: string; contributions: number; commits: number; error?: string };
  docker: { running: number; stopped: number; total: number; version?: string; error?: string };
  server: { host: string; online: boolean; latency: number; error?: string };
}

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpu_usage: number;
  mem_usage: number;
}

interface LogLine {
  time: string;
  tag: string;
  msg: string;
  color: string;
}

type TabId = 'overview' | 'github' | 'docker' | 'servers' | 'logs' | 'docs';

// ─── Docker Containers Table ──────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function DockerContainers() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const fetchContainers = async () => {
    try {
      const list = await GetContainers();
      setContainers(list ?? []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleLogs = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setLogsLoading(true);
    setLogsError(null);
    setLogs('');
    try {
      const text = await StreamContainerLogs(id, 200);
      setLogs(text || '(no log output)');
    } catch (e) {
      setLogsError(String(e));
    } finally {
      setLogsLoading(false);
    }
  };

  const handleStop = async (id: string) => {
    setActionPending(id + ':stop');
    try { await StopContainer(id); await fetchContainers(); }
    catch (e) { setError(String(e)); }
    finally { setActionPending(null); }
  };

  const handleStart = async (id: string) => {
    setActionPending(id + ':start');
    try { await StartContainer(id); await fetchContainers(); }
    catch (e) { setError(String(e)); }
    finally { setActionPending(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Force-remove this container? This cannot be undone.')) return;
    setActionPending(id + ':delete');
    try { await DeleteContainer(id); await fetchContainers(); }
    catch (e) { setError(String(e)); }
    finally { setActionPending(null); }
  };

  return (
    <div className="bg-surface-container border border-outline rounded-xl overflow-visible">
      {/* Header row */}
      <div className="flex items-center justify-between px-md py-sm border-b border-outline">
        <div className="flex items-center gap-xs text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>view_list</span>
          <span className="text-label-caps font-label-caps uppercase">Active Containers</span>
        </div>
        <button
          onClick={fetchContainers}
          className="flex items-center gap-xs text-on-surface-variant hover:text-primary transition-colors text-body-sm font-body-sm cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          Refresh
        </button>
      </div>

      {error && (
        <div className="px-md py-sm text-error text-body-sm font-body-sm bg-error/10 border-b border-error/30">
          {error}
        </div>
      )}

      {loading ? (
        <div className="px-md py-xl text-center text-on-surface-variant text-body-sm">
          Loading containers…
        </div>
      ) : containers.length === 0 ? (
        <div className="px-md py-xl text-center text-on-surface-variant text-body-sm italic">
          No containers found. Is the Docker daemon running?
        </div>
      ) : (
        <div>
          <table className="w-full text-left text-body-sm border-collapse">
            <thead className="text-on-surface-variant text-label-caps font-label-caps border-b border-outline">
              <tr>
                <th className="px-md py-sm font-semibold uppercase tracking-wider">Container Name</th>
                <th className="px-md py-sm font-semibold uppercase tracking-wider hidden lg:table-cell">Image</th>
                <th className="px-md py-sm font-semibold uppercase tracking-wider">Status</th>
                <th className="px-md py-sm font-semibold uppercase tracking-wider hidden md:table-cell">CPU / RAM</th>
                <th className="px-md py-sm font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/30">
              {containers.map(c => {
                const running = c.state === 'running';
                const isExpanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="px-md py-sm min-w-0">
                        <div className="flex items-center gap-sm min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${running ? 'bg-primary animate-status-pulse' : 'bg-warning'}`} />
                          <span className="font-medium text-on-surface truncate">{c.name || c.id.slice(0, 12)}</span>
                        </div>
                      </td>
                      <td className="px-md py-sm font-code-sm text-on-surface-variant max-w-[200px] truncate hidden lg:table-cell" title={c.image}>{c.image}</td>
                      <td className="px-md py-sm">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-code-sm ${
                          running ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                        }`}>
                          {c.status || c.state}
                        </span>
                      </td>
                      <td className="px-md py-sm font-code-sm text-on-surface-variant hidden md:table-cell">
                        {running ? `${c.cpu_usage.toFixed(1)}% / ${formatBytes(c.mem_usage)}` : '—'}
                      </td>
                      <td className="px-md py-sm">
                        <div className="flex items-center justify-end gap-xs">
                          {/* Stop / Start toggle */}
                          {running ? (
                            <button
                              onClick={() => handleStop(c.id)}
                              disabled={actionPending === c.id + ':stop'}
                              aria-label="Stop container"
                              className="group relative flex items-center justify-center w-7 h-7 rounded text-on-surface-variant hover:text-warning hover:bg-warning/10 transition-colors cursor-pointer disabled:opacity-40"
                            >
                              <span className={`material-symbols-outlined ${actionPending !== c.id + ':stop' ? 'filled' : ''}`} style={{ fontSize: 18 }}>
                                {actionPending === c.id + ':stop' ? 'progress_activity' : 'stop_circle'}
                              </span>
                              <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline text-[10px] text-on-surface font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-20">Stop</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStart(c.id)}
                              disabled={actionPending === c.id + ':start'}
                              aria-label="Start container"
                              className="group relative flex items-center justify-center w-7 h-7 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40"
                            >
                              <span className={`material-symbols-outlined ${actionPending !== c.id + ':start' ? 'filled' : ''}`} style={{ fontSize: 18 }}>
                                {actionPending === c.id + ':start' ? 'progress_activity' : 'play_circle'}
                              </span>
                              <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline text-[10px] text-on-surface font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-20">Start</span>
                            </button>
                          )}
                          {/* View Logs */}
                          <button
                            onClick={() => handleLogs(c.id)}
                            aria-label={isExpanded ? 'Hide logs' : 'View logs'}
                            className={`group relative flex items-center justify-center w-7 h-7 rounded transition-colors cursor-pointer ${
                              isExpanded ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'
                            }`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
                            <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline text-[10px] text-on-surface font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-20">{isExpanded ? 'Hide logs' : 'View logs'}</span>
                          </button>
                          {/* Delete (warning state) */}
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={actionPending === c.id + ':delete'}
                            aria-label="Delete container"
                            className="group relative flex items-center justify-center w-7 h-7 rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                              {actionPending === c.id + ':delete' ? 'progress_activity' : 'delete_forever'}
                            </span>
                            <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline text-[10px] text-on-surface font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-20">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expandable log panel */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-md py-sm bg-black/50 border-t border-outline/50">
                          <div className="rounded-lg border border-outline/60 overflow-hidden">
                            <div className="flex items-center justify-between px-sm py-xs bg-surface-container-high border-b border-outline">
                              <div className="flex items-center gap-xs text-primary">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>subject</span>
                                <span className="text-label-caps font-label-caps uppercase">Container Logs — {c.name}</span>
                              </div>
                              <span className="text-[11px] text-on-surface-variant font-code-sm">last 200 lines</span>
                            </div>
                            <div
                              ref={logRef}
                              className="p-md max-h-96 overflow-y-auto custom-scrollbar bg-black/60 font-mono text-code-sm text-on-surface-variant whitespace-pre-wrap break-all leading-relaxed select-text"
                            >
                              {logsLoading ? (
                                <span className="text-primary/70">Fetching logs…</span>
                              ) : logsError ? (
                                <span className="text-error">{logsError}</span>
                              ) : (
                                logs
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard — exactly matches glance_dashboard_macos_blue ──────────────────


function Dashboard({
  cfg,
  data,
  onUpdate,
  onSave,
  saving,
  dirty,
  flash,
  onSignOut,
  logs,
  onClearLogs,
}: {
  cfg: Config;
  data: WidgetData | null;
  onUpdate: (field: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  flash: 'saved' | 'error' | null;
  onSignOut: () => void;
  logs: LogLine[];
  onClearLogs: () => void;
}) {
  const [tab, setTab] = useState<TabId>('overview');
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const fmtTime = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const navItems: { id: TabId; icon: string; label: string }[] = [
    { id: 'overview', icon: 'dashboard',          label: 'Overview'        },
    { id: 'github',   icon: 'settings_ethernet',   label: 'GitHub Settings' },
    { id: 'docker',   icon: 'terminal',             label: 'Docker Daemon'   },
    { id: 'servers',  icon: 'dns',                  label: 'Servers/VPS'     },
    { id: 'logs',     icon: 'receipt_long',          label: 'Logs'            },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface mac-drag">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 h-full w-[240px] apple-sidebar border-r border-outline flex flex-col pt-12 pb-md px-sm z-50">
        {/* Header */}
        <div className="mb-xl px-sm mac-no-drag">
          <div className="flex items-center gap-sm mb-xs">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined filled font-bold" style={{ fontSize: 20 }}>sensors</span>
            </div>
            <h1 className="text-headline-sm font-headline-sm font-semibold text-on-surface">Glance</h1>
          </div>
          <p className="text-body-sm font-body-sm text-on-surface-variant">v1.0.4 - Agent Running</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-xs overflow-y-auto custom-scrollbar mac-no-drag">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-sm px-sm py-sm rounded-lg transition-all duration-150 text-body-sm font-body-sm cursor-pointer text-left ${
                tab === item.id
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-auto pt-md border-t border-outline space-y-xs mac-no-drag">
          <button
            onClick={() => setTab('docs')}
            className={`w-full flex items-center gap-sm px-sm py-sm rounded-lg transition-all duration-150 text-body-sm font-body-sm cursor-pointer text-left ${
              tab === 'docs'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>
            <span>Docs</span>
          </button>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-sm px-sm py-sm rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all duration-150 text-body-sm font-body-sm cursor-pointer text-left"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main Canvas ─────────────────────────────────────────────────── */}
      <main className="ml-[240px] flex-1 flex flex-col h-screen overflow-hidden relative bg-background">
        {/* Top Bar */}
        <header className="min-h-[72px] flex flex-wrap justify-between items-center w-full px-md py-sm bg-background border-b border-outline z-40 mac-drag gap-sm">
          <div className="flex items-center gap-sm md:gap-md mac-no-drag min-w-0">
            <h2 className="text-headline-md font-headline-md font-bold text-on-surface tracking-tight truncate">System Console</h2>
            <div className="hidden md:block h-4 w-px bg-outline shrink-0" />
            <div className="hidden lg:flex items-center gap-xs px-sm py-xs bg-surface-container rounded border border-outline min-w-0">
              <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 14 }}>terminal</span>
              <span className="text-code-sm font-code-sm text-primary truncate">usr/bin/glance-agent --active</span>
            </div>
          </div>
          <div className="flex items-center gap-sm mac-no-drag shrink-0">
            <button className="flex items-center gap-xs px-sm py-xs text-on-surface-variant hover:text-on-surface transition-colors rounded cursor-pointer">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>sensors</span>
            </button>
            <div className="text-body-sm font-body-sm text-on-surface-variant whitespace-nowrap">
              Last Sync: {data ? fmtTime(data.updated_at) : '—'}
            </div>
          </div>
        </header>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <section className="flex-1 overflow-y-auto p-xl custom-scrollbar relative">
          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="animate-page-in space-y-xl">
              <div className="mb-md">
                <h3 className="text-headline-lg font-headline-lg text-on-surface mb-xs">Management Overview</h3>
                <p className="text-on-surface-variant font-body-md">Configure your local environments and remote infrastructure connections.</p>
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-12 gap-gutter">
                {/* GitHub Settings Card */}
                <div className="col-span-12 lg:col-span-8 bg-surface-container border border-outline rounded-xl p-md flex flex-col group hover:border-primary transition-colors">
                  <div className="flex justify-between items-start mb-md">
                    <div>
                      <div className="flex items-center gap-xs text-primary mb-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings_ethernet</span>
                        <span className="text-label-caps font-label-caps uppercase">Integrations</span>
                      </div>
                      <h4 className="text-headline-sm font-headline-sm text-on-surface">GitHub Settings</h4>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant opacity-30 group-hover:opacity-100 transition-opacity cursor-pointer" style={{ fontSize: 20 }}>open_in_new</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-md flex-1">
                    <div className="space-y-sm">
                      <label className="block text-label-caps font-label-caps text-on-surface-variant">Personal Access Token</label>
                      <div className="relative">
                        <input
                          className="mac-input pr-8"
                          type={showToken ? 'text' : 'password'}
                          value={cfg.github_token}
                          readOnly
                          placeholder="Not connected"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(v => !v)}
                          aria-label={showToken ? 'Hide token' : 'Show token'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showToken ? 'visibility_off' : 'visibility'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-on-surface-variant/60 font-body-sm">Required for repo discovery and CI/CD triggers.</p>
                    </div>
                    <div className="space-y-sm">
                      <label className="block text-label-caps font-label-caps text-on-surface-variant">Connected Account</label>
                      <div className="space-y-xs">
                        {cfg.github_username ? (
                          <div className="flex items-center justify-between p-2 bg-background border border-outline rounded text-body-sm">
                            <div className="flex items-center gap-sm">
                              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>person</span>
                              <span className="font-code-sm text-on-surface">@{cfg.github_username}</span>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">active</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-2 bg-background border border-outline rounded text-body-sm">
                            <span className="text-on-surface-variant text-body-sm">No account connected</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Today's activity stats */}
                  {data?.github && !data.github.error && (
                    <div className="grid grid-cols-2 gap-sm mt-md pt-md border-t border-outline">
                      <div className="bg-background border border-outline rounded-lg p-sm text-center">
                        <div className="text-label-caps font-label-caps text-on-surface-variant mb-xs">COMMITS TODAY</div>
                        <div className="text-[22px] font-bold text-primary font-mono leading-none">{data.github.commits}</div>
                      </div>
                      <div className="bg-background border border-outline rounded-lg p-sm text-center">
                        <div className="text-label-caps font-label-caps text-on-surface-variant mb-xs">CONTRIBUTIONS</div>
                        <div className="text-[22px] font-bold text-on-surface font-mono leading-none">{data.github.contributions}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="col-span-12 lg:col-span-4 bg-surface-container border border-outline rounded-xl p-md flex flex-col group hover:border-primary transition-colors">
                  <div className="flex items-center gap-xs text-primary mb-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
                    <span className="text-label-caps font-label-caps uppercase">Runtime</span>
                  </div>
                  <h4 className="text-headline-sm font-headline-sm text-on-surface mb-md">Docker Daemon</h4>
                  <div className="space-y-md">
                    <div className="space-y-sm">
                      <label className="block text-label-caps font-label-caps text-on-surface-variant">Unix Socket Path</label>
                      <input className="mac-input" type="text" value="/var/run/docker.sock" readOnly />
                    </div>
                    <div className="flex items-center justify-between text-body-sm pt-2">
                      <span className="text-on-surface-variant">Status</span>
                      <span className="flex items-center gap-1.5 text-primary">
                        <span className="w-2 h-2 rounded-full bg-primary animate-status-pulse" />
                        {data?.docker.error ? 'Error' : 'Active'}
                      </span>
                    </div>
                    {data?.docker && !data.docker.error && (
                      <div className="flex items-center justify-between text-body-sm">
                        <span className="text-on-surface-variant">Containers</span>
                        <span className="text-on-surface font-code-sm">
                          <span className="text-primary">{data.docker.running}</span>
                          <span className="text-on-surface-variant mx-1">/</span>
                          <span className="text-warning">{data.docker.stopped}</span>
                          <span className="text-on-surface-variant/50 text-[11px] ml-1">({data.docker.total} total)</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Remote Servers Card */}
                <div className="col-span-12 bg-surface-container border border-outline rounded-xl p-md flex flex-col group hover:border-primary transition-colors">
                  <div className="flex justify-between items-center mb-md">
                    <div>
                      <div className="flex items-center gap-xs text-primary mb-1">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>dns</span>
                        <span className="text-label-caps font-label-caps uppercase">Infrastructure</span>
                      </div>
                      <h4 className="text-headline-sm font-headline-sm text-on-surface">Remote Servers</h4>
                    </div>
                    <button className="flex items-center gap-xs bg-background border border-outline px-md py-1.5 rounded font-body-sm text-body-sm hover:bg-white/5 transition-colors cursor-pointer">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                      Add Node
                    </button>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full text-left text-body-sm border-collapse">
                      <thead className="text-on-surface-variant text-label-caps font-label-caps border-b border-outline">
                        <tr>
                          <th className="pb-2 font-semibold uppercase tracking-wider">Hostname</th>
                          <th className="pb-2 font-semibold uppercase tracking-wider">IP Address</th>
                          <th className="pb-2 font-semibold uppercase tracking-wider">SSH Config</th>
                          <th className="pb-2 font-semibold uppercase tracking-wider">Last Sync</th>
                          <th className="pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline/30">
                        {cfg.server_host ? (
                          <tr className="hover:bg-white/5 transition-colors">
                            <td className="py-md font-medium text-on-surface">{cfg.server_host}</td>
                            <td className="py-md font-code-sm text-on-surface-variant">{cfg.server_host}</td>
                            <td className="py-md font-code-sm text-on-surface-variant">ICMP/HTTP</td>
                            <td className="py-md text-on-surface-variant italic">
                              {data?.server ? (
                                <span className={`flex items-center gap-1.5 ${data.server.online ? 'text-primary' : 'text-warning'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${data.server.online ? 'bg-primary' : 'bg-warning'}`} />
                                  {data.server.online ? `${data.server.latency.toFixed(1)} ms` : 'Offline'}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-md text-right">
                              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors" style={{ fontSize: 20 }}>settings</span>
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-md text-on-surface-variant text-center text-body-sm italic">
                              No servers configured. Add a node to get started.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── GITHUB SETTINGS ── */}
          {tab === 'github' && (
            <div className="max-w-2xl mx-auto animate-page-in space-y-xl">
              <div className="mb-md">
                <h3 className="text-headline-lg font-headline-lg text-on-surface mb-xs">GitHub Settings</h3>
                <p className="text-on-surface-variant font-body-md">Manage your GitHub OAuth application credentials.</p>
              </div>

              <div className="bg-surface-container border border-outline rounded-xl p-md">
                <div className="flex items-center gap-xs text-primary mb-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings_ethernet</span>
                  <span className="text-label-caps font-label-caps uppercase">Integrations</span>
                </div>
                <h4 className="text-headline-sm font-headline-sm text-on-surface mb-md">GitHub Settings</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div className="space-y-sm">
                    <label className="block text-label-caps font-label-caps text-on-surface-variant">OAuth Client ID</label>
                    <input
                      className="mac-input"
                      value={cfg.client_id}
                      onChange={e => onUpdate('client_id', e.target.value)}
                      placeholder="Ov23li..."
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <p className="text-[11px] text-on-surface-variant/60 font-body-sm">Required for OAuth sign-in flow.</p>
                  </div>
                  <div className="space-y-sm">
                    <label className="block text-label-caps font-label-caps text-on-surface-variant">OAuth Client Secret</label>
                    <div className="relative">
                      <input
                        className="mac-input pr-8"
                        type={showSecret ? 'text' : 'password'}
                        value={cfg.client_secret}
                        onChange={e => onUpdate('client_secret', e.target.value)}
                        placeholder="••••••••••••••••••••"
                        spellCheck={false}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(v => !v)}
                        aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showSecret ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-on-surface-variant/60 font-body-sm">
                      Callback URL: <code className="text-primary font-mono text-[10px]">http://localhost:57321/oauth/callback</code>
                    </p>
                  </div>
                </div>

                {cfg.github_token && (
                  <div className="mt-md pt-md border-t border-outline">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-sm">
                        <div className="w-2 h-2 rounded-full bg-primary animate-status-pulse" />
                        <span className="text-body-sm font-body-sm text-on-surface">Connected as <strong className="text-primary">@{cfg.github_username}</strong></span>
                      </div>
                      <button
                        onClick={onSignOut}
                        className="text-body-sm font-body-sm text-warning hover:text-warning/80 transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-md flex justify-end gap-sm">
                  <button
                    onClick={onSave}
                    disabled={saving || !dirty}
                    className="bg-primary text-on-primary px-md py-1.5 rounded font-body-sm text-body-sm font-semibold hover:brightness-110 active:scale-95 duration-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {saving ? 'Saving…' : flash === 'saved' ? 'Saved ✓' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── DOCKER DAEMON ── */}
          {tab === 'docker' && (
            <div className="w-full max-w-[1600px] animate-page-in space-y-xl">
              <div className="mb-md">
                <h3 className="text-headline-md md:text-headline-lg font-headline-lg text-on-surface mb-xs">Docker Daemon</h3>
                <p className="text-on-surface-variant font-body-md">Local Docker runtime statistics and socket configuration.</p>
              </div>

              <div className="bg-surface-container border border-outline rounded-xl p-md">
              <div className="flex flex-wrap items-start justify-between gap-sm mb-md">
                <div className="min-w-0">
                  <div className="flex items-center gap-xs text-primary mb-1">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
                    <span className="text-label-caps font-label-caps uppercase">Runtime</span>
                  </div>
                  <h4 className="text-headline-sm font-headline-sm text-on-surface">Docker Daemon</h4>
                </div>
              </div>

                <div className="space-y-md">
                  <div className="space-y-sm">
                    <label className="block text-label-caps font-label-caps text-on-surface-variant">Unix Socket Path</label>
                    <input className="mac-input" type="text" value="/var/run/docker.sock" readOnly />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-md pt-2">
                    <div className="bg-background border border-outline rounded-lg p-md text-center">
                      <div className="text-label-caps font-label-caps text-on-surface-variant mb-sm">RUNNING</div>
                      <div className="text-[28px] font-bold text-primary font-mono leading-none">
                        {data?.docker.error ? '—' : (data?.docker.running ?? 0)}
                      </div>
                    </div>
                    <div className="bg-background border border-outline rounded-lg p-md text-center">
                      <div className="text-label-caps font-label-caps text-on-surface-variant mb-sm">STOPPED</div>
                      <div className="text-[28px] font-bold text-warning font-mono leading-none">
                        {data?.docker.error ? '—' : (data?.docker.stopped ?? 0)}
                      </div>
                    </div>
                    <div className="bg-background border border-outline rounded-lg p-md text-center">
                      <div className="text-label-caps font-label-caps text-on-surface-variant mb-sm">TOTAL</div>
                      <div className="text-[28px] font-bold text-on-surface font-mono leading-none">
                        {data?.docker.error ? '—' : (data?.docker.total ?? 0)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-body-sm pt-2 border-t border-outline">
                    <span className="text-on-surface-variant">Status</span>
                    <span className="flex items-center gap-1.5 text-primary">
                      <span className="w-2 h-2 rounded-full bg-primary animate-status-pulse" />
                      {data?.docker.error ? <span className="text-warning">{data.docker.error}</span> : 'Active'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-body-sm">
                    <span className="text-on-surface-variant">Version</span>
                    <span className="text-on-surface font-code-sm">{data?.docker.version || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Container list with logs & lifecycle actions */}
              <DockerContainers />
            </div>
          )}

          {/* ── SERVERS/VPS ── */}
          {tab === 'servers' && (
            <div className="max-w-2xl mx-auto animate-page-in space-y-xl">
              <div className="mb-md">
                <h3 className="text-headline-lg font-headline-lg text-on-surface mb-xs">Servers / VPS</h3>
                <p className="text-on-surface-variant font-body-md">Track remote infrastructure latency and uptime.</p>
              </div>

              <div className="bg-surface-container border border-outline rounded-xl p-md">
                <div className="flex justify-between items-center mb-md">
                  <div>
                    <div className="flex items-center gap-xs text-primary mb-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>dns</span>
                      <span className="text-label-caps font-label-caps uppercase">Infrastructure</span>
                    </div>
                    <h4 className="text-headline-sm font-headline-sm text-on-surface">Remote Servers</h4>
                  </div>
                </div>

                <div className="space-y-md">
                  <div className="space-y-sm">
                    <label className="block text-label-caps font-label-caps text-on-surface-variant">Server Host / IP</label>
                    <input
                      className="mac-input"
                      value={cfg.server_host}
                      onChange={e => onUpdate('server_host', e.target.value)}
                      placeholder="e.g. 192.168.1.42 or vps.example.com"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <p className="text-[11px] text-on-surface-variant/60 font-body-sm">
                      Glance will continuously ping this host using ICMP, falling back to HTTPS checks.
                    </p>
                  </div>

                  {data?.server && (
                    <div className="pt-md border-t border-outline">
                      <div className="flex items-center justify-between text-body-sm">
                        <span className="text-on-surface-variant">Current Status</span>
                        <span className={`flex items-center gap-1.5 font-semibold ${data.server.online ? 'text-primary' : 'text-warning'}`}>
                          <span className={`w-2 h-2 rounded-full ${data.server.online ? 'bg-primary animate-status-pulse' : 'bg-warning'}`} />
                          {data.server.online ? `Online — ${data.server.latency.toFixed(1)} ms` : 'Offline / Unreachable'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-body-sm mt-2">
                        <span className="text-on-surface-variant">Host</span>
                        <span className="font-code-sm text-on-surface">{data.server.host || cfg.server_host || '—'}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={onSave}
                      disabled={saving || !dirty}
                      className="bg-primary text-on-primary px-md py-1.5 rounded font-body-sm text-body-sm font-semibold hover:brightness-110 active:scale-95 duration-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {saving ? 'Saving…' : flash === 'saved' ? 'Saved ✓' : 'Save Server Target'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── LOGS ── */}
          {tab === 'logs' && (
            <div className="animate-page-in h-[calc(100vh-130px)] flex flex-col">
              <div className="mb-md">
                <h3 className="text-headline-lg font-headline-lg text-on-surface mb-xs">Console Logs</h3>
                <p className="text-on-surface-variant font-body-md">Real-time agent output and sync events.</p>
              </div>

              <div className="flex-1 glass-panel border border-outline rounded-xl flex flex-col overflow-hidden">
                <div className="bg-surface-container-high px-md py-sm flex items-center justify-between border-b border-outline">
                  <div className="flex items-center gap-sm">
                    <div className="w-2 h-2 rounded-full bg-primary animate-status-pulse" />
                    <span className="text-label-caps font-label-caps text-primary uppercase">Status: Agent Running</span>
                  </div>
                  <button
                    onClick={onClearLogs}
                    className="text-on-surface-variant hover:text-on-surface transition-colors text-body-sm font-body-sm cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div ref={logRef} className="flex-1 p-md text-code-sm font-code-sm text-on-surface-variant custom-scrollbar overflow-y-auto space-y-1 bg-black/40 select-text">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-white/20 select-none shrink-0">{log.time}</span>
                      <span className={log.color}>[{log.tag}]</span>
                      <span className="text-on-surface">{log.msg}</span>
                    </div>
                  ))}
                  <div className="flex gap-2 items-center">
                    <span className="text-white/20 select-none">{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
                    <span className="text-primary/70">[LOG]</span>
                    <span className="w-2 h-4 bg-primary/40 cursor-blink ml-1 inline-block" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DOCS ── */}
          {tab === 'docs' && (
            <div className="max-w-2xl mx-auto animate-page-in space-y-xl">
              <div className="mb-md">
                <h3 className="text-headline-lg font-headline-lg text-on-surface mb-xs">Documentation</h3>
                <p className="text-on-surface-variant font-body-md">Learn how Glance's hybrid architecture works.</p>
              </div>

              <div className="bg-surface-container border border-outline rounded-xl p-md space-y-md">
                <div>
                  <h4 className="text-headline-sm font-headline-sm text-on-surface mb-sm">Architecture Overview</h4>
                  <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                    Glance is a hybrid macOS desktop application combining a Go + Wails agent binary with a native Swift WidgetKit extension. The Go agent runs a background ticker every 30 seconds, fetching GitHub contributions, Docker container stats, and server latency data, then writing the results atomically to a local JSON file.
                  </p>
                </div>

                <div className="border-t border-outline pt-md">
                  <h4 className="text-headline-sm font-headline-sm text-on-surface mb-sm">Data Pipeline</h4>
                  <div className="space-y-sm">
                    {[
                      { icon: 'account_tree', label: 'GitHub GraphQL API', desc: 'Fetches today\'s contribution count using OAuth token.' },
                      { icon: 'terminal',     label: 'Docker Socket',      desc: 'Reads /var/run/docker.sock for container stats.' },
                      { icon: 'dns',          label: 'ICMP/HTTP Ping',     desc: 'Pings configured server host for latency tracking.' },
                      { icon: 'folder',       label: 'Widget Data File',   desc: '~/Library/Application Support/Glance/widget_data.json' },
                    ].map(item => (
                      <div key={item.label} className="flex items-start gap-sm p-sm bg-background border border-outline rounded">
                        <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: 18 }}>{item.icon}</span>
                        <div>
                          <div className="text-body-sm font-body-sm text-on-surface font-semibold">{item.label}</div>
                          <div className="text-[11px] text-on-surface-variant">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-outline pt-md">
                  <h4 className="text-headline-sm font-headline-sm text-on-surface mb-sm">WidgetKit Integration</h4>
                  <p className="text-body-sm font-body-sm text-on-surface-variant leading-relaxed">
                    The native Swift widget reads <code className="text-primary font-mono text-[11px]">widget_data.json</code> from the app's shared container. Ensure <code className="text-primary font-mono text-[11px]">com.apple.security.app-sandbox</code> is set to <code className="text-primary font-mono text-[11px]">false</code> in the widget's entitlements for file access.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Floating Log Console (Bottom Right) ─────────────────────── */}
        {tab !== 'logs' && (
          <LogConsole logs={logs} />
        )}
      </main>
    </div>
  );
}

// ─── Floating Log Console ─────────────────────────────────────────────────────

function LogConsole({ logs }: { logs: LogLine[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && !collapsed) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs, collapsed]);

  const recent = logs.slice(-20);

  return (
    <div className="absolute bottom-md right-md w-80 z-50 mac-no-drag">
      <div className="glass-panel border border-outline rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-surface-container-high px-md py-sm flex items-center justify-between border-b border-outline">
          <div className="flex items-center gap-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-status-pulse" />
            <span className="text-label-caps font-label-caps text-primary uppercase">Status: Agent Running</span>
          </div>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{collapsed ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>
        {!collapsed && (
          <div ref={ref} className="p-md text-code-sm font-code-sm text-on-surface-variant custom-scrollbar overflow-y-auto space-y-1 bg-black/40 max-h-48">
            {recent.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-white/20 select-none shrink-0">{log.time}</span>
                <span className={log.color}>[{log.tag}]</span>
                <span className="text-on-surface">{log.msg}</span>
              </div>
            ))}
            <div className="flex gap-2 items-center">
              <span className="text-white/20 select-none">{new Date().toLocaleTimeString('en-GB', { hour12: false })}</span>
              <span className="text-primary/70">[LOG]</span>
              <span className="w-2 h-4 bg-primary/40 cursor-blink ml-1 inline-block" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GitHub SVG Icon ──────────────────────────────────────────────────────────

function GithubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.34-3.369-1.34-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [cfg, setCfg] = useState<Config>({
    github_username: '',
    github_token: '',
    client_id: '',
    client_secret: '',
    server_host: '',
  });
  const [data, setData]           = useState<WidgetData | null>(null);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [flash, setFlash]         = useState<'saved' | 'error' | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [logs, setLogs]           = useState<LogLine[]>([
    { time: now(), tag: 'SYS', msg: 'System initialized',    color: 'text-primary/70' },
    { time: now(), tag: 'SYS', msg: 'Glance Agent started',  color: 'text-primary/70' },
  ]);

  function now() {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
  }

  function pushLog(tag: string, msg: string) {
    const color =
      tag === 'GIT'  ? 'text-primary/70' :
      tag === 'NET'  ? 'text-primary/70' :
      tag === 'DOCK' ? 'text-warning/70' :
      tag === 'ERR'  ? 'text-error/80'   :
                       'text-primary/70';
    setLogs(prev => [...prev, { time: now(), tag, msg, color }].slice(-100));
  }

  useEffect(() => {
    GetConfig().then(setCfg);

    const poll = async () => {
      const d = await GetLastData();
      if (d?.updated_at) setData(d);
    };
    poll();
    const pollId = setInterval(poll, 5_000);

    const offSuccess = EventsOn('oauth_success', (username: string) => {
      setIsSigningIn(false);
      GetConfig().then(setCfg);
      pushLog('GIT', `Connected to GitHub as @${username}`);
    });

    const offError = EventsOn('oauth_error', (msg: string) => {
      setIsSigningIn(false);
      pushLog('ERR', `OAuth failed: ${msg}`);
      alert('OAuth connection failed: ' + msg);
    });

    const offLog = EventsOn('agent_log', (payload: { tag: string; msg: string }) => {
      pushLog(payload.tag || 'SYS', payload.msg || '');
    });

    return () => {
      clearInterval(pollId);
      offSuccess();
      offError();
      offLog();
    };
  }, []);

  function update(field: string, value: string) {
    setCfg(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setFlash(null);
  }

  async function save() {
    setSaving(true);
    try {
      await SaveConfig(cfg);
      setDirty(false);
      setFlash('saved');
      pushLog('SYS', 'Configuration saved.');
      setTimeout(() => setFlash(null), 2000);
    } catch {
      setFlash('error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignIn() {
    if (!cfg.client_id || !cfg.client_secret) {
      alert('Please enter your Client ID and Client Secret first.');
      return;
    }
    setIsSigningIn(true);
    try {
      await StartOAuthFlow(cfg.client_id, cfg.client_secret);
    } catch (e) {
      setIsSigningIn(false);
      alert('OAuth error: ' + e);
    }
  }

  async function handleSignOut() {
    await SignOut();
    const updated = await GetConfig();
    setCfg(updated);
    pushLog('SYS', 'Signed out of GitHub.');
  }

  if (!cfg.github_token) {
    return (
      <SignInPage
        cfg={cfg}
        onUpdate={update}
        onSignIn={handleSignIn}
        isSigningIn={isSigningIn}
      />
    );
  }

  return (
    <Dashboard
      cfg={cfg}
      data={data}
      onUpdate={update}
      onSave={save}
      saving={saving}
      dirty={dirty}
      flash={flash}
      onSignOut={handleSignOut}
      logs={logs}
      onClearLogs={() => setLogs([])}
    />
  );
}
