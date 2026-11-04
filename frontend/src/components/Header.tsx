import { useState } from 'react';
import { fmtTime } from '../utils/format';
import { refreshNow } from '../services/app.service';
import { Icon } from './Icon';

interface HeaderProps {
  title: string;
  subtitle?: string;
  lastSync: string | undefined;
}

/** Unified window toolbar: page title, sync status, refresh, appearance. Draggable. */
export function Header({ title, subtitle, lastSync }: HeaderProps) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    refreshNow().catch(() => {});
    // The snapshot arrives via the data_updated event; spin briefly for feedback.
    window.setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <header className="toolbar h-[52px] shrink-0 flex items-center justify-between gap-4 px-5 border-b border-outline mac-drag z-30">
      <div className="min-w-0 flex items-baseline gap-2.5">
        <h1 className="text-headline-sm text-on-surface truncate">{title}</h1>
        {subtitle && <span className="hidden lg:inline text-body-sm text-on-surface-variant truncate">{subtitle}</span>}
      </div>

      <div className="flex items-center gap-2 shrink-0 mac-no-drag">
        <span className="hidden md:flex items-center gap-1.5 text-body-sm text-on-surface-variant tabular-nums">
          <span className={`w-1.5 h-1.5 rounded-full ${lastSync ? 'bg-success' : 'bg-on-surface-variant/40'}`} />
          {lastSync ? `Updated ${fmtTime(lastSync)}` : 'Waiting for data…'}
        </span>
        <button
          onClick={refresh}
          disabled={refreshing}
          title="Refresh now"
          aria-label="Refresh now"
          className="w-7 h-7 flex items-center justify-center rounded-md text-on-surface-variant hover:text-on-surface hover:bg-hover-overlay cursor-pointer disabled:cursor-default"
        >
          <Icon name="refresh" size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    </header>
  );
}
