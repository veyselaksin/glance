import { useState, useRef, useEffect } from 'react';
import { now } from '../utils/format';
import type { LogLine } from '../types';

interface LogConsoleProps {
  logs: LogLine[];
}

export function LogConsole({ logs }: LogConsoleProps) {
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && !collapsed) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs, collapsed]);

  const recent = logs.slice(-20);

  return (
    <div className="absolute bottom-md right-md w-80 z-50 mac-no-drag">
      <div className="glass-panel border border-outline rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-surface-container-high px-md py-sm flex items-center justify-between border-b border-outline">
          <div className="flex items-center gap-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-status-pulse" />
            <span className="text-label-caps font-label-caps text-primary uppercase">Status: Agent Running</span>
          </div>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{collapsed ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>
        {!collapsed && (
          <div ref={ref} className="p-md text-code-sm font-code-sm text-on-surface-variant custom-scrollbar overflow-y-auto space-y-1 bg-black/40 max-h-48">
            {recent.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-white/20 select-none shrink-0">{log.time}</span>
                <span className={log.color}>[{log.tag}]</span>
                <span className="text-on-surface">{log.msg}</span>
              </div>
            ))}
            <div className="flex gap-2 items-center">
              <span className="text-white/20 select-none">{now()}</span>
              <span className="text-primary/70">[LOG]</span>
              <span className="w-2 h-4 bg-primary/40 cursor-blink ml-1 inline-block" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
