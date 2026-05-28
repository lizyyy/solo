import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: keyof T | string;
  header: ReactNode;
  render?: (row: T, index: number) => ReactNode;
  isNote?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  getRowIsDirty?: (row: T, index: number) => boolean;
  getRowKey?: (row: T, index: number) => string;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
  headerClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  emptyMessage?: ReactNode;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  getRowIsDirty,
  getRowKey,
  striped = true,
  hoverable = true,
  className,
  headerClassName,
  rowClassName,
  emptyMessage = '暂无数据',
}: DataTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto rounded-sm border border-rock-light/30 bg-rock-dark', className)}>
      <table className="w-full text-sm text-left">
        <thead className={cn(
          'text-xs uppercase tracking-wider font-rock',
          'bg-rock-gray/50 text-neon-cyan border-b border-rock-light/30',
          headerClassName
        )}>
          <tr>
            {getRowIsDirty && (
              <th scope="col" className="px-4 py-3 w-10">
                <span className="sr-only">状态</span>
              </th>
            )}
            {columns.map((column, index) => (
              <th
                key={String(column.key)}
                scope="col"
                className={cn(
                  'px-4 py-3',
                  column.isNote && 'italic',
                  column.headerClassName
                )}
                style={index === 0 ? { paddingLeft: getRowIsDirty ? '0.5rem' : '1rem' } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (getRowIsDirty ? 1 : 0)}
                className="px-4 py-12 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const isDirty = getRowIsDirty?.(row, rowIndex) ?? false;
              const key = getRowKey?.(row, rowIndex) ?? String(rowIndex);
              const getRowClass = typeof rowClassName === 'function'
                ? rowClassName(row, rowIndex)
                : rowClassName;

              return (
                <motion.tr
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: rowIndex * 0.03 }}
                  className={cn(
                    'border-b border-rock-light/20 transition-colors',
                    striped && rowIndex % 2 === 0 ? 'bg-rock-dark' : 'bg-rock-gray/20',
                    hoverable && 'hover:bg-rock-light/30',
                    isDirty && 'bg-warning-orange/10 hover:bg-warning-orange/15',
                    getRowClass
                  )}
                >
                  {getRowIsDirty && (
                    <td className="px-4 py-3 w-10">
                      {isDirty && (
                        <motion.div
                          animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.7, 1, 0.7],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className="text-warning-orange"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </motion.div>
                      )}
                    </td>
                  )}
                  {columns.map((column, colIndex) => {
                    const cellValue = column.key in row
                      ? row[column.key as keyof T]
                      : undefined;
                    const content = column.render
                      ? column.render(row, rowIndex)
                      : cellValue as ReactNode;

                    return (
                      <td
                        key={String(column.key)}
                        className={cn(
                          'px-4 py-3 text-gray-200',
                          column.isNote && 'italic text-gray-400',
                          isDirty && 'text-warning-orange',
                          column.className
                        )}
                        style={colIndex === 0 ? { paddingLeft: getRowIsDirty ? '0.5rem' : '1rem' } : undefined}
                      >
                        {content}
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
