import type { ReactNode } from 'react';

interface GroupProps {
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}

/** System Settings-style inset group: a caption above a rounded box of rows. */
export function Group({ title, footer, children }: GroupProps) {
  return (
    <section className="space-y-1.5">
      {title && <h2 className="px-1 text-body-sm font-semibold text-on-surface-variant">{title}</h2>}
      <div className="bg-surface-container border border-outline rounded-xl card-shadow divide-y divide-outline overflow-hidden">
        {children}
      </div>
      {footer && <div className="px-1 text-body-sm text-on-surface-variant">{footer}</div>}
    </section>
  );
}

interface RowProps {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

/** One labeled row inside a Group, with the control right-aligned. */
export function Row({ label, description, children }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 min-h-[44px] py-2">
      <div className="min-w-0">
        <div className="text-body-md text-on-surface">{label}</div>
        {description && <div className="text-body-sm text-on-surface-variant mt-0.5">{description}</div>}
      </div>
      {children !== undefined && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  title?: string;
}

/** macOS push button. */
export function Button({ children, onClick, disabled, variant = 'secondary', title }: ButtonProps) {
  const styles = {
    primary: 'bg-primary text-on-primary hover:brightness-110 shadow-sm',
    secondary: 'bg-surface-container-lowest dark:bg-surface-container-high text-on-surface border border-outline hover:bg-surface-container-high dark:hover:bg-surface-container-highest shadow-sm',
    destructive: 'bg-surface-container-lowest dark:bg-surface-container-high text-error border border-outline hover:bg-error/10 shadow-sm',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-body-md font-medium transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-default disabled:active:scale-100 ${styles}`}
    >
      {children}
    </button>
  );
}
