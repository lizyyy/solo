import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Panel({ children, className, title }: PanelProps) {
  return (
    <div
      className={cn(
        'bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-lg shadow-xl',
        className
      )}
    >
      {title && (
        <div className="px-4 py-3 border-b border-zinc-700/50">
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
