import type { TabId } from '../types';
import { Icon } from './Icon';

interface NavItem { id: TabId; icon: string; label: string }

const SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: 'Dashboard', items: [{ id: 'overview', icon: 'dashboard', label: 'Overview' }] },
  {
    title: 'Sources',
    items: [
      { id: 'github', icon: 'github', label: 'GitHub' },
      { id: 'docker', icon: 'container', label: 'Docker' },
      { id: 'servers', icon: 'dns', label: 'Servers' },
    ],
  },
  {
    title: 'App',
    items: [
      { id: 'logs', icon: 'receipt_long', label: 'Activity Log' },
      { id: 'settings', icon: 'settings', label: 'Settings' },
      { id: 'docs', icon: 'description', label: 'Help' },
    ],
  },
];

interface SidebarProps {
  appVersion: string;
  appIcon: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  username: string;
  onSignOut: () => void;
}

/** Translucent macOS source list. The window's vibrancy shows through it. */
export function Sidebar({ appVersion, appIcon, activeTab, onTabChange, username, onSignOut }: SidebarProps) {
  return (
    <aside className="w-[256px] shrink-0 h-full apple-sidebar border-r border-outline flex flex-col mac-drag">
      {/* Clearance for the traffic lights */}
      <div className="h-[52px] shrink-0" />

      <div className="px-4 pb-4 flex items-center gap-3 mac-no-drag">
        <img src={appIcon} alt="" className="w-10 h-10 rounded-[10px] select-none" draggable={false} />
        <div className="min-w-0">
          <div className="text-[17px] font-semibold text-on-surface leading-tight">Glance</div>
          <div className="text-[12px] text-on-surface-variant leading-tight tabular-nums mt-0.5">
            v{appVersion || '—'}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-5 mac-no-drag" aria-label="Main">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <div className="px-2.5 pb-1.5 text-[12px] font-semibold text-on-surface-variant/80">{section.title}</div>
            <ul className="space-y-0.5">
              {section.items.map(item => {
                const active = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onTabChange(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full h-9 flex items-center gap-3 px-2.5 rounded-lg text-[14px] text-left cursor-pointer transition-colors ${
                        active ? 'bg-selected text-on-surface font-medium' : 'text-on-surface hover:bg-hover-overlay'
                      }`}
                    >
                      <Icon name={item.icon} size={18} className="text-primary" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-outline mac-no-drag">
        <div className="flex items-center gap-2.5 px-1.5 py-1">
          <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[13px] font-semibold uppercase">
            {username ? username[0] : <Icon name="person" size={16} />}
          </div>
          <div className="flex-1 min-w-0 text-[13px] text-on-surface truncate">
            {username ? `@${username}` : <span className="text-on-surface-variant">Not signed in</span>}
          </div>
          {username && (
            <button
              onClick={onSignOut}
              title="Sign out of GitHub"
              aria-label="Sign out of GitHub"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-hover-overlay cursor-pointer"
            >
              <Icon name="logout" size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
