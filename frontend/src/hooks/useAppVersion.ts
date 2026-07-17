import { useState, useEffect } from 'react';
import { getAppVersion } from '../services/app.service';

export function useAppVersion() {
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => { getAppVersion().then(setAppVersion); }, []);
  return appVersion;
}
