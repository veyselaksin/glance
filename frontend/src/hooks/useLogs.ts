import { useState, useEffect, useRef, useCallback } from 'react';
import { now } from '../utils/format';
import type { LogLine } from '../types';

const TAG_COLORS: Record<string, string> = {
  GIT: 'text-primary/70',
  NET: 'text-primary/70',
  DOCK: 'text-warning/70',
  ERR: 'text-error/80',
};

export function useLogs() {
  const [logs, setLogs] = useState<LogLine[]>([
    { time: now(), tag: 'SYS', msg: 'System initialized', color: 'text-primary/70' },
    { time: now(), tag: 'SYS', msg: 'Glance Agent started', color: 'text-primary/70' },
  ]);

  const pushLog = useCallback((tag: string, msg: string) => {
    const color = TAG_COLORS[tag] ?? 'text-primary/70';
    setLogs(prev => [...prev, { time: now(), tag, msg, color }].slice(-100));
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, pushLog, clearLogs };
}
