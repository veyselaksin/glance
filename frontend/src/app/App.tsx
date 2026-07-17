import { useEffect } from 'react';
import { getConfig } from '../services/config.service';
import { useAppData } from '../hooks/useAppData';
import { useLogs } from '../hooks/useLogs';
import { useConfig } from '../hooks/useConfig';
import { useGithubAuth } from '../hooks/useGithubAuth';
import {
  onOauthSuccess,
  onOauthError,
  onDeviceCode,
  onAgentLog,
} from '../lib/events';
import { SignInPage } from '../modules/github/SignInPage';
import { DashboardLayout } from './DashboardLayout';
import '../App.css';

export default function App() {
  const { logs, pushLog, clearLogs } = useLogs();
  const { cfg, setCfg, saving, dirty, flash, update, save } = useConfig({
    github_username: '',
    github_token: '',
    client_id: '',
    server_host: '',
    servers: [],
    docker_socket: '/var/run/docker.sock',
  });
  const data = useAppData();
  const {
    isSigningIn, deviceCode,
    setDeviceCode, resetAuth,
    handleSignIn, handleSignOut,
  } = useGithubAuth(setCfg, pushLog);

  useEffect(() => {
    getConfig().then(setCfg);
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

  if (!cfg.github_token) {
    return (
      <SignInPage
        onSignIn={handleSignIn}
        isSigningIn={isSigningIn}
        userCode={deviceCode?.user_code}
        verificationUri={deviceCode?.verification_uri}
      />
    );
  }

  return (
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
  );
}
