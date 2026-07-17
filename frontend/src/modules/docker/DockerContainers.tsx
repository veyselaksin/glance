import { Fragment, memo } from 'react';
import type { RefObject } from 'react';
import type { ContainerInfo } from '../../types';
import type { ContainerStats } from './useContainers';
import { formatBytes } from '../../utils/format';
import { useAutoScroll } from '../../hooks/useAutoScroll';

interface DockerContainersProps {
  containers: ContainerInfo[];
  statsMap: Record<string, ContainerStats>;
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
  handleRestart: (id: string) => void;
  handleDelete: (id: string) => void;
}

function statsEq(a: ContainerStats | undefined, b: ContainerStats | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.cpu_usage === b.cpu_usage
    && a.mem_usage === b.mem_usage
    && a.mem_percent === b.mem_percent
    && a.network_rx === b.network_rx
    && a.network_tx === b.network_tx
    && a.io_read === b.io_read
    && a.io_write === b.io_write
    && a.pid_count === b.pid_count;
}

interface ContainerRowProps {
  c: ContainerInfo;
  stats: ContainerStats | undefined;
  isExpanded: boolean;
  actionPending: string | null;
  logs: string;
  logsLoading: boolean;
  logsError: string | null;
  logRef: RefObject<HTMLDivElement>;
  onLogs: (id: string) => void;
  onStop: (id: string) => void;
  onStart: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
}

