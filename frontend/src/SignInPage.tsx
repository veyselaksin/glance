import { BrowserOpenURL } from '../wailsjs/runtime/runtime';

interface Config {
  github_username: string;
  github_token: string;
  client_id: string;
  client_secret: string;
  server_host: string;
}

export function SignInPage({
  cfg,
  onUpdate,
  onSignIn,
  isSigningIn,
}: {
  cfg: Config;
  onUpdate: (field: string, val: string) => void;
  onSignIn: () => void;
  isSigningIn: boolean;
}) {
  const hasCredentials = cfg.client_id.trim() !== '' && cfg.client_secret.trim() !== '';

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-on-surface mac-drag relative overflow-hidden">
      {/* Atmospheric glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] login-glow-1 rounded-full blur-[128px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] login-glow-2 rounded-full blur-[128px]" />
      </div>

      <main className="mac-no-drag relative z-20 w-full max-w-[420px] px-md animate-page-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-xl">
          <div className="mb-md flex items-center justify-center p-sm glass-panel rounded-xl border border-outline">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>sensors</span>
          </div>
          <h1 className="text-headline-md font-headline-md font-bold text-on-surface tracking-tight">Glance</h1>
          <p className="text-body-md font-body-md text-on-surface-variant mt-xs">Performance tracking for developers</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl p-xl shadow-2xl border border-outline/60">

          {hasCredentials ? (
            /* ── STEP 2: Credentials entered → show Sign In ── */
            <>
              <div className="text-center mb-lg">
                <h2 className="text-headline-sm font-headline-sm text-on-surface font-semibold">Connect your workflow</h2>
                <p className="text-body-sm font-body-sm text-on-surface-variant mt-sm">
                  Authenticate to access your dashboard and server logs.
                </p>
              </div>

              <button
                onClick={onSignIn}
                disabled={isSigningIn}
                className="primary-gradient-btn w-full flex items-center justify-center gap-sm py-md px-lg rounded-xl text-on-primary font-body-md font-semibold disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSigningIn ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                    <span>Waiting for browser sign-in…</span>
                  </>
                ) : (
                  <>
                    <GithubIcon />
                    <span>Sign in with GitHub</span>
                  </>
                )}
              </button>

              <div className="mt-sm text-center">
                <button
                  onClick={() => { onUpdate('client_id', ''); onUpdate('client_secret', ''); }}
                  className="text-[11px] text-on-surface-variant/40 hover:text-on-surface-variant transition-colors cursor-pointer"
                >
                  ← Change OAuth App credentials
                </button>
              </div>
            </>
          ) : (
            /* ── STEP 1: Enter credentials ── */
            <>
              <div className="text-center mb-lg">
                <h2 className="text-headline-sm font-headline-sm text-on-surface font-semibold">OAuth App setup</h2>
                <p className="text-body-sm font-body-sm text-on-surface-variant mt-sm">
                  Register a GitHub OAuth App and paste the credentials to continue.
                </p>
              </div>

              {/* Callback URL info */}
              <div className="mb-md p-sm bg-primary/10 border border-primary/20 rounded-lg">
                <div className="text-[11px] text-on-surface-variant leading-relaxed">
                  <span className="text-primary font-semibold block mb-xs">Authorization callback URL:</span>
                  <code className="text-primary font-mono bg-black/30 px-1.5 py-0.5 rounded text-[10px] break-all select-text block mb-xs">
                    http://localhost:57321/oauth/callback
                  </code>
                  <button
                    className="text-primary hover:underline cursor-pointer text-[11px]"
                    onClick={() => BrowserOpenURL('https://github.com/settings/applications/new')}
                  >
                    Register new OAuth App on GitHub ↗
                  </button>
                </div>
              </div>

              <div className="space-y-sm mb-lg">
                <div>
                  <label className="block text-label-caps font-label-caps text-on-surface-variant mb-xs">
                    Client ID
                  </label>
                  <input
                    className="mac-input"
                    value={cfg.client_id}
                    onChange={e => onUpdate('client_id', e.target.value)}
                    placeholder="Ov23li..."
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-label-caps font-label-caps text-on-surface-variant mb-xs">
                    Client Secret
                  </label>
                  <input
                    className="mac-input"
                    type="password"
                    value={cfg.client_secret}
                    onChange={e => onUpdate('client_secret', e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••••••••••"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Disabled button with hint */}
              <button
                disabled
                className="w-full flex items-center justify-center gap-sm py-md px-lg rounded-xl font-body-md font-semibold cursor-not-allowed opacity-40"
                style={{ background: 'linear-gradient(180deg,#007AFF 0%,#0056B3 100%)', color: '#fff' }}
              >
                <GithubIcon />
                <span>Sign in with GitHub</span>
              </button>
              <p className="text-center text-[11px] text-on-surface-variant/40 mt-sm">
                Fill in credentials above to enable sign-in
              </p>
            </>
          )}

          {/* Footer */}
          <div className="mt-lg flex flex-col gap-sm">
            <div className="h-px w-full bg-white/10" />
            <div className="flex items-center justify-between mt-sm">
              <span className="text-code-sm font-code-sm text-on-surface-variant/70 flex items-center gap-xs">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                Secure Auth
              </span>
              <span className="text-body-sm font-body-sm text-primary/50">Terms of Service</span>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-xl text-center flex items-center justify-center gap-md text-code-sm font-code-sm text-on-surface-variant/50">
          <div className="flex items-center gap-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            v1.0.4 - Agent Running
          </div>
          <div className="w-px h-3 bg-white/10" />
          <span>Build 2409-F</span>
        </div>
      </main>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.34-3.369-1.34-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}
