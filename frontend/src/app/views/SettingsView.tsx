import type { Config } from '../../types';
import { Group, Row, Button } from '../../components/Group';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';

interface SettingsViewProps {
  cfg: Config;
  appVersion: string;
  onUpdate: (field: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  flash: 'saved' | 'error' | null;
}

/** App-wide preferences: appearance, data sources, about. */
export function SettingsView({ cfg, appVersion, onUpdate, onSave, saving, dirty, flash }: SettingsViewProps) {
  return (
    <div className="max-w-[640px] mx-auto animate-page-in space-y-6">
      <Group title="Appearance">
        <Row label="Theme" description="Auto follows your macOS appearance.">
          <ThemeSwitcher labeled />
        </Row>
      </Group>

      <Group
        title="Data sources"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span>{flash === 'error' ? <span className="text-error">Couldn’t save settings.</span> : 'Changes apply on the next refresh.'}</span>
            <Button variant="primary" onClick={onSave} disabled={saving || !dirty}>
              {saving ? 'Saving…' : flash === 'saved' ? 'Saved' : 'Save'}
            </Button>
          </div>
        }
      >
        <Row label="Docker socket" description="Unix socket of your Docker daemon.">
          <input
            className="mac-input w-[260px]"
            value={cfg.docker_socket}
            onChange={e => onUpdate('docker_socket', e.target.value)}
            placeholder="/var/run/docker.sock"
            spellCheck={false}
            autoComplete="off"
          />
        </Row>
        <Row label="Primary server" description="Host or URL pinged on the Overview.">
          <input
            className="mac-input w-[260px]"
            value={cfg.server_host}
            onChange={e => onUpdate('server_host', e.target.value)}
            placeholder="example.com or 10.0.0.5"
            spellCheck={false}
            autoComplete="off"
          />
        </Row>
      </Group>

      <Group title="About">
        <Row label="Version"><span className="text-body-md text-on-surface-variant tabular-nums">{appVersion || '—'}</span></Row>
        <Row label="Data folder"><span className="font-mono text-code-sm text-on-surface-variant">~/.glance</span></Row>
        <Row label="Credentials" description="GitHub token and SSH passwords are stored in the macOS Keychain.">
          <span className="font-mono text-code-sm text-on-surface-variant">dev.glance</span>
        </Row>
      </Group>
    </div>
  );
}
