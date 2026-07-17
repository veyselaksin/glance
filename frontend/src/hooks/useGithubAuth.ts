import { useState, useCallback } from 'react';
import type { Config } from '../types';
import { getConfig } from '../services/config.service';
import { startDeviceFlow, signOut } from '../services/github.service';

export function useGithubAuth(
  setCfg: (cfg: Config) => void,
  pushLog: (tag: string, msg: string) => void
) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [deviceCode, setDeviceCode] = useState<{ user_code: string; verification_uri: string } | null>(null);

  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    setDeviceCode(null);
    try {
      await startDeviceFlow();
    } catch (e) {
      setIsSigningIn(false);
      setDeviceCode(null);
      alert('OAuth error: ' + e);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    const updated = await getConfig();
    setCfg(updated);
    pushLog('SYS', 'Signed out of GitHub.');
  }, [setCfg, pushLog]);

  const resetAuth = useCallback(() => {
    setIsSigningIn(false);
    setDeviceCode(null);
  }, []);

  return {
    isSigningIn,
    deviceCode,
    setIsSigningIn,
    setDeviceCode,
    resetAuth,
    handleSignIn,
    handleSignOut,
  };
}
