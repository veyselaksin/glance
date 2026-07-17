import { useState, useEffect } from 'react';
import { BrowserOpenURL } from '../../lib/events';
import { getAppVersion } from '../../services/app.service';
import { GithubIcon } from '../../components/GithubIcon';
import glanceBranding from '../../assets/images/glance-branding.png';

interface SignInPageProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  userCode?: string;
  verificationUri?: string;
}

export function SignInPage({ onSignIn, isSigningIn, userCode, verificationUri }: SignInPageProps) {
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => { getAppVersion().then(setAppVersion); }, []);

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
          <img src={glanceBranding} alt="Glance" className="h-12 w-auto mb-md select-none" draggable={false} />
          <p className="text-body-md font-body-md text-on-surface-variant mt-xs">Performance tracking for developers</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl p-xl shadow-2xl border border-outline/60">
          {!isSigningIn ? (
            <>
              <div className="text-center mb-lg">
                <h2 className="text-headline-sm font-headline-sm text-on-surface font-semibold">Connect your workflow</h2>
                <p className="text-body-sm font-body-sm text-on-surface-variant mt-sm">
                  Authenticate with GitHub to access your dashboard.
                </p>
              </div>

              <button
                onClick={onSignIn}
                className="primary-gradient-btn w-full flex items-center justify-center gap-sm py-md px-lg rounded-xl text-on-primary font-body-md font-semibold cursor-pointer"
              >
                <GithubIcon size={18} />
                <span>Sign in with GitHub</span>
              </button>
            </>
          ) : (
            <div className="space-y-md">
              <div className="text-center mb-lg">
                <h2 className="text-headline-sm font-headline-sm text-on-surface font-semibold">Authorize Glance</h2>
                <p className="text-body-sm font-body-sm text-on-surface-variant mt-sm">
                  Complete the authorization in your browser.
                </p>
              </div>

              <div className="flex items-center justify-center gap-sm py-md">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span className="text-on-surface">Waiting for authorization…</span>
              </div>

              {userCode && (
                <div className="p-md bg-primary/10 border border-primary/20 rounded-lg text-center">
                  <div className="text-[11px] text-on-surface-variant mb-xs uppercase tracking-wider">
                    If prompted, enter this code
                  </div>
                  <div className="text-headline-lg font-mono font-bold text-primary tracking-[0.2em] select-text">
                    {userCode}
                  </div>
                  {verificationUri && (
                    <button
                      onClick={() => BrowserOpenURL(verificationUri)}
                      className="mt-sm text-[11px] text-primary hover:underline cursor-pointer"
                    >
                      Open {verificationUri} ↗
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-lg flex flex-col gap-sm">
            <div className="h-px w-full bg-white/10" />
            <div className="flex items-center justify-between mt-sm">
              <span className="text-code-sm font-code-sm text-on-surface-variant/70 flex items-center gap-xs">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                Device Flow · No secret stored
              </span>
              <span className="text-body-sm font-body-sm text-primary/50">Open Source</span>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-xl text-center flex items-center justify-center gap-md text-code-sm font-code-sm text-on-surface-variant/50">
          <div className="flex items-center gap-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            v{appVersion || '1.0.0'} - Agent Running
          </div>
          <div className="w-px h-3 bg-white/10" />
          <span>Build 2409-F</span>
        </div>
      </main>
    </div>
  );
}
