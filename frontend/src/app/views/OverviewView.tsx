import { useState } from 'react';
import type { Config, AppData, TabId } from '../../types';

interface OverviewViewProps {
  cfg: Config;
  data: AppData | null;
  onTabChange: (tab: TabId) => void;
}

export function OverviewView({ cfg, data, onTabChange }: OverviewViewProps) {
  const [showToken, setShowToken] = useState(false);

  return (
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
              <input
                className="mac-input"
                type="text"
                value={cfg.docker_socket || '/var/run/docker.sock'}
                readOnly
                placeholder="/var/run/docker.sock"
                spellCheck={false}
                autoComplete="off"
              />
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
        <div className="col-span-12 bg-surface-container border border-outline rounded-xl p-md flex flex-col">
          <div className="flex justify-between items-center mb-md">
            <div>
              <div className="flex items-center gap-xs text-primary mb-1">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>dns</span>
                <span className="text-label-caps font-label-caps uppercase">Infrastructure</span>
              </div>
              <h4 className="text-headline-sm font-headline-sm text-on-surface">Remote Servers</h4>
            </div>
            <button
              onClick={() => onTabChange('servers')}
              className="flex items-center gap-xs bg-background border border-outline px-md py-1.5 rounded font-body-sm text-body-sm hover:bg-white/5 transition-colors cursor-pointer"
            >
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
                  <tr>
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
                      <button
                        onClick={() => onTabChange('servers')}
                        aria-label="Server settings"
                        className="text-on-surface-variant cursor-pointer hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>settings</span>
                      </button>
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
  );
}
