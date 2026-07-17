import type { TabId } from '../types';
import { Navigation } from './Navigation';

const NAV_ITEMS: { id: TabId; icon: string; label: string }[] = [
  { id: 'overview', icon: 'dashboard', label: 'Overview' },
  { id: 'github', icon: 'settings_ethernet', label: 'GitHub Settings' },
  { id: 'docker', icon: 'terminal', label: 'Docker Daemon' },
  { id: 'servers', icon: 'dns', label: 'Servers/VPS' },
  { id: 'logs', icon: 'receipt_long', label: 'Logs' },
];

interface SidebarProps {
  appVersion: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onSignOut: () => void;
  brandingImg: string;
}

export function Sidebar({ appVersion, activeTab, onTabChange, onSignOut, brandingImg }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] apple-sidebar border-r border-outline flex flex-col pt-12 pb-md px-sm z-50">
      <div className="mb-xl px-sm mac-no-drag">
        <img src={brandingImg} alt="Glance" className="h-8 w-auto mb-xs select-none" draggable={false} />
        <p className="text-body-sm font-body-sm text-on-surface-variant">v{appVersion || '1.0.0'} - Agent Running</p>
      </div>

      <nav className="flex-1 space-y-xs overflow-y-auto custom-scrollbar mac-no-drag">
        <Navigation items={NAV_ITEMS} active={activeTab} onSelect={onTabChange} />
      </nav>

      <div className="mt-auto pt-md border-t border-outline space-y-xs mac-no-drag">
        <button
          onClick={() => onTabChange('docs')}
          className={`w-full flex items-center gap-sm px-sm py-sm rounded-lg transition-all duration-150 text-body-sm font-body-sm cursor-pointer text-left ${
            activeTab === 'docs'
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>
          <span>Docs</span>
        </button>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-sm px-sm py-sm rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all duration-150 text-body-sm font-body-sm cursor-pointer text-left"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
