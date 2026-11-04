import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group } from '../../components/Group';
import { Icon } from '../../components/Icon';
import { BrowserOpenURL } from '../../lib/events';
import { getActivity } from '../../services/github.service';
import type { github } from '../../../wailsjs/go/models';

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

const PAGE = 20;

/** "2h ago", "3d ago", or a date for anything older than a week. */
export function ago(iso: string, now: number): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Local YYYY-MM-DD, matching how days are bucketed in the chart. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RangePicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Range" className="inline-flex items-center p-[2px] rounded-md bg-surface-container-high/80 border border-outline">
      {RANGES.map(r => {
        const active = r.days === value;
        return (
          <button
            key={r.days}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r.days)}
            className={`px-3 h-6 rounded-[5px] text-body-sm transition-colors cursor-pointer ${
              active
                ? 'bg-surface-container-lowest text-on-surface shadow-sm dark:bg-surface-container-highest'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/** One bar per day; hover shows the date and count. */
export function DailyChart({ commits, since, days }: { commits: github.Commit[]; since: string; days: number }) {
  const bars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of commits) {
      const k = dayKey(new Date(c.date));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const start = new Date(since);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, count: counts.get(dayKey(d)) ?? 0 };
    });
  }, [commits, since, days]);
  const max = Math.max(1, ...bars.map(b => b.count));
  const fmt = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-end gap-[2px] h-16">
        {bars.map(b => (
          <div
            key={b.date.toISOString()}
            title={`${fmt(b.date)}: ${b.count} commit${b.count === 1 ? '' : 's'}`}
            className="flex-1 h-full flex items-end"
          >
            <div
              className={`w-full rounded-[2px] ${b.count ? 'bg-primary' : 'bg-outline'}`}
              style={{ height: b.count ? `${Math.max(8, (b.count / max) * 100)}%` : '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-on-surface-variant tabular-nums">
        <span>{fmt(bars[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Summary({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex-1 px-4 py-3">
      <div className="text-body-sm text-on-surface-variant">{label}</div>
      <div className="mt-1 text-[22px] leading-7 font-semibold tabular-nums text-on-surface">{value}</div>
    </div>
  );
}

/**
 * Loads activity for `days`, refetching when the poller's `todayCommits`
 * changes (new pushes). Results are kept per range so switching back is instant.
 */
export function useGithubActivity(days: number, todayCommits?: number) {
  const [cache, setCache] = useState<Record<number, github.Activity>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback((d: number) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    getActivity(d)
      .then(a => { if (id === reqId.current) setCache(c => ({ ...c, [d]: a })); })
      .catch(e => { if (id === reqId.current) setError(String(e?.message ?? e)); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, []);

  useEffect(() => { load(days); }, [days, todayCommits, load]);

  return { act: cache[days] as github.Activity | undefined, loading, error };
}

/** One clickable commit: message, repo · branch · sha, and age. */
export function CommitRow({ c, now }: { c: github.Commit; now: number }) {
  return (
    <button
      type="button"
      onClick={() => BrowserOpenURL(c.url)}
      title="Open commit on GitHub"
      className="w-full text-left flex items-start gap-3 px-4 py-2.5 hover:bg-surface-container-high transition-colors cursor-pointer"
    >
      <Icon name="commit" size={14} className="mt-1 text-on-surface-variant shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-body-md text-on-surface truncate">{c.message || '(no message)'}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-body-sm text-on-surface-variant min-w-0">
          <span className="truncate">{c.repo}</span>
          <span>·</span>
          <Icon name="branch" size={11} className="shrink-0" />
          <span className="truncate max-w-[180px]">{c.branch}</span>
          <span>·</span>
          <span className="font-code-sm shrink-0">{c.sha.slice(0, 7)}</span>
        </div>
      </div>
      <span className="shrink-0 text-body-sm text-on-surface-variant tabular-nums" title={new Date(c.date).toLocaleString()}>
        {ago(c.date, now)}
      </span>
    </button>
  );
}

interface Props {
  /** Today's commit count from the poller; a change means new pushes, so refetch. */
  todayCommits?: number;
}

/** Commit history across every branch: range filter, per-repo breakdown and a linked commit list. */
export function GithubActivity({ todayCommits }: Props) {
  const [days, setDays] = useState(7);
  const [repo, setRepo] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const { act, loading, error } = useGithubActivity(days, todayCommits);
  const now = Date.now();
  const filtered = useMemo(
    () => (act?.commits ?? []).filter(c => !repo || c.repo === repo),
    [act, repo],
  );
  const activeDays = useMemo(
    () => new Set((act?.commits ?? []).map(c => dayKey(new Date(c.date)))).size,
    [act],
  );
  const maxRepo = Math.max(1, ...(act?.repos ?? []).map(r => r.commits));

  const changeRange = (d: number) => { setDays(d); setRepo(null); setShown(PAGE); };
  const toggleRepo = (r: string) => { setRepo(cur => (cur === r ? null : r)); setShown(PAGE); };

  return (
    <>
      <section className="space-y-1.5">
        <div className="px-1 flex items-center justify-between gap-3">
          <h2 className="text-body-sm font-semibold text-on-surface-variant flex items-center gap-2">
            Activity
            {loading && <Icon name="progress_activity" size={12} className="animate-spin" />}
          </h2>
          <RangePicker value={days} onChange={changeRange} />
        </div>
        <div className="bg-surface-container border border-outline rounded-xl card-shadow divide-y divide-outline overflow-hidden">
          {error && !act ? (
            <div className="px-4 py-3 flex items-start gap-2 text-body-md text-error">
              <Icon name="error" size={15} className="mt-0.5" />
              <span>{error}</span>
            </div>
          ) : !act ? (
            <div className="px-4 py-6 text-center text-body-md text-on-surface-variant">Loading commits from every branch…</div>
          ) : (
            <>
              <div className="flex divide-x divide-outline">
                <Summary value={act.total} label="Commits" />
                <Summary value={act.repos.length} label="Repositories" />
                <Summary value={days === 1 ? (act.total ? 1 : 0) : `${activeDays}/${days}`} label="Active days" />
              </div>
              {days > 1 && <DailyChart commits={act.commits} since={act.since} days={days} />}
            </>
          )}
        </div>
        {act?.partial && (
          <div className="px-1 text-body-sm text-on-surface-variant">
            Some branches couldn't be fully read, so counts may be a little low.
          </div>
        )}
      </section>

      {act && act.repos.length > 0 && (
        <Group title="By repository">
          {act.repos.map(r => {
            const active = repo === r.repo;
            return (
              <div
                key={r.repo}
                className={`group flex items-center gap-3 px-4 min-h-[40px] py-2 cursor-pointer transition-colors ${
                  active ? 'bg-primary/10' : 'hover:bg-surface-container-high'
                }`}
                onClick={() => toggleRepo(r.repo)}
                title={active ? 'Show all repositories' : `Show only ${r.repo}`}
              >
                <Icon name="repo" size={14} className={active ? 'text-primary' : 'text-on-surface-variant'} />
                <span className="w-[220px] shrink-0 truncate text-body-md text-on-surface">{r.repo}</span>
                <div className="flex-1 h-1.5 rounded-full bg-outline/60 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(r.commits / maxRepo) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-body-md tabular-nums text-on-surface">{r.commits}</span>
                <button
                  type="button"
                  title="Open on GitHub"
                  onClick={e => { e.stopPropagation(); BrowserOpenURL(r.url); }}
                  className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  <Icon name="open_in_new" size={13} />
                </button>
              </div>
            );
          })}
        </Group>
      )}

      {act && (
        <section className="space-y-1.5">
          <div className="px-1 flex items-center justify-between gap-3 min-h-6">
            <h2 className="text-body-sm font-semibold text-on-surface-variant">Recent commits</h2>
            {repo && (
              <button
                type="button"
                onClick={() => toggleRepo(repo)}
                className="inline-flex items-center gap-1 h-6 pl-2 pr-1.5 rounded-full bg-primary/15 text-primary text-body-sm cursor-pointer hover:bg-primary/25"
              >
                {repo} <Icon name="close" size={12} />
              </button>
            )}
          </div>
          <div className="bg-surface-container border border-outline rounded-xl card-shadow divide-y divide-outline overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-body-md text-on-surface-variant">
                No commits {days === 1 ? 'today' : `in the last ${days} days`}.
              </div>
            ) : (
              filtered.slice(0, shown).map(c => <CommitRow key={c.sha} c={c} now={now} />)
            )}
          </div>
          {filtered.length > shown && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setShown(s => s + PAGE)}
                className="text-body-sm text-primary hover:underline cursor-pointer"
              >
                Show {Math.min(PAGE, filtered.length - shown)} more of {filtered.length - shown}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
