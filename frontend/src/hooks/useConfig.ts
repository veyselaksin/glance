import { useState, useCallback } from 'react';
import type { Config } from '../types';
import { saveConfig as saveConfigSvc } from '../services/config.service';

export function useConfig(initial: Config) {
  const [cfg, setCfg] = useState<Config>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [flash, setFlash] = useState<'saved' | 'error' | null>(null);

  const update = useCallback((field: string, value: string) => {
    setCfg(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setFlash(null);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await saveConfigSvc(cfg);
      setDirty(false);
      setFlash('saved');
      setTimeout(() => setFlash(null), 2000);
    } catch {
      setFlash('error');
    } finally {
      setSaving(false);
    }
  }, [cfg]);

  return { cfg, setCfg, saving, dirty, flash, update, save };
}
