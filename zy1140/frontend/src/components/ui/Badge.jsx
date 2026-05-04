import { cn } from '../utils/cn';

const severityStyles = {
  critical: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  high: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-200 dark:border-yellow-800',
    dot: 'bg-yellow-500',
  },
  low: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
};

export const Badge = ({ 
  children, 
  variant = 'default', 
  className,
  showDot = false,
}) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    primary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    critical: severityStyles.critical.bg + ' ' + severityStyles.critical.text,
    high: severityStyles.high.bg + ' ' + severityStyles.high.text,
    medium: severityStyles.medium.bg + ' ' + severityStyles.medium.text,
    low: severityStyles.low.bg + ' ' + severityStyles.low.text,
  };
  
  const style = severityStyles[variant];
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
      variants[variant] || variants.default,
      className
    )}>
      {showDot && style && (
        <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
      )}
      {children}
    </span>
  );
};

export const Tag = ({ children, onRemove, className, variant = 'default' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    sleep: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    alcohol: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    travel: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
    sick: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    stress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    coffee: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  };
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
      variants[variant] || variants.default,
      className
    )}>
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
};
