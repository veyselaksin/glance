import { useCallback, useEffect, useState } from 'react';
import type { ThemeMode } from '../types';
import { setAppTheme } from '../services/app.service';

export type ResolvedTheme = 'dark' | 'light';

function normalizeTheme(raw: string | undefined | null): ThemeMode {
  if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  return 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

function applyDomTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function useTheme(themePreference: string | undefined) {
  const mode = normalizeTheme(themePreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode));

  useEffect(() => {
    const next = resolveTheme(mode);
    setResolved(next);
    applyDomTheme(next);
    setAppTheme(next).catch(() => {});

    if (mode !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const sys = resolveTheme('system');
      setResolved(sys);
      applyDomTheme(sys);
      setAppTheme(sys).catch(() => {});
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const setPreference = useCallback((next: ThemeMode) => {
    const r = resolveTheme(next);
    setResolved(r);
    applyDomTheme(r);
    setAppTheme(r).catch(() => {});
  }, []);

  return { mode, resolved, setPreference };
}
