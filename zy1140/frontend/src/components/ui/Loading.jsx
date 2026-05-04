import { Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

export const Spinner = ({ className, size = 'default' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    default: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  
  return (
    <Loader2 className={cn('animate-spin text-gray-400', sizes[size], className)} />
  );
};

export const LoadingOverlay = ({ message = '加载中...', className }) => (
  <div className={cn(
    'flex flex-col items-center justify-center py-12 text-gray-500',
    className
  )}>
    <Spinner size="lg" />
    <p className="mt-4 text-sm">{message}</p>
  </div>
);

export const EmptyState = ({ icon: Icon, title, description, action, className }) => (
  <div className={cn(
    'flex flex-col items-center justify-center py-12 text-center',
    className
  )}>
    {Icon && <Icon className="w-12 h-12 text-gray-300 mb-4" />}
    <h3 className="text-gray-700 dark:text-gray-300 font-medium mb-2">{title}</h3>
    {description && (
      <p className="text-gray-500 text-sm max-w-sm">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
