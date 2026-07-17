import type { Config, AppData } from '../../types';
import { useContainers } from './useContainers';
import { DockerContainers } from './DockerContainers';
import { Toast } from '../../components/Toast';

interface DockerViewProps {
  cfg: Config;
  data: AppData | null;
  onUpdate: (field: string, val: string) => void;
}

export function DockerView({ cfg, data, onUpdate }: DockerViewProps) {
  const ctrl = useContainers();

  return (
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
            <input
              className="mac-input"
              type="text"
              value={cfg.docker_socket || '/var/run/docker.sock'}
              onChange={e => onUpdate('docker_socket', e.target.value)}
              placeholder="/var/run/docker.sock"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-md pt-2">
            <div className="bg-background border border-outline rounded-lg p-md text-center">
              <div className="text-label-caps font-label-caps text-on-surface-variant mb-sm">RUNNING</div>
              <div className="text-[28px] font-bold text-primary font-mono leading-none">
                {data?.docker.error ? '\u2014' : (data?.docker.running ?? 0)}
              </div>
            </div>
            <div className="bg-background border border-outline rounded-lg p-md text-center">
              <div className="text-label-caps font-label-caps text-on-surface-variant mb-sm">STOPPED</div>
              <div className="text-[28px] font-bold text-warning font-mono leading-none">
                {data?.docker.error ? '\u2014' : (data?.docker.stopped ?? 0)}
              </div>
            </div>
            <div className="bg-background border border-outline rounded-lg p-md text-center">
              <div className="text-label-caps font-label-caps text-on-surface-variant mb-sm">TOTAL</div>
              <div className="text-[28px] font-bold text-on-surface font-mono leading-none">
                {data?.docker.error ? '\u2014' : (data?.docker.total ?? 0)}
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
            <span className="text-on-surface font-code-sm">{data?.docker.version || '\u2014'}</span>
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
