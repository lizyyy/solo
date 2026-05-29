import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../../types';
import { formatTimestamp } from '../../utils/format';

interface LogViewerProps {
  logs: LogEntry[];
  title?: string;
  maxHeight?: string;
  autoScroll?: boolean;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  logs, title = '处理日志', maxHeight = '400px', autoScroll = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);
  
  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'text-success-600 bg-success-50';
      case 'error':
        return 'text-danger-600 bg-danger-50';
      case 'warn':
        return 'text-warning-600 bg-warning-50';
      default:
        return 'text-primary-600 bg-primary-50';
    }
  };
  
  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warn':
        return '⚠';
      default:
        return 'ℹ';
    }
  };
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          <span className="text-xs text-gray-500">共 {logs.length} 条日志</span>
        </div>
      </div>
      <div
        ref={containerRef}
        className="overflow-y-auto p-4 space-y-2 font-mono text-xs"
        style={{ maxHeight }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-400 text-center py-8">暂无日志</div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2 px-2 py-1.5 rounded ${getLogColor(log.level)}`}
            >
              <span className="flex-shrink-0 w-4 text-center">{getLogIcon(log.level)}</span>
              <span className="flex-shrink-0 text-gray-500">{formatTimestamp(log.timestamp, 'HH:mm:ss')}</span>
              <span className="flex-1">{log.message}</span>
              {log.details && (
                <span className="flex-shrink-0 text-gray-500 ml-2 opacity-75">{log.details}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface DataTableProps<T> {
  columns: {
    key: string;
    header: string;
    render?: (row: T) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
  }[];
  data: T[];
  rowKey: string | ((row: T) => string);
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  pagination?: {
    currentPage: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  onRowClick,
  rowClassName,
  emptyMessage = '暂无数据',
  loading = false
}: DataTableProps<T>) {
  const getKey = (row: T) => {
    return typeof rowKey === 'function' ? rowKey(row) : row[rowKey];
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                style={{ width: col.width, textAlign: col.align || 'left' }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                <div className="animate-pulse">加载中...</div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={getKey(row)}
                className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName ? rowClassName(row) : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-sm text-gray-900"
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
