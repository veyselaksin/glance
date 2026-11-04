import { useEffect } from 'react';
import { getConfig, saveConfig } from '../services/config.service';
import { useAppData } from '../hooks/useAppData';
import { useLogs } from '../hooks/useLogs';
import { useConfig } from '../hooks/useConfig';
import { useGithubAuth } from '../hooks/useGithubAuth';
import { useTheme } from '../hooks/useTheme';
import { ThemeContext } from '../hooks/ThemeContext';
import {
  onOauthSuccess,
  onOauthError,
  onDeviceCode,
  onAgentLog,
} from '../lib/events';
import { SignInPage } from '../modules/github/SignInPage';
import { DashboardLayout } from './DashboardLayout';
import type { ThemeMode } from '../types';

export default function App() {
  const { logs, pushLog, clearLogs } = useLogs();
  const { cfg, setCfg, saving, dirty, flash, update, save } = useConfig({
    github_username: '',
    github_connected: false,
    client_id: '',
    server_host: '',
    docker_socket: '/var/run/docker.sock',
    theme: 'system',
  });
  const data = useAppData();
  const theme = useTheme(cfg.theme);
  const {
    isSigningIn, deviceCode,
    setDeviceCode, resetAuth,
    handleSignIn, handleSignOut,
  } = useGithubAuth(setCfg, pushLog);

  useEffect(() => {
    getConfig().then((c) => {
      setCfg({
        ...c,
        theme: (c.theme === 'dark' || c.theme === 'light' || c.theme === 'system'
          ? c.theme
          : 'system') as ThemeMode,
      });
    });
  }, [setCfg]);

  useEffect(() => {
    const offSuccess = onOauthSuccess((username) => {
      resetAuth();
      getConfig().then(setCfg);
      pushLog('GIT', `Connected to GitHub as @${username}`);
    });

    const offError = onOauthError((msg) => {
      resetAuth();
      pushLog('ERR', `OAuth failed: ${msg}`);
      alert('OAuth connection failed: ' + msg);
    });

    const offDeviceCode = onDeviceCode((payload) => {
      setDeviceCode(payload);
    });

    const offLog = onAgentLog((payload) => {
      pushLog(payload.tag || 'SYS', payload.msg || '');
    });

    return () => {
      offSuccess();
      offError();
      offDeviceCode();
      offLog();
    };
  }, [pushLog, resetAuth, setCfg, setDeviceCode]);

  const themeValue = {
    mode: theme.mode,
    resolved: theme.resolved,
    setPreference: (next: ThemeMode) => {
      theme.setPreference(next);
      setCfg(prev => {
        const updated = { ...prev, theme: next };
        saveConfig(updated).catch(() => {});
        return updated;
      });
    },
  };

  if (!cfg.github_connected) {
    return (
      <ThemeContext.Provider value={themeValue}>
        <SignInPage
          onSignIn={handleSignIn}
          isSigningIn={isSigningIn}
          userCode={deviceCode?.user_code}
          verificationUri={deviceCode?.verification_uri}
        />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={themeValue}>
      <DashboardLayout
        cfg={cfg}
        data={data}
        onUpdate={update}
        onSave={save}
        saving={saving}
        dirty={dirty}
        flash={flash}
        onSignOut={handleSignOut}
        logs={logs}
        onClearLogs={clearLogs}
      />
    </ThemeContext.Provider>
  );
}
