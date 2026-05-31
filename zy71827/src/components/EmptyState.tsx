import { motion } from 'framer-motion';
import { MountainSnow } from 'lucide-react';
import { cn } from '@/utils/helpers';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon = MountainSnow,
  title,
  description,
  actionText,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-200 to-cyan-200 rounded-full blur-2xl opacity-30 scale-150" />
        
        <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-sky-50 to-white border border-sky-100 flex items-center justify-center shadow-lg">
          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 96 96">
            <path
              d="M10,80 L25,50 L35,65 L50,30 L65,55 L75,40 L90,60 L90,80 Z"
              fill="url(#emptySnow)"
            />
            <defs>
              <linearGradient id="emptySnow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>
          </svg>
          
          <Icon className="relative w-12 h-12 text-sky-500" strokeWidth={1.5} />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      
      {description && (
        <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      )}

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:from-sky-600 hover:to-cyan-600 transition-all shadow-md shadow-sky-500/20 hover:shadow-lg hover:shadow-sky-500/30"
        >
          {actionText}
        </button>
      )}
    </motion.div>
  );
}
