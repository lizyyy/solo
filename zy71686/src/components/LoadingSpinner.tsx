import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }[size];

  return (
    <Loader2 className={`animate-spin text-primary-600 ${sizeClass} ${className}`} />
  );
}

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = '加载中...' }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-gray-500">{message}</p>
    </div>
  );
}

interface FullPageLoadingProps {
  message?: string;
}

export function FullPageLoading({ message = '加载中...' }: FullPageLoadingProps) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
}
