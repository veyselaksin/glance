import { Icon } from './Icon';
type MetricTone = 'primary' | 'success' | 'warning' | 'purple';

const toneClass: Record<MetricTone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  purple: 'text-purple',
};

const toneBar: Record<MetricTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  purple: 'bg-purple',
};

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  pctVal?: number;
  tone: MetricTone;
}

export function MetricCard({ icon, label, value, sub, pctVal, tone }: MetricCardProps) {
  return (
    <div className="bg-background border border-outline rounded-lg p-md flex flex-col">
      <div className="flex items-center gap-xs mb-sm">
        <Icon name={icon} size={16} className={`${toneClass[tone]}`} />
        <span className="text-label-caps font-label-caps text-on-surface-variant uppercase">{label}</span>
      </div>
      <div className={`text-[22px] font-bold font-mono leading-none mb-xs ${toneClass[tone]}`}>{value}</div>
      {sub && <div className="text-[11px] text-on-surface-variant font-body-sm">{sub}</div>}
      {pctVal !== undefined && (
        <div className="mt-sm h-1.5 rounded-full bg-surface-container-high overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${toneBar[tone]}`} style={{ width: `${pctVal}%` }} />
        </div>
      )}
    </div>
  );
}
