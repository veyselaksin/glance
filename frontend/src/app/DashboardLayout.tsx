import { useState, useEffect } from 'react';
import type { Config, AppData, TabId, LogLine } from '../types';
import { getAppVersion } from '../services/app.service';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { OverviewView } from './views/OverviewView';
import { GithubSettingsView } from '../modules/github/GithubSettingsView';
import { DockerView } from '../modules/docker/DockerView';
import { ServersView } from '../modules/ssh/ServersView';
import { LogsView } from './views/LogsView';
import { DocsView } from './views/DocsView';
import glanceBranding from '../assets/images/glance-branding.png';

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

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface mac-drag">
      <Sidebar
        appVersion={appVersion}
        activeTab={tab}
        onTabChange={setTab}
        onSignOut={onSignOut}
        brandingImg={glanceBranding}
      />

      <main className="ml-[240px] flex-1 flex flex-col h-screen overflow-hidden relative bg-background">
        <Header lastSync={data?.updated_at} />

        <section className="flex-1 overflow-y-auto p-xl custom-scrollbar relative">
          {tab === 'overview' && (
            <OverviewView cfg={cfg} data={data} onTabChange={setTab} />
          )}

          {tab === 'github' && (
            <GithubSettingsView
              cfg={cfg}
              onUpdate={onUpdate}
              onSave={onSave}
              saving={saving}
              dirty={dirty}
              flash={flash}
              onSignOut={onSignOut}
            />
          )}

          {tab === 'docker' && (
            <DockerView cfg={cfg} data={data} onUpdate={onUpdate} />
          )}

          {tab === 'servers' && (
            <ServersView />
          )}

          {tab === 'logs' && (
            <LogsView logs={logs} onClearLogs={onClearLogs} />
          )}

          {tab === 'docs' && (
            <DocsView />
          )}
        </section>
      </main>
    </div>
  );
}
