import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface TimelineItem {
  id: string;
  title: string;
  description: string;
  time?: string;
  type: 'normal' | 'delayed' | 'milestone' | 'current';
}

interface TimelineProps {
  items: TimelineItem[];
}

const iconMap = {
  normal: CheckCircle2,
  delayed: Clock,
  milestone: CheckCircle2,
  current: AlertCircle,
};

const colorMap = {
  normal: 'bg-emerald-500 border-emerald-500',
  delayed: 'bg-amber-500 border-amber-500',
  milestone: 'bg-sky-500 border-sky-500',
  current: 'bg-rose-500 border-rose-500 animate-pulse',
};

const textColorMap = {
  normal: 'text-emerald-600',
  delayed: 'text-amber-600',
  milestone: 'text-sky-600',
  current: 'text-rose-600',
};

export default function Timeline({ items }: TimelineProps) {
  return (
    <div className="relative pl-2">
      <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-200" />

      <ul className="space-y-6">
        {items.map((item, index) => {
          const Icon = iconMap[item.type];
          const isLast = index === items.length - 1;

          return (
            <li key={item.id} className="relative pl-12">
              <div
                className={cn(
                  'absolute left-0 top-0.5 w-10 h-10 rounded-full border-2 flex items-center justify-center bg-white z-10',
                  colorMap[item.type]
                )}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>

              <div className={cn('pt-1', isLast ? '' : 'pb-2')}>
                <div className="flex items-baseline gap-3 mb-1">
                  <h4
                    className={cn(
                      'text-sm font-semibold',
                      textColorMap[item.type]
                    )}
                  >
                    {item.title}
                  </h4>
                  {item.time && (
                    <span className="text-xs text-slate-400">{item.time}</span>
                  )}
                </div>
                <p className="text-sm text-slate-600">{item.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
