import { useEffect, useCallback, useRef } from 'react';
import { useAppStore, type ToastType } from '@/store/app';

export function useToast() {
  const toast = useAppStore((s) => s.toast);
  const setToast = useAppStore((s) => s.setToast);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (msg: string, type: ToastType = 'info') => {
      clearTimer();
      setToast(msg, type);
      timerRef.current = setTimeout(() => {
        setToast(null);
      }, 5000);
    },
    [setToast, clearTimer],
  );

  useEffect(() => {
    if (toast) {
      clearTimer();
      timerRef.current = setTimeout(() => {
        setToast(null);
      }, 5000);
    }
    return clearTimer;
  }, [toast, setToast, clearTimer]);

  return { toast, showToast };
}
