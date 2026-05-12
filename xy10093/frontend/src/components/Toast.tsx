import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners = new Set<(toasts: ToastItem[]) => void>();
let allToasts: ToastItem[] = [];

export function showToast(message: string, type: ToastType = 'info') {
  const id = ++toastId;
  allToasts = [...allToasts, { id, message, type }];
  listeners.forEach(l => l(allToasts));
  setTimeout(() => {
    allToasts = allToasts.filter(t => t.id !== id);
    listeners.forEach(l => l(allToasts));
  }, 3000);
}

export function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  
  useEffect(() => {
    const update = (t: ToastItem[]) => setToasts([...t]);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}
