import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Loading from './Loading';
import Empty from './Empty';

interface Column<T> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (record: T, index: number) => ReactNode;
  width?: string;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  rowKey?: (record: T) => string;
  className?: string;
  onRowClick?: (record: T) => void;
}

export default function Table<T extends object>({
  columns,
  data,
  loading,
  pagination,
  rowKey,
  className,
  onRowClick,
}: TableProps<T>) {
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  const renderPageNumbers = () => {
    if (!pagination) return null;
    const pages: number[] = [];
    const maxVisible = 5;
    const current = pagination.current;
    
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider',
                    col.className
                  )}
                  style={{ width: col.width }}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <Loading text="加载中..." />
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <Empty />
                </td>
              </tr>
            ) : (
              data.map((record, index) => (
                <tr
                  key={rowKey ? rowKey(record) : index}
                  className={cn(
                    'hover:bg-slate-50 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(record)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 text-sm text-slate-700', col.className)}
                    >
                      {col.render
                        ? col.render(record, index)
                        : col.dataIndex
                        ? (record[col.dataIndex] as ReactNode)
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-sm text-slate-500">
            共 {pagination.total} 条，第 {pagination.current} / {totalPages} 页
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onChange(pagination.current - 1, pagination.pageSize)}
              disabled={pagination.current <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            {renderPageNumbers()?.map((page) => (
              <button
                key={page}
                onClick={() => pagination.onChange(page, pagination.pageSize)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                  page === pagination.current
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                )}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => pagination.onChange(pagination.current + 1, pagination.pageSize)}
              disabled={pagination.current >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
            <select
              value={pagination.pageSize}
              onChange={(e) => pagination.onChange(1, parseInt(e.target.value))}
              className="ml-2 px-2 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
