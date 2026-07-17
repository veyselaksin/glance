import type { ServerConfig, PingResult } from '../../types';

interface ServerListProps {
  servers: ServerConfig[];
  pings: Record<string, PingResult>;
  selectedID: string | null;
  onSelect: (id: string) => void;
  onEdit: (s: ServerConfig) => void;
  onDelete: (id: string) => void;
}

export function ServerList({ servers, pings, selectedID, onSelect, onEdit, onDelete }: ServerListProps) {
  return (
    <div className="w-72 shrink-0 bg-surface-container border border-outline rounded-xl flex flex-col overflow-hidden">
      <div className="px-md py-sm border-b border-outline flex items-center gap-xs text-primary">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dns</span>
        <span className="text-label-caps font-label-caps uppercase">Servers</span>
        <span className="ml-auto text-[11px] text-on-surface-variant font-code-sm">{servers.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {servers.length === 0 ? (
          <div className="px-md py-xl text-center text-on-surface-variant text-body-sm">
            No servers saved. Click <strong className="text-primary">Add Server</strong> to get started.
          </div>
        ) : (
          <div className="p-sm space-y-xs">
            {servers.map(s => {
              const ping = pings[s.id];
              const online = ping?.online;
              const isHighLatency = online && ping!.latency > 100;
              const isSelected = selectedID === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`group p-sm rounded-lg cursor-pointer transition-all duration-150 border ${isSelected ? 'bg-primary/10 border-primary/30' : 'bg-background border-transparent hover:border-outline hover:bg-white/5'}`}
                >
                  <div className="flex items-start justify-between gap-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-sm">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${online ? (isHighLatency ? 'bg-warning' : 'bg-primary animate-status-pulse') : 'bg-on-surface-variant/30'}`}
                          title={online ? `${ping!.latency.toFixed(1)}ms` : 'Offline'}
                        />
                        <span className={`text-body-sm font-body-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{s.name}</span>
                      </div>
                      <div className="text-[11px] text-on-surface-variant font-code-sm mt-xs truncate ml-sm">{s.username}@{s.ip}:{s.port}</div>
                      {online && (
                        <div className="text-[10px] mt-xs ml-sm" style={{ color: isHighLatency ? '#FF9500' : '#0A84FF' }}>
                          {ping!.latency.toFixed(0)}ms
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                        className="flex items-center justify-center w-6 h-6 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                        className="flex items-center justify-center w-6 h-6 rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_forever</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
