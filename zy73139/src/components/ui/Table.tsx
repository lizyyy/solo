import { cn } from '@/lib/utils';
import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';

interface TableProps extends HTMLAttributes<HTMLTableElement> {}

export function Table({ className, ...props }: TableProps) {
  return (
    <table className={cn('w-full text-sm', className)} {...props} />
  );
}

interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TableHeader({ className, ...props }: TableHeaderProps) {
  return (
    <thead
      className={cn('bg-slate-50 border-b border-slate-200', className)}
      {...props}
    />
  );
}

interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TableBody({ className, ...props }: TableBodyProps) {
  return (
    <tbody
      className={cn('divide-y divide-slate-100', className)}
      {...props}
    />
  );
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {}

export function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      className={cn('transition-colors hover:bg-slate-50/50', className)}
      {...props}
    />
  );
}

interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {}

export function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider',
        className
      )}
      {...props}
    />
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

export function TableCell({ className, ...props }: TableCellProps) {
  return (
    <td
      className={cn('px-4 py-3 text-slate-700 align-top', className)}
      {...props}
    />
  );
}
