import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  extra?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function Card({ title, subtitle, children, extra, className, bodyClassName }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm', className)}>
      {(title || extra) && (
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {extra && <div className="flex items-center">{extra}</div>}
        </div>
      )}
      <div className={cn('p-6', bodyClassName)}>{children}</div>
    </div>
  );
}
