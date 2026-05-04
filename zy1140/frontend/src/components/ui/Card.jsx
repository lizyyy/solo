import { cn } from '../utils/cn';

export const Card = ({ children, className, onClick }) => (
  <div 
    onClick={onClick}
    className={cn(
      'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700',
      onClick && 'cursor-pointer hover:shadow-md transition-shadow',
      className
    )}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className }) => (
  <div className={cn('px-6 py-4 border-b border-gray-200 dark:border-gray-700', className)}>
    {children}
  </div>
);

export const CardContent = ({ children, className }) => (
  <div className={cn('px-6 py-4', className)}>
    {children}
  </div>
);

export const CardFooter = ({ children, className }) => (
  <div className={cn('px-6 py-4 border-t border-gray-200 dark:border-gray-700', className)}>
    {children}
  </div>
);
