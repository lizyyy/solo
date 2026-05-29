import { Loader2 } from 'lucide-react';
import { useUIStore } from '../store/uiStore';

export function LoadingOverlay() {
  const { loadingOverlay } = useUIStore();

  if (!loadingOverlay) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-slate-800 animate-spin" />
        <p className="text-sm font-medium text-stone-600">处理中，请稍候...</p>
      </div>
    </div>
  );
}
