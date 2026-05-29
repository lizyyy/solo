import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = '处理中...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />
      <p className="text-gray-600 font-medium">{message}</p>
    </div>
  );
}
