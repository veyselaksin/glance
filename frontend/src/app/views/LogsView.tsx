import { now } from '../../utils/format';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import type { LogLine } from '../../types';

interface LogsViewProps {
  logs: LogLine[];
  onClearLogs: () => void;
}

export function LogsView({ logs, onClearLogs }: LogsViewProps) {
  const logRef = useAutoScroll([logs]);

  return (
    <div className="animate-page-in h-[calc(100vh-130px)] flex flex-col">
      <div className="mb-md">
        <h3 className="text-headline-lg font-headline-lg text-on-surface mb-xs">Console Logs</h3>
        <p className="text-on-surface-variant font-body-md">Real-time agent output and sync events.</p>
      </div>

      <div className="flex-1 glass-panel border border-outline rounded-xl flex flex-col overflow-hidden">
        <div className="bg-surface-container-high px-md py-sm flex items-center justify-between border-b border-outline">
          <div className="flex items-center gap-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-status-pulse" />
            <span className="text-label-caps font-label-caps text-primary uppercase">Status: Agent Running</span>
          </div>
          <button
            onClick={onClearLogs}
            className="text-on-surface-variant hover:text-on-surface transition-colors text-body-sm font-body-sm cursor-pointer"
          >
            Clear
          </button>
        </div>
        <div ref={logRef} className="flex-1 p-md text-code-sm font-code-sm text-on-surface-variant custom-scrollbar overflow-y-auto space-y-1 bg-black/40 select-text">
          {logs.map((log, i) => (
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
      </div>
    </div>
  );
}
