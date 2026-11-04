import { useState, type ReactNode } from 'react';
import type { Config, AppData, TabId } from '../../types';
import { Icon } from '../../components/Icon';
import { Group } from '../../components/Group';
import { CommitRow, DailyChart, RangePicker, useGithubActivity } from '../../modules/github/GithubActivity';

interface OverviewViewProps {
  cfg: Config;
  data: AppData | null;
  onTabChange: (tab: TabId) => void;
}

type Tone = 'ok' | 'warn' | 'idle';

const toneDot: Record<Tone, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  idle: 'bg-on-surface-variant/40',
};

interface TileProps {
  icon: string;
  title: string;
  tone: Tone;
  status: string;
  onClick: () => void;
  children: ReactNode;
}

/** Clickable summary card for one data source. */
function Tile({ icon, title, tone, status, onClick, children }: TileProps) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-surface-container border border-outline rounded-xl card-shadow p-4 flex flex-col gap-4 hover:border-primary/50 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon name={icon} size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body-md font-semibold text-on-surface">{title}</div>
          <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant truncate">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${toneDot[tone]}`} />
            <span className="truncate">{status}</span>
          </div>
        </div>
        <Icon name="chevron_right" size={15} className="text-on-surface-variant/50 group-hover:text-on-surface-variant transition-colors" />
      </div>
      <div className="flex items-end gap-6">{children}</div>
    </button>
  );
}

