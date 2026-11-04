import type { AppData, Config } from '../../types';
import { Group, Row, Button } from '../../components/Group';
import { Icon } from '../../components/Icon';
import { GithubActivity } from './GithubActivity';
import { BrowserOpenURL } from '../../lib/events';
import { fmtTime } from '../../utils/format';

interface GithubViewProps {
  cfg: Config;
  data: AppData | null;
  onUpdate: (field: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  flash: 'saved' | 'error' | null;
  onSignOut: () => void;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="flex-1 px-4 py-3">
      <div className="text-body-sm text-on-surface-variant">{label}</div>
      <div className={`mt-1 text-[28px] leading-8 font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

/** GitHub connection details: account, today's activity, OAuth settings. */
export function GithubView({ cfg, data, onUpdate, onSave, saving, dirty, flash, onSignOut }: GithubViewProps) {
  const gh = data?.github;
  const user = cfg.github_username;

  return (
    <div className="max-w-[640px] mx-auto animate-page-in space-y-6">
      {/* Account header */}
      <div className="bg-surface-container border border-outline rounded-xl card-shadow p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[20px] font-semibold uppercase">
          {user ? user[0] : <Icon name="github" size={22} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-headline-sm text-on-surface truncate">{user ? `@${user}` : 'Not connected'}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.github_connected ? 'bg-success' : 'bg-on-surface-variant/40'}`} />
            {cfg.github_connected ? 'Connected via GitHub Device Flow' : 'Sign in to sync your activity'}
          </div>
        </div>
        {user && (
          <Button onClick={() => BrowserOpenURL(`https://github.com/${user}`)} title="Open profile on github.com">
            <Icon name="open_in_new" size={13} /> Profile
          </Button>
        )}
      </div>

      <Group
        title="Today"
        footer={data?.updated_at ? `Last synced ${fmtTime(data.updated_at)} · refreshes every 30 seconds` : undefined}
      >
        {gh?.error ? (
          <div className="px-4 py-3 flex items-start gap-2 text-body-md text-error">
            <Icon name="error" size={15} className="mt-0.5" />
            <span>{gh.error}</span>
          </div>
        ) : (
          <>
            <div className="flex divide-x divide-outline">
              <Stat label="Commits pushed" value={gh ? gh.commits : '—'} tone="text-primary" />
              <Stat label="Contributions" value={gh ? gh.contributions : '—'} tone="text-success" />
            </div>
            {gh?.warning && (
              <div className="px-4 py-3 border-t border-outline flex items-start gap-2 text-body-md text-warning">
                <Icon name="warning" size={15} className="mt-0.5" />
                <span>{gh.warning}</span>
              </div>
            )}
          </>
        )}
      </Group>

      {cfg.github_connected && !gh?.error && <GithubActivity todayCommits={gh?.commits} />}

      <Group title="Connection">
        <Row label="Authentication" description="OAuth Device Flow. No client secret or password is stored.">
          <span className="text-body-md text-on-surface-variant">Device Flow</span>
        </Row>
        <Row label="Access token" description="Scopes: read:user, repo">
          <span className="flex items-center gap-1.5 text-body-md text-on-surface-variant">
            <Icon name={cfg.github_connected ? 'lock' : 'lock_open'} size={13} />
            {cfg.github_connected ? 'In macOS Keychain' : 'None'}
          </span>
        </Row>
        {cfg.github_connected && (
          <Row label="Disconnect" description="Removes the token from this Mac. You can sign in again anytime.">
            <Button variant="destructive" onClick={onSignOut}>Disconnect</Button>
          </Row>
        )}
      </Group>

      <Group
        title="Advanced"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span>Only change this to use your own GitHub OAuth App. Takes effect at next sign-in.</span>
            <Button variant="primary" onClick={onSave} disabled={saving || !dirty}>
              {saving ? 'Saving…' : flash === 'saved' ? 'Saved' : 'Save'}
            </Button>
          </div>
        }
      >
        <Row label="OAuth Client ID" description="Leave empty to use the built-in app.">
          <input
            className="mac-input w-[240px]"
            value={cfg.client_id}
            onChange={e => onUpdate('client_id', e.target.value)}
            placeholder="Built-in"
            spellCheck={false}
            autoComplete="off"
          />
        </Row>
      </Group>
    </div>
  );
}
