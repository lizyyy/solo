import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  striped?: boolean;
  bordered?: boolean;
}

export const Table: React.FC<TableProps> = ({ className, striped = true, bordered = false, ...props }) => (
  <div className="w-full overflow-auto">
    <table
      className={cn(
        'w-full text-sm text-left',
        bordered && 'border border-gray-200',
        className
      )}
      {...props}
    />
  </div>
);
Table.displayName = 'Table';

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export const TableHeader: React.FC<TableHeaderProps> = ({ className, ...props }) => (
  <thead className={cn('bg-primary-50 text-primary-800 uppercase text-xs', className)} {...props} />
);
TableHeader.displayName = 'TableHeader';

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}
export const TableBody: React.FC<TableBodyProps> = ({ className, ...props }) => (
  <tbody className={cn('divide-y divide-gray-200', className)} {...props} />
);
TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hover?: boolean;
}
export const TableRow: React.FC<TableRowProps> = ({ className, hover = true, ...props }) => (
  <tr className={cn(hover && 'hover:bg-primary-50/50 transition-colors', className)} {...props} />
);
TableRow.displayName = 'TableRow';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}
export const TableHead: React.FC<TableHeadProps> = ({ className, ...props }) => (
  <th className={cn('px-4 py-3 font-semibold', className)} {...props} />
);
TableHead.displayName = 'TableHead';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}
export const TableCell: React.FC<TableCellProps> = ({ className, ...props }) => (
  <td className={cn('px-4 py-3 text-gray-700', className)} {...props} />
);
TableCell.displayName = 'TableCell';
