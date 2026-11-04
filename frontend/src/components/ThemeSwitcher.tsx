import { useThemeContext } from '../hooks/ThemeContext';
import type { ThemeMode } from '../types';
import { Icon } from './Icon';

const OPTIONS: { value: ThemeMode; icon: string; label: string }[] = [
  { value: 'light', icon: 'light_mode', label: 'Light' },
  { value: 'dark', icon: 'dark_mode', label: 'Dark' },
  { value: 'system', icon: 'contrast', label: 'Auto (match macOS)' },
];

/** Briefly enables color transitions so a theme switch fades instead of flashing. */
function withTransition(fn: () => void) {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  fn();
  window.setTimeout(() => root.classList.remove('theme-transition'), 250);
}

interface ThemeSwitcherProps {
  /** Show text labels next to icons (settings page) instead of icons only (toolbar). */
  labeled?: boolean;
}

/** macOS-style segmented control for Light / Dark / Auto. */
export function ThemeSwitcher({ labeled = false }: ThemeSwitcherProps) {
  const { mode, setPreference } = useThemeContext();
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="inline-flex items-center p-[2px] rounded-md bg-surface-container-high/80 border border-outline mac-no-drag"
    >
      {OPTIONS.map(opt => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            title={opt.label}
            onClick={() => withTransition(() => setPreference(opt.value))}
            className={`flex items-center gap-1.5 rounded-[5px] transition-colors cursor-pointer ${
              labeled ? 'px-3 h-6 text-body-sm' : 'w-7 h-6 justify-center'
            } ${
              active
                ? 'bg-surface-container-lowest text-on-surface shadow-sm dark:bg-surface-container-highest'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon name={opt.icon} size={14} />
            {labeled && <span>{opt.value === 'system' ? 'Auto' : opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
