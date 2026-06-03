import { ReactNode, CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  style?: CSSProperties;
}

export default function Card({ title, children, className, headerAction, style }: CardProps) {
  return (
    <div className={cn('card-industrial', className)} style={style}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-primary-700">
          {title && (
            <h3 className="font-mono text-sm font-semibold text-primary-200 tracking-wider uppercase">
              {title}
            </h3>
          )}
          {headerAction}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
