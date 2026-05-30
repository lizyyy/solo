import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-neon-purple-500/30 border-t-neon-purple-500',
        sizeClasses[size],
        className
      )}
    />
  );
}

export function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-deep-blue-900/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto" />
        <p className="mt-4 text-deep-blue-300 text-sm">加载中...</p>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="h-4 bg-deep-blue-500/30 rounded w-1/2 mb-4" />
      <div className="h-8 bg-deep-blue-500/30 rounded w-1/3" />
    </div>
  );
}
