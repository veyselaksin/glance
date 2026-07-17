import { fmtTime } from '../utils/format';

interface HeaderProps {
  lastSync: string | undefined;
}

export function Header({ lastSync }: HeaderProps) {
  return (
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
          Last Sync: {lastSync ? fmtTime(lastSync) : '—'}
        </div>
      </div>
    </header>
  );
}
