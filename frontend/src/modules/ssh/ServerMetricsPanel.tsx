import type { ServerConfig, PingResult, ServerMetrics } from '../../types';
import { formatBytes, formatUptime, pct } from '../../utils/format';
import { MetricCard } from '../../components/MetricCard';

interface ServerMetricsPanelProps {
  server: ServerConfig;
  metrics: ServerMetrics | undefined;
  ping: PingResult | undefined;
  metricsLoading: boolean;
  fetchMetrics: (id: string) => void;
  onOpenTerminal: () => void;
}

export function ServerMetricsPanel({ server, metrics, ping, metricsLoading, fetchMetrics, onOpenTerminal }: ServerMetricsPanelProps) {
  return (
    <div className="h-full bg-surface-container border border-outline rounded-xl flex flex-col overflow-hidden">
      <div className="px-md py-sm border-b border-outline flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>monitoring</span>
          <div>
            <span className="text-body-sm font-body-sm font-semibold text-on-surface">{server.name}</span>
            <span className="text-on-surface-variant text-[11px] font-code-sm ml-sm">{server.username}@{server.ip}</span>
          </div>
          {ping && (
            <span className={`flex items-center gap-1 ml-md text-[11px] ${ping.online ? 'text-primary' : 'text-warning'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${ping.online ? 'bg-primary' : 'bg-warning'}`} />
              {ping.online ? `${ping.latency.toFixed(0)}ms` : 'Offline'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={() => fetchMetrics(server.id)}
            disabled={metricsLoading}
            className="flex items-center gap-xs px-sm py-xs rounded text-on-surface-variant hover:text-primary transition-colors text-body-sm font-body-sm cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{metricsLoading ? 'progress_activity' : 'refresh'}</span>
            Refresh
          </button>
          <button
            onClick={onOpenTerminal}
            className="flex items-center gap-xs bg-primary text-on-primary px-md py-xs rounded font-body-sm text-body-sm font-semibold hover:brightness-110 active:scale-95 duration-100 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
            Connect Terminal
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-md">
        {metrics?.error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="material-symbols-outlined text-error/50" style={{ fontSize: 48 }}>error</span>
            <p className="text-error text-body-sm mt-md font-code-sm">{metrics.error}</p>
            <p className="text-on-surface-variant text-[11px] mt-xs">Check credentials and network connectivity.</p>
          </div>
        ) : !metrics ? (
          <div className="flex items-center justify-center h-full">
            <span className="material-symbols-outlined text-on-surface-variant/30 animate-spin" style={{ fontSize: 32 }}>progress_activity</span>
          </div>
        ) : (
          <div className="space-y-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
              <MetricCard
                icon="memory"
                label="CPU Usage"
                value={`${metrics.cpu_usage.toFixed(1)}%`}
                sub={metrics.load_avg ? `Load: ${metrics.load_avg}` : undefined}
                pctVal={metrics.cpu_usage}
                color="#0A84FF"
              />
              <MetricCard
                icon="memory_alt"
                label="Memory"
                value={formatBytes(metrics.mem_used)}
                sub={`of ${formatBytes(metrics.mem_total)}`}
                pctVal={pct(metrics.mem_used, metrics.mem_total)}
                color="#30D158"
              />
              <MetricCard
                icon="storage"
                label="Disk"
                value={formatBytes(metrics.disk_used)}
                sub={`of ${formatBytes(metrics.disk_total)}`}
                pctVal={pct(metrics.disk_used, metrics.disk_total)}
                color="#FF9500"
              />
              <MetricCard
                icon="schedule"
                label="Uptime"
                value={formatUptime(metrics.uptime)}
                sub={metrics.load_avg ? `Load avg: ${metrics.load_avg}` : undefined}
                color="#BF5AF2"
              />
            </div>

            <div className="bg-background border border-outline rounded-lg p-md">
              <div className="text-label-caps font-label-caps text-on-surface-variant uppercase mb-sm">Connection Details</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md text-body-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Host</span>
                  <span className="font-code-sm text-on-surface">{server.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Port</span>
                  <span className="font-code-sm text-on-surface">{server.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">User</span>
                  <span className="font-code-sm text-on-surface">{server.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Auth</span>
                  <span className="font-code-sm text-on-surface">{server.auth_method === 'private_key' ? 'Private Key' : 'Password'}</span>
                </div>
              </div>
            </div>

            <div className="bg-background border border-outline rounded-lg p-md">
              <div className="text-label-caps font-label-caps text-on-surface-variant uppercase mb-sm">Quick Actions</div>
              <div className="flex flex-wrap gap-sm">
                <button
                  onClick={onOpenTerminal}
                  className="flex items-center gap-xs px-md py-xs bg-surface-container-high border border-outline rounded text-body-sm font-body-sm text-on-surface hover:border-primary hover:text-primary transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
                  Open SSH Shell
                </button>
                <button
                  onClick={() => fetchMetrics(server.id)}
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
  );
}
