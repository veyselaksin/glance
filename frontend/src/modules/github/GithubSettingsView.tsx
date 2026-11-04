import type { Config, ThemeMode } from '../../types';
import { useThemeContext } from '../../hooks/ThemeContext';

interface GithubSettingsViewProps {
  cfg: Config;
  onUpdate: (field: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  flash: 'saved' | 'error' | null;
  onSignOut: () => void;
}

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: string }[] = [
  { id: 'dark', label: 'Dark', icon: 'dark_mode' },
  { id: 'light', label: 'Light', icon: 'light_mode' },
  { id: 'system', label: 'System', icon: 'contrast' },
];

export function GithubSettingsView({ cfg, onUpdate, onSave, saving, dirty, flash, onSignOut }: GithubSettingsViewProps) {
  const { mode, setPreference } = useThemeContext();

  const handleTheme = (next: ThemeMode) => {
    setPreference(next);
  };

  return (
    <div className="max-w-2xl mx-auto animate-page-in space-y-xl">
      <div className="mb-md">
        <h3 className="text-headline-lg font-headline-lg text-on-surface mb-xs">GitHub Settings</h3>
        <p className="text-on-surface-variant font-body-md">Manage your GitHub connection.</p>
      </div>

      <div className="bg-surface-container border border-outline rounded-xl p-md">
        <div className="flex items-center gap-xs text-primary mb-1">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>palette</span>
          <span className="text-label-caps font-label-caps uppercase">Appearance</span>
        </div>
        <h4 className="text-headline-sm font-headline-sm text-on-surface mb-md">Theme</h4>
        <div className="flex flex-wrap gap-sm">
          {THEME_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleTheme(opt.id)}
              className={`flex items-center gap-xs px-md py-xs rounded text-body-sm font-body-sm transition-colors cursor-pointer ${
                mode === opt.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-background border border-outline text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-container border border-outline rounded-xl p-md">
        <div className="flex items-center gap-xs text-primary mb-1">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings_ethernet</span>
          <span className="text-label-caps font-label-caps uppercase">Integrations</span>
        </div>
        <h4 className="text-headline-sm font-headline-sm text-on-surface mb-md">GitHub Settings</h4>

        <div className="space-y-md">
          <div className="flex items-center justify-between p-md bg-background border border-outline rounded-lg">
            <div className="flex items-center gap-sm">
              <div className="w-2 h-2 rounded-full bg-primary animate-status-pulse" />
              <div>
                <div className="text-body-sm font-body-sm text-on-surface">
                  {cfg.github_connected
                    ? <>Connected as <strong className="text-primary">@{cfg.github_username}</strong></>
                    : <span className="text-on-surface-variant">Not signed in</span>}
                </div>
                <div className="text-[11px] text-on-surface-variant/60 font-body-sm mt-xs">
                  Device Flow — no Client Secret stored on this machine.
                </div>
              </div>
            </div>
            {cfg.github_connected && (
              <button
                onClick={onSignOut}
                className="text-body-sm font-body-sm text-warning hover:text-warning/80 transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            )}
          </div>

          <details className="group border border-outline rounded-lg">
            <summary className="px-md py-sm cursor-pointer text-on-surface-variant hover:text-on-surface transition-colors text-body-sm font-body-sm select-none flex items-center gap-xs">
              <span className="material-symbols-outlined group-open:rotate-90 transition-transform" style={{ fontSize: 16 }}>chevron_right</span>
              Advanced: override OAuth Client ID
            </summary>
            <div className="px-md pb-md pt-xs space-y-sm">
              <p className="text-[11px] text-on-surface-variant/60 font-body-sm">
                Glance ships with a built-in Client ID. Override it only if you want to use your own GitHub OAuth App.
              </p>
              <label className="block text-label-caps font-label-caps text-on-surface-variant">OAuth Client ID (optional)</label>
              <input
                className="mac-input"
                value={cfg.client_id}
                onChange={e => onUpdate('client_id', e.target.value)}
                placeholder="Ov23li… (leave empty to use built-in)"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </details>
        </div>

        <div className="mt-md flex justify-end gap-sm">
          <button
            onClick={onSave}
            disabled={saving || !dirty}
            className="bg-primary text-on-primary px-md py-1.5 rounded font-body-sm text-body-sm font-semibold hover:brightness-110 active:scale-95 duration-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? 'Saving…' : flash === 'saved' ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
