import { ReactNode } from 'react';
import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  time: string;
  status?: 'success' | 'pending' | 'warning' | 'error';
  extra?: ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

const statusIcons = {
  success: CheckCircle2,
  pending: Clock,
  warning: AlertCircle,
  error: XCircle,
};

const statusColors = {
  success: 'text-green-500 bg-green-100',
  pending: 'text-slate-500 bg-slate-100',
  warning: 'text-amber-500 bg-amber-100',
  error: 'text-red-500 bg-red-100',
};

export default function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {items.map((item, index) => {
        const Icon = statusIcons[item.status || 'success'];
        const isLast = index === items.length - 1;
        return (
          <div key={item.id} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  statusColors[item.status || 'success']
                )}
              >
                <Icon size={16} />
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 bg-slate-200 my-1" />
              )}
            </div>
            <div className={cn('pb-6 flex-1', isLast && 'pb-0')}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-800">{item.title}</h4>
                  {item.description && (
                    <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                  )}
                  {item.extra && <div className="mt-2">{item.extra}</div>}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                  {item.time}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