const ContainerRow = memo(function ContainerRow({
  c, stats, isExpanded, actionPending,
  logs, logsLoading, logsError, logRef,
  onLogs, onStop, onStart, onRestart, onDelete,
}: ContainerRowProps) {
  const running = c.state === 'running';
  const s = stats;

  return (
    <Fragment>
      <tr className="hover:bg-white/5 transition-colors">
        <td className="px-sm lg:px-md py-sm min-w-0">
          <div className="flex items-center gap-sm min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${running ? 'bg-primary animate-status-pulse' : 'bg-warning'}`} />
            <span className="font-medium text-on-surface truncate">{c.name || c.id.slice(0, 12)}</span>
          </div>
        </td>
        <td className="px-sm lg:px-md py-sm font-code-sm text-on-surface-variant max-w-[160px] truncate hidden 2xl:table-cell" title={c.image}>{c.image}</td>
        <td className="px-sm lg:px-md py-sm">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-code-sm ${
            running ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
          }`}>
            {c.status || c.state}
          </span>
        </td>
        <td className="px-sm lg:px-md py-sm font-code-sm text-on-surface-variant whitespace-nowrap">
          {running && s ? `${s.cpu_usage.toFixed(1)}%` : '\u2014'}
        </td>
        <td className="px-sm lg:px-md py-sm font-code-sm text-on-surface-variant whitespace-nowrap hidden sm:table-cell">
          {running && s && s.mem_usage > 0 ? formatBytes(s.mem_usage) : '\u2014'}
        </td>
        <td className="px-sm lg:px-md py-sm font-code-sm text-on-surface-variant whitespace-nowrap hidden md:table-cell">
          {running && s ? `${s.mem_percent.toFixed(1)}%` : '\u2014'}
        </td>
        <td className="px-sm lg:px-md py-sm font-code-sm text-on-surface-variant whitespace-nowrap hidden lg:table-cell" title={s ? `${s.network_rx} B` : ''}>
          {running && s ? formatBytes(s.network_rx) : '\u2014'}
        </td>
        <td className="px-sm lg:px-md py-sm font-code-sm text-on-surface-variant whitespace-nowrap hidden lg:table-cell" title={s ? `${s.network_tx} B` : ''}>
          {running && s ? formatBytes(s.network_tx) : '\u2014'}
        </td>
        <td className="px-sm lg:px-md py-sm font-code-sm text-on-surface-variant whitespace-nowrap hidden xl:table-cell">
          {running && s && (s.io_read > 0 || s.io_write > 0)
            ? `${formatBytes(s.io_read)} / ${formatBytes(s.io_write)}`
            : '\u2014'}
        </td>
        <td className="px-sm lg:px-md py-sm font-code-sm text-on-surface-variant whitespace-nowrap hidden xl:table-cell">
          {running && s ? s.pid_count : '\u2014'}
        </td>
        <td className="px-sm lg:px-md py-sm">
          <div className="flex items-center justify-end gap-xs">
            {running ? (
              <>
                <button
                  onClick={() => onStop(c.id)}
                  disabled={actionPending === c.id + ':stop'}
                  aria-label="Stop container"
                  className="group relative flex items-center justify-center w-7 h-7 rounded text-on-surface-variant hover:text-warning hover:bg-warning/10 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <span className={`material-symbols-outlined ${actionPending !== c.id + ':stop' ? 'filled' : ''}`} style={{ fontSize: 18 }}>
                    {actionPending === c.id + ':stop' ? 'progress_activity' : 'stop_circle'}
                  </span>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline text-[10px] text-on-surface font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-20">Stop</span>
                </button>
                <button
                  onClick={() => onRestart(c.id)}
                  disabled={actionPending === c.id + ':restart'}
                  aria-label="Restart container"
                  className="group relative flex items-center justify-center w-7 h-7 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {actionPending === c.id + ':restart' ? 'progress_activity' : 'restart_alt'}
                  </span>
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline text-[10px] text-on-surface font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-20">Restart</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => onStart(c.id)}
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
              onClick={() => onLogs(c.id)}
              aria-label={isExpanded ? 'Hide logs' : 'View logs'}
              className={`group relative flex items-center justify-center w-7 h-7 rounded transition-colors cursor-pointer ${
                isExpanded ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
              <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-surface-container-highest border border-outline text-[10px] text-on-surface font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-20">{isExpanded ? 'Hide logs' : 'View logs'}</span>
            </button>
            <button
              onClick={() => onDelete(c.id)}
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
          <td colSpan={11} className="px-sm lg:px-md py-sm bg-black/50 border-t border-outline/50">
            <div className="rounded-lg border border-outline/60 overflow-hidden">
              <div className="flex items-center justify-between px-sm py-xs bg-surface-container-high border-b border-outline">
                <div className="flex items-center gap-xs text-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>subject</span>
                  <span className="text-label-caps font-label-caps uppercase">Container Logs \u2014 {c.name}</span>
                </div>
                <span className="text-[11px] text-on-surface-variant font-code-sm">last 200 lines</span>
              </div>
              <div
                ref={logRef}
                className="p-md max-h-96 overflow-y-auto custom-scrollbar bg-black/60 font-mono text-code-sm text-on-surface-variant whitespace-pre-wrap break-all leading-relaxed select-text"
              >
                {logsLoading ? (
                  <span className="text-primary/70">Fetching logs\u2026</span>
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
}, (prev, next) => {
  return prev.c.id === next.c.id
    && prev.c.state === next.c.state
    && prev.c.status === next.c.status
    && prev.isExpanded === next.isExpanded
    && prev.actionPending === next.actionPending
    && prev.logs === next.logs
    && prev.logsLoading === next.logsLoading
    && prev.logsError === next.logsError
    && statsEq(prev.stats, next.stats);
});

export function DockerContainers({
  containers, statsMap, loading, error,
  expandedId, logs, logsLoading, logsError, actionPending,
  fetchContainers, handleLogs, handleStop, handleStart, handleRestart, handleDelete,
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
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-body-sm border-collapse min-w-max">
            <thead className="text-on-surface-variant text-label-caps font-label-caps border-b border-outline">
              <tr>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider">Name</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider hidden 2xl:table-cell">Image</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider">Status</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider">CPU</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider hidden sm:table-cell">Mem</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider hidden md:table-cell">Mem%</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider hidden lg:table-cell">Net RX</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider hidden lg:table-cell">Net TX</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider hidden xl:table-cell">Disk R/W</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider hidden xl:table-cell">PIDs</th>
                <th className="px-sm lg:px-md py-sm font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/30">
              {containers.map(c => (
                <ContainerRow
                  key={c.id}
                  c={c}
                  stats={statsMap[c.id]}
                  isExpanded={expandedId === c.id}
                  actionPending={actionPending}
                  logs={logs}
                  logsLoading={logsLoading}
                  logsError={logsError}
                  logRef={logRef}
                  onLogs={handleLogs}
                  onStop={handleStop}
                  onStart={handleStart}
                  onRestart={handleRestart}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