function Metric({ value, label, tone = 'text-on-surface' }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div>
      <div className={`text-[28px] leading-8 font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-body-sm text-on-surface-variant mt-0.5">{label}</div>
    </div>
  );
}

const dash = '—';

const RECENT = 6;

/** Recent commits on every branch, plus a daily chart and top repositories. */
function GithubActivityPanel({ todayCommits, onOpen }: { todayCommits?: number; onOpen: () => void }) {
  const [days, setDays] = useState(7);
  const { act, loading, error } = useGithubActivity(days, todayCommits);
  const now = Date.now();
  const top = act?.repos.slice(0, 4) ?? [];
  const maxRepo = Math.max(1, ...top.map(r => r.commits));
  const box = 'bg-surface-container border border-outline rounded-xl card-shadow overflow-hidden';

  return (
    <section className="space-y-1.5">
      <div className="px-1 flex items-center justify-between gap-3">
        <h2 className="text-body-sm font-semibold text-on-surface-variant flex items-center gap-2">
          GitHub activity
          {loading && <Icon name="progress_activity" size={12} className="animate-spin" />}
        </h2>
        <div className="flex items-center gap-3">
          <RangePicker value={days} onChange={setDays} />
          <button onClick={onOpen} className="text-body-sm text-primary hover:underline cursor-pointer">View all</button>
        </div>
      </div>

      {error && !act ? (
        <div className={`${box} px-4 py-3 flex items-start gap-2 text-body-md text-error`}>
          <Icon name="error" size={15} className="mt-0.5" />
          <span>{error}</span>
        </div>
      ) : !act ? (
        <div className={`${box} px-4 py-6 text-center text-body-md text-on-surface-variant`}>Loading commits from every branch…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={`${box} lg:col-span-2 divide-y divide-outline`}>
            {act.commits.length === 0 ? (
              <div className="px-4 py-6 text-center text-body-md text-on-surface-variant">
                No commits {days === 1 ? 'today' : `in the last ${days} days`}.
              </div>
            ) : (
              <>
                {act.commits.slice(0, RECENT).map(c => <CommitRow key={c.sha} c={c} now={now} />)}
                {act.commits.length > RECENT && (
                  <button onClick={onOpen} className="w-full px-4 py-2 text-body-sm text-primary hover:bg-surface-container-high cursor-pointer">
                    {act.commits.length - RECENT} more commit{act.commits.length - RECENT === 1 ? '' : 's'}
                  </button>
                )}
              </>
            )}
          </div>

          <div className={`${box} divide-y divide-outline`}>
            <div className="flex divide-x divide-outline">
              <div className="flex-1 px-4 py-3">
                <div className="text-body-sm text-on-surface-variant">Commits</div>
                <div className="mt-1 text-[22px] leading-7 font-semibold tabular-nums text-primary">{act.total}</div>
              </div>
              <div className="flex-1 px-4 py-3">
                <div className="text-body-sm text-on-surface-variant">Repositories</div>
                <div className="mt-1 text-[22px] leading-7 font-semibold tabular-nums text-on-surface">{act.repos.length}</div>
              </div>
            </div>
            {days > 1 && <DailyChart commits={act.commits} since={act.since} days={days} />}
            {top.length > 0 && (
              <div className="px-4 py-3 space-y-2.5">
                {top.map(r => (
                  <div key={r.repo} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-body-sm">
                      <span className="truncate text-on-surface">{r.repo.split('/').pop()}</span>
                      <span className="tabular-nums text-on-surface-variant">{r.commits}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-outline/60 overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(r.commits / maxRepo) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function OverviewView({ cfg, data, onTabChange }: OverviewViewProps) {
  const gh = data?.github;
  const dk = data?.docker;
  const sv = data?.server;

  const ghTone: Tone = !gh ? 'idle' : gh.error || gh.warning ? 'warn' : 'ok';
  const dkTone: Tone = !dk ? 'idle' : dk.error ? 'warn' : 'ok';
  const svTone: Tone = !cfg.server_host || !sv ? 'idle' : sv.online ? 'ok' : 'warn';

  const issues: { icon: string; text: string; action: string; tab: TabId }[] = [];
  if (gh?.error) issues.push({ icon: 'github', text: `GitHub: ${gh.error}`, action: 'Open GitHub', tab: 'github' });
  else if (gh?.warning) issues.push({ icon: 'github', text: 'GitHub: token has no repository access, commits are not counted', action: 'Open GitHub', tab: 'github' });
  if (dk?.error) issues.push({ icon: 'container', text: 'Docker daemon is not reachable', action: 'Open Docker', tab: 'docker' });
  else if (dk && dk.stopped > 0) issues.push({ icon: 'container', text: `${dk.stopped} stopped container${dk.stopped === 1 ? '' : 's'}`, action: 'Review', tab: 'docker' });
  if (cfg.server_host && sv && !sv.online) issues.push({ icon: 'dns', text: `${cfg.server_host} is unreachable`, action: 'Open Servers', tab: 'servers' });
  if (!cfg.server_host) issues.push({ icon: 'dns', text: 'No primary server set for health checks', action: 'Settings', tab: 'settings' });

  return (
    <div className="max-w-[1200px] mx-auto animate-page-in space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Tile
          icon="github"
          title="GitHub"
          tone={ghTone}
          status={cfg.github_username ? `@${cfg.github_username}` : 'Not connected'}
          onClick={() => onTabChange('github')}
        >
          <Metric value={gh && !gh.error ? gh.commits : dash} label="Commits today" tone="text-primary" />
          <Metric value={gh && !gh.error ? gh.contributions : dash} label="Contributions" />
        </Tile>

        <Tile
          icon="container"
          title="Docker"
          tone={dkTone}
          status={!dk ? 'Checking…' : dk.error ? 'Not running' : `Engine ${dk.version || ''}`.trim()}
          onClick={() => onTabChange('docker')}
        >
          <Metric value={dk && !dk.error ? dk.running : dash} label="Running" tone="text-success" />
          <Metric value={dk && !dk.error ? dk.stopped : dash} label="Stopped" tone="text-on-surface-variant" />
        </Tile>

        <Tile
          icon="dns"
          title="Primary server"
          tone={svTone}
          status={cfg.server_host || 'Not configured'}
          onClick={() => onTabChange(cfg.server_host ? 'servers' : 'settings')}
        >
          <Metric
            value={sv?.online ? <>{sv.latency.toFixed(0)}<span className="text-body-md text-on-surface-variant ml-0.5">ms</span></> : dash}
            label="Latency"
          />
          <Metric
            value={!cfg.server_host || !sv ? dash : sv.online ? 'Online' : 'Offline'}
            label="Status"
            tone={sv?.online ? 'text-success' : sv && cfg.server_host ? 'text-warning' : 'text-on-surface'}
          />
        </Tile>
      </div>

      {cfg.github_connected && !gh?.error && (
        <GithubActivityPanel todayCommits={gh?.commits} onOpen={() => onTabChange('github')} />
      )}

      <Group title="Needs attention">
        {!data ? (
          <div className="px-4 py-3 text-body-md text-on-surface-variant">Collecting the first snapshot{'…'}</div>
        ) : issues.length === 0 ? (
          <div className="px-4 py-3 flex items-center gap-2 text-body-md text-on-surface-variant">
            <Icon name="check_circle" size={15} className="text-success" />
            Everything looks good.
          </div>
        ) : (
          issues.map(issue => (
            <div key={issue.text} className="flex items-center gap-3 px-4 min-h-[44px] py-2">
              <Icon name={issue.icon} size={15} className="text-warning" />
              <span className="flex-1 min-w-0 text-body-md text-on-surface truncate">{issue.text}</span>
              <button onClick={() => onTabChange(issue.tab)} className="text-body-md text-primary hover:underline cursor-pointer shrink-0">
                {issue.action}
              </button>
            </div>
          ))
        )}
      </Group>
    </div>
  );
}
