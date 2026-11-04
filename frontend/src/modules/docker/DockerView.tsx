import { Icon } from '../../components/Icon';
import type { AppData } from '../../types';
import { Button } from '../../components/Group';
import { useCallback } from 'react';
import { useContainers } from './useContainers';
import { useDockerDaemon } from './useDockerDaemon';
import { refreshNow } from '../../services/app.service';
import { DockerContainers } from './DockerContainers';
import { Toast } from '../../components/Toast';

interface DockerViewProps {
  data: AppData | null;
  socket: string;
  onOpenSettings: () => void;
}

function Count({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="px-4 py-3 min-w-[96px]">
      <div className="text-body-sm text-on-surface-variant">{label}</div>
      <div className={`mt-0.5 text-[24px] leading-7 font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export function DockerView({ data, socket, onOpenSettings }: DockerViewProps) {
  const ctrl = useContainers();
  const { fetchContainers } = ctrl;
  const onDaemonStarted = useCallback(() => {
    refreshNow().catch(() => {});
    fetchContainers();
  }, [fetchContainers]);
  const daemon = useDockerDaemon(onDaemonStarted);
  const dk = data?.docker;
  const daemonDown = !!dk?.error || !!ctrl.error;
  const n = (v: number | undefined) => (daemonDown || v === undefined ? '\u2014' : v);

  return (
    <div className="w-full max-w-[1200px] mx-auto animate-page-in space-y-6">
      <div className="bg-surface-container border border-outline rounded-xl card-shadow overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-outline">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${daemonDown ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>
            <Icon name="container" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-body-md font-semibold text-on-surface">
              {daemonDown ? 'Docker isn\u2019t running' : 'Docker is running'}
              {!daemonDown && dk?.version && (
                <span className="px-1.5 py-px rounded bg-surface-container-high text-body-sm font-normal text-on-surface-variant tabular-nums">v{dk.version}</span>
              )}
            </div>
            <div className="text-body-sm text-on-surface-variant truncate">
              {daemonDown
                ? (daemon.runtime ? `Start ${daemon.runtime} to manage your containers.` : 'No Docker runtime found. Install Docker Desktop, OrbStack or Colima.')
                : 'Connected to the local daemon.'}
            </div>
          </div>
          {daemonDown && daemon.runtime && (
            <Button variant="primary" onClick={daemon.start} disabled={daemon.starting}>
              <Icon name={daemon.starting ? 'progress_activity' : 'play_arrow'} size={13} />
              {daemon.starting ? `Starting ${daemon.runtime}\u2026` : `Start ${daemon.runtime}`}
            </Button>
          )}
        </div>

        {daemon.error && (
          <div className="px-4 py-2 flex items-start gap-2 text-body-sm text-error bg-error/10 border-b border-outline">
            <Icon name="error" size={14} className="mt-px" />
            <span>{daemon.error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-stretch divide-x divide-outline">
          <Count label="Running" value={n(dk?.running)} tone="text-success" />
          <Count label="Stopped" value={n(dk?.stopped)} tone="text-on-surface-variant" />
          <Count label="Total" value={n(dk?.total)} tone="text-on-surface" />
          <div className="flex-1 min-w-[220px] px-4 py-3">
            <div className="text-body-sm text-on-surface-variant">Socket</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-code-sm text-on-surface truncate">{socket || '/var/run/docker.sock'}</span>
              <button onClick={onOpenSettings} className="text-body-sm text-primary hover:underline cursor-pointer shrink-0">Change\u2026</button>
            </div>
          </div>
        </div>
      </div>

      {ctrl.toast && (
        <div className="flex justify-center">
          <Toast toast={ctrl.toast} onDismiss={ctrl.dismissToast} />
        </div>
      )}

      <DockerContainers
        containers={ctrl.containers}
        statsMap={ctrl.statsMap}
        loading={ctrl.loading}
        error={ctrl.error}
        expandedId={ctrl.expandedId}
        logs={ctrl.logs}
        logsLoading={ctrl.logsLoading}
        logsError={ctrl.logsError}
        actionPending={ctrl.actionPending}
        fetchContainers={ctrl.fetchContainers}
        handleLogs={ctrl.handleLogs}
        handleStop={ctrl.handleStop}
        handleStart={ctrl.handleStart}
        handleRestart={ctrl.handleRestart}
        handleDelete={ctrl.handleDelete}
      />
    </div>
  );
}
