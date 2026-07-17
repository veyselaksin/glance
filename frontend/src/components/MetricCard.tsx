interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  pctVal?: number;
  color: string;
}

export function MetricCard({ icon, label, value, sub, pctVal, color }: MetricCardProps) {
  return (
    <div className="bg-background border border-outline rounded-lg p-md flex flex-col">
      <div className="flex items-center gap-xs mb-sm">
        <span className="material-symbols-outlined" style={{ fontSize: 16, color }}>{icon}</span>
        <span className="text-label-caps font-label-caps text-on-surface-variant uppercase">{label}</span>
      </div>
      <div className="text-[22px] font-bold font-mono leading-none mb-xs" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-on-surface-variant font-body-sm">{sub}</div>}
      {pctVal !== undefined && (
        <div className="mt-sm h-1.5 rounded-full bg-surface-container-high overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctVal}%`, backgroundColor: color }} />
        </div>
      )}
    </div>
  );
}
