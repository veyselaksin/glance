import { Fragment } from 'react';
import type { ContainerInfo } from '../../types';
import { formatBytes } from '../../utils/format';
import { useAutoScroll } from '../../hooks/useAutoScroll';

interface DockerContainersProps {
  containers: ContainerInfo[];
  loading: boolean;
  error: string | null;
  expandedId: string | null;
  logs: string;
  logsLoading: boolean;
  logsError: string | null;
  actionPending: string | null;
  fetchContainers: () => void;
  handleLogs: (id: string) => void;
  handleStop: (id: string) => void;
  handleStart: (id: string) => void;
  handleDelete: (id: string) => void;
}

export function DockerContainers({
  containers, loading, error,
  expandedId, logs, logsLoading, logsError, actionPending,
  fetchContainers, handleLogs, handleStop, handleStart, handleDelete,
}: DockerContainersProps) {
  const logRef = useAutoScroll([logs]);

  return (
    <div className="bg-surface-container border border-outline rounded-xl overflow-visible">
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
