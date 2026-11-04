import { useState, useEffect } from 'react';
import type { Config, AppData, TabId, LogLine } from '../types';
import { getAppVersion } from '../services/app.service';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { OverviewView } from './views/OverviewView';
import { SettingsView } from './views/SettingsView';
import { GithubView } from '../modules/github/GithubView';
import { DockerView } from '../modules/docker/DockerView';
import { ServersView } from '../modules/ssh/ServersView';
import { LogsView } from './views/LogsView';
import { DocsView } from './views/DocsView';
import appIcon from '../assets/images/glance-app-icon.png';

const PAGES: Record<TabId, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Today across GitHub, Docker and your servers' },
  github: { title: 'GitHub', subtitle: 'Account, activity and connection' },
  docker: { title: 'Docker', subtitle: 'Local daemon and containers' },
  servers: { title: 'Servers', subtitle: 'SSH terminal and live metrics' },
  logs: { title: 'Activity Log', subtitle: 'Agent events from this session' },
  settings: { title: 'Settings', subtitle: 'Appearance and data sources' },
  docs: { title: 'Help', subtitle: 'How Glance works' },
};

interface DashboardLayoutProps {
  cfg: Config;
  data: AppData | null;
  onUpdate: (field: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  flash: 'saved' | 'error' | null;
  onSignOut: () => void;
  logs: LogLine[];
  onClearLogs: () => void;
}

export function DashboardLayout({
  cfg, data, onUpdate, onSave, saving, dirty, flash,
  onSignOut, logs, onClearLogs,
}: DashboardLayoutProps) {
  const [tab, setTab] = useState<TabId>('overview');
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => { getAppVersion().then(setAppVersion); }, []);

  // ⌘, opens Settings (standard macOS shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        setTab('settings');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const page = PAGES[tab];
  const configProps = { cfg, onUpdate, onSave, saving, dirty, flash };

  return (
    <div className="flex h-screen overflow-hidden text-on-surface">
      <Sidebar
        appVersion={appVersion}
        appIcon={appIcon}
        activeTab={tab}
        onTabChange={setTab}
        username={cfg.github_username}
        onSignOut={onSignOut}
      />

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-background">
        <Header title={page.title} subtitle={page.subtitle} lastSync={data?.updated_at} />

        <section key={tab} className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
          {tab === 'overview' && <OverviewView cfg={cfg} data={data} onTabChange={setTab} />}
          {tab === 'github' && <GithubView {...configProps} data={data} onSignOut={onSignOut} />}
          {tab === 'docker' && <DockerView data={data} socket={cfg.docker_socket} onOpenSettings={() => setTab('settings')} />}
          {tab === 'servers' && <ServersView />}
          {tab === 'logs' && <LogsView logs={logs} onClearLogs={onClearLogs} />}
          {tab === 'settings' && <SettingsView {...configProps} appVersion={appVersion} />}
          {tab === 'docs' && <DocsView />}
        </section>
      </main>
    </div>
  );
}
