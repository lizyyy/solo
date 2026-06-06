import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  headerAction?: ReactNode;
}

export const Card = ({ children, className, title, subtitle, headerAction }: CardProps) => {
  return (
    <div className={cn('bg-white rounded-sm border border-gray-200 shadow-sm', className)}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                {title}
              </h3>
            )}
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
