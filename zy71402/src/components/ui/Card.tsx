import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  bordered?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, hover = false, bordered = true, ...props }) => (
  <div
    className={cn(
      'bg-white rounded-lg shadow-sm',
      bordered && 'border border-gray-200',
      hover && 'hover:shadow-md transition-shadow cursor-pointer',
      className
    )}
    {...props}
  />
);
Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
export const CardHeader: React.FC<CardHeaderProps> = ({ className, ...props }) => (
  <div className={cn('px-6 py-4 border-b border-gray-200', className)} {...props} />
);
CardHeader.displayName = 'CardHeader';

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
export const CardTitle: React.FC<CardTitleProps> = ({ className, ...props }) => (
  <h3 className={cn('text-lg font-semibold text-gray-900', className)} {...props} />
);
CardTitle.displayName = 'CardTitle';

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
export const CardDescription: React.FC<CardDescriptionProps> = ({ className, ...props }) => (
  <p className={cn('text-sm text-gray-500 mt-1', className)} {...props} />
);
CardDescription.displayName = 'CardDescription';

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
export const CardContent: React.FC<CardContentProps> = ({ className, ...props }) => (
  <div className={cn('px-6 py-4', className)} {...props} />
);
CardContent.displayName = 'CardContent';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
export const CardFooter: React.FC<CardFooterProps> = ({ className, ...props }) => (
  <div className={cn('px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg', className)} {...props} />
);
CardFooter.displayName = 'CardFooter';
