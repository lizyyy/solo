import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  glass = false,
  hover = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-jazz-border transition-all duration-300',
        glass ? 'glass' : 'bg-jazz-bgLight',
        hover ? 'hover:border-jazz-gold/50 hover:shadow-lg hover:shadow-jazz-gold/10 cursor-pointer' : '',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn('p-4 border-b border-jazz-border/50', className)} {...props}>
      {children}
    </div>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn('p-4 border-t border-jazz-border/50', className)} {...props}>
      {children}
    </div>
  );
};
