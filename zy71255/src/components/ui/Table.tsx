import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (value: T[keyof T] | undefined, row: T, index: number) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  striped?: boolean;
  selectable?: boolean;
  selectedRows?: T[];
  onRowSelect?: (row: T) => void;
  onSort?: (key: keyof T | string, direction: SortDirection) => void;
  className?: string;
  rowKey?: keyof T | ((row: T) => string);
  onRowClick?: (row: T, index: number) => void;
}

function TableComponent<T extends Record<string, unknown>>({
  columns,
  data,
  striped = true,
  selectable = false,
  selectedRows = [],
  onRowSelect,
  onSort,
  className,
  rowKey,
  onRowClick,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const getRowKey = (row: T, index: number): string => {
    if (rowKey) {
      if (typeof rowKey === 'function') {
        return rowKey(row);
      }
      return String(row[rowKey]);
    }
    return String(index);
  };

  const isRowSelected = (row: T): boolean => {
    if (selectedRows.length === 0) return false;
    const key = getRowKey(row, 0);
    return selectedRows.some(r => getRowKey(r, 0) === key);
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey as keyof T];
      const bVal = b[sortKey as keyof T];

      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDirection]);

  const handleSort = (key: keyof T | string, sortable?: boolean) => {
    if (!sortable) return;

    let newDirection: SortDirection = 'asc';
    if (sortKey === key) {
      if (sortDirection === 'asc') newDirection = 'desc';
      else if (sortDirection === 'desc') newDirection = null;
    }

    setSortKey(newDirection ? key : null);
    setSortDirection(newDirection);
    onSort?.(key, newDirection);
  };

  const handleRowClick = (row: T, index: number) => {
    if (selectable) {
      onRowSelect?.(row);
    }
    onRowClick?.(row, index);
  };

  return (
    <div className={cn('relative overflow-auto rounded-xl border border-white/10', className)}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr
            className="backdrop-blur-xl border-b border-white/10"
            style={{ backgroundColor: 'rgba(10, 22, 40, 0.95)' }}
          >
            {columns.map((column, colIndex) => (
              <th
                key={String(column.key)}
                onClick={() => handleSort(column.key, column.sortable)}
                className={cn(
                  'px-4 py-3 text-left font-semibold font-orbitron tracking-wider',
                  column.sortable ? 'cursor-pointer select-none' : '',
                  'text-white/90 border-r border-white/5 last:border-r-0'
                )}
                style={{ width: column.width }}
              >
                <div className="flex items-center gap-2">
                  <span>{column.header}</span>
                  {column.sortable && (
                    <span className="text-accent-cyan/70">
                      <AnimatePresence mode="wait">
                        {sortKey === column.key && sortDirection === 'asc' ? (
                          <motion.span
                            key="asc"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </motion.span>
                        ) : sortKey === column.key && sortDirection === 'desc' ? (
                          <motion.span
                            key="desc"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="none"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <ChevronsUpDown className="w-4 h-4 opacity-50" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => {
            const isSelected = isRowSelected(row);
            const isEven = rowIndex % 2 === 0;

            return (
              <motion.tr
                key={getRowKey(row, rowIndex)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: rowIndex * 0.03 }}
                onClick={() => handleRowClick(row, rowIndex)}
                className={cn(
                  'transition-all duration-200 border-b border-white/5 last:border-b-0',
                  selectable ? 'cursor-pointer' : '',
                  isSelected
                    ? 'bg-accent-cyan/15'
                    : striped && isEven
                    ? 'bg-white/[0.02] hover:bg-white/[0.05]'
                    : 'hover:bg-white/[0.05]'
                )}
                style={{
                  boxShadow: isSelected
                    ? 'inset 3px 0 0 #00D4FF, 0 0 20px rgba(0, 212, 255, 0.1)'
                    : 'none',
                }}
                whileHover={!isSelected ? { backgroundColor: 'rgba(255, 255, 255, 0.05)' } : undefined}
              >
                {columns.map((column, colIndex) => {
                  const value = row[column.key as keyof T];
                  return (
                    <td
                      key={String(column.key)}
                      className={cn(
                        'px-4 py-3',
                        'text-white/80',
                        'border-r border-white/5 last:border-r-0'
                      )}
                    >
                      {column.render
                        ? column.render(value, row, rowIndex)
                        : value?.toString() ?? '-'}
                    </td>
                  );
                })}
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      {sortedData.length === 0 && (
        <div className="flex items-center justify-center py-12 text-white/40">
          暂无数据
        </div>
      )}
    </div>
  );
}

export default TableComponent;
