import React, { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckSquare,
  Square,
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface Column<T> {
  key: keyof T | string;
  title: string;
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey?: keyof T | ((row: T) => string);
  selectable?: boolean;
  selectedRows?: T[];
  onSelectChange?: (selected: T[]) => void;
  pagination?: boolean;
  pageSize?: number;
  currentPage?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onRowClick?: (row: T, index: number) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
  className?: string;
  emptyText?: string;
  loading?: boolean;
}

function defaultGetRowKey<T>(row: T, index: number): string {
  return String(index);
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  selectable = false,
  selectedRows = [],
  onSelectChange,
  pagination = true,
  pageSize: propPageSize = 10,
  currentPage: propCurrentPage = 1,
  total: propTotal,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onSort,
  defaultSortKey,
  defaultSortDirection = 'asc',
  className,
  emptyText = '暂无数据',
  loading = false,
}: DataTableProps<T>) {
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(propPageSize);
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);
  const [internalSelected, setInternalSelected] = useState<T[]>([]);

  const currentPage = onPageChange ? propCurrentPage : internalPage;
  const pageSize = onPageSizeChange ? propPageSize : internalPageSize;
  const total = propTotal ?? data.length;
  const selected = onSelectChange ? selectedRows : internalSelected;

  const getRowKey = (row: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(row);
    }
    if (rowKey && row[rowKey]) {
      return String(row[rowKey]);
    }
    return defaultGetRowKey(row, index);
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !onSort) {
      return data;
    }
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      const compare = aVal > bVal ? 1 : -1;
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [data, sortKey, sortDirection, onSort]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, pagination]);

  const totalPages = Math.ceil(total / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      onSort?.(key, newDirection);
    } else {
      setSortKey(key);
      setSortDirection('asc');
      onSort?.(key, 'asc');
    }
  };

  const handleSelectAll = () => {
    if (selected.length === paginatedData.length && selected.length > 0) {
      const newSelected: T[] = [];
      if (onSelectChange) {
        onSelectChange(newSelected);
      } else {
        setInternalSelected(newSelected);
      }
    } else {
      if (onSelectChange) {
        onSelectChange([...paginatedData]);
      } else {
        setInternalSelected([...paginatedData]);
      }
    }
  };

  const handleSelectRow = (row: T) => {
    const key = getRowKey(row, 0);
    const isSelected = selected.some((r) => getRowKey(r, 0) === key);
    let newSelected: T[];
    if (isSelected) {
      newSelected = selected.filter((r) => getRowKey(r, 0) !== key);
    } else {
      newSelected = [...selected, row];
    }
    if (onSelectChange) {
      onSelectChange(newSelected);
    } else {
      setInternalSelected(newSelected);
    }
  };

  const isRowSelected = (row: T, index: number): boolean => {
    const key = getRowKey(row, index);
    return selected.some((r) => getRowKey(r, 0) === key);
  };

  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      setInternalPage(page);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = Number(e.target.value);
    if (onPageSizeChange) {
      onPageSizeChange(size);
    } else {
      setInternalPageSize(size);
      setInternalPage(1);
    }
  };

  const renderCell = (row: T, column: Column<T>, rowIndex: number): React.ReactNode => {
    if (column.render) {
      return column.render(row, rowIndex);
    }
    const key = column.key as keyof T;
    return row[key] as React.ReactNode;
  };

  const alignClass = (align?: string) => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  const allSelected = paginatedData.length > 0 && paginatedData.every((row, idx) => isRowSelected(row, idx));

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {selectable && (
                <th className="px-4 py-3 w-12">
                  <button
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap',
                    alignClass(column.align),
                    column.sortable && 'cursor-pointer hover:bg-slate-100 transition-colors select-none'
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className={cn('inline-flex items-center gap-1', alignClass(column.align))}>
                    {column.title}
                    {column.sortable && (
                      <span className="inline-flex flex-col -space-y-1">
                        <ChevronUp
                          className={cn(
                            'w-3 h-3',
                            sortKey === column.key && sortDirection === 'asc'
                              ? 'text-blue-600'
                              : 'text-slate-300'
                          )}
                        />
                        <ChevronDown
                          className={cn(
                            'w-3 h-3',
                            sortKey === column.key && sortDirection === 'desc'
                              ? 'text-blue-600'
                              : 'text-slate-300'
                          )}
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                    <span>加载中...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-16 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                      <Square className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-base font-medium text-slate-600">{emptyText}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => {
                const isSelected = isRowSelected(row, rowIndex);
                return (
                  <tr
                    key={getRowKey(row, rowIndex)}
                    className={cn(
                      'transition-colors',
                      isSelected && 'bg-blue-50',
                      onRowClick && 'hover:bg-slate-50 cursor-pointer'
                    )}
                    onClick={() => onRowClick?.(row, rowIndex)}
                  >
                    {selectable && (
                      <td className="px-4 py-3 w-12" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSelectRow(row)}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={cn(
                          'px-4 py-3 text-sm text-slate-700',
                          alignClass(column.align)
                        )}
                      >
                        {renderCell(row, column, rowIndex)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && total > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>共 {total} 条</span>
            <div className="flex items-center gap-2">
              <span>每页</span>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>条</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentPage === 1
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentPage === 1
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={cn(
                      'min-w-8 h-8 px-2 rounded-lg text-sm font-medium transition-colors',
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentPage === totalPages || totalPages === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentPage === totalPages || totalPages === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
