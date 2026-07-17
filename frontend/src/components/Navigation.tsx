import type { TabId } from '../types';

interface NavItem {
  id: TabId;
  icon: string;
  label: string;
}

interface NavigationProps {
  items: NavItem[];
  active: TabId;
  onSelect: (id: TabId) => void;
}

export function Navigation({ items, active, onSelect }: NavigationProps) {
  return (
    <>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`w-full flex items-center gap-sm px-sm py-sm rounded-lg transition-all duration-150 text-body-sm font-body-sm cursor-pointer text-left ${
            active === item.id
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </>
  );
}
