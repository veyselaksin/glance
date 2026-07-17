import { useEffect, useState } from 'react';

export interface ToastData {
  message: string;
  type: 'error' | 'success';
}

interface ToastProps {
  toast: ToastData;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ toast, onDismiss, duration = 4000 }: ToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setExiting(false);
    const t = setTimeout(() => setExiting(true), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  const handleTransitionEnd = () => {
    if (exiting) onDismiss();
  };

  const isError = toast.type === 'error';

  return (
    <div
      onAnimationEnd={handleTransitionEnd}
      className={`animate-toast-in ${exiting ? 'animate-toast-out' : ''} mx-auto mb-sm inline-flex items-center gap-2 px-md py-sm rounded-lg border text-body-sm font-body-sm shadow-lg ${
        isError
          ? 'bg-error/10 border-error/30 text-error'
          : 'bg-primary/10 border-primary/30 text-primary'
      }`}
    >
      {isError ? (
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
      ) : (
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
      )}
      <span>{toast.message}</span>
    </div>
  );
}
