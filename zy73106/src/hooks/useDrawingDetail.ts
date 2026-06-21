import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import * as api from '@/services/api';

export function useDrawingDetail(id: string | undefined) {
  const mergeDrawingDetail = useAppStore((s) => s.mergeDrawingDetail);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const res = await api.getDrawingDetail(id);
      if (res.ok && res.data && !cancelled) {
        mergeDrawingDetail(res.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, mergeDrawingDetail]);
}
