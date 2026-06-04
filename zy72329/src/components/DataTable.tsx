import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { cn } from '../lib/utils';
import StatusBadge from './StatusBadge';
import { RecordStatus } from '../../shared/types';

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  numeric?: boolean;
}

interface DataTableProps<T extends { id: string; status: RecordStatus }> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  onViewEvidence?: (row: T) => void;
  expandable?: boolean;
  renderExpanded?: (row: T) => ReactNode;
  loading?: boolean;
}

export default function DataTable<T extends { id: string; status: RecordStatus }>({
  columns,
  data,
  onRowClick,
  onViewEvidence,
  expandable = false,
  renderExpanded,
  loading = false,
}: DataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const defaultColumns: Column<T>[] = [
    ...columns,
    {
      key: 'status',
      header: '状态',
      width: '100px',
      align: 'center',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  if (onViewEvidence) {
    defaultColumns.push({
      key: 'actions',
      header: '操作',
      width: '80px',
      align: 'center',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewEvidence(row);
          }}
          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
          title="查看证据链"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    });
  }

  if (expandable) {
    defaultColumns.unshift({
      key: 'expand',
      header: '',
      width: '40px',
      align: 'center',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleRow(row.id);
          }}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          {expandedRows.has(row.id) ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
      ),
    });
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 text-center text-gray-500">加载中...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 text-center text-gray-500">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {defaultColumns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.width && `w-[${col.width}]`
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, index) => (
              <>
                <tr
                  key={row.id}
                  className={cn(
                    'transition-colors',
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                    onRowClick && 'cursor-pointer hover:bg-blue-50/50',
                    expandedRows.has(row.id) && 'bg-blue-50/30'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {defaultColumns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn(
                        'px-4 py-3 text-sm',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right',
                        col.numeric && 'font-mono tabular-nums'
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? '')}
                    </td>
                  ))}
                </tr>
                {expandable && expandedRows.has(row.id) && renderExpanded && (
                  <tr className="bg-gray-50/80">
                    <td
                      colSpan={defaultColumns.length}
                      className="px-4 py-4 border-t border-gray-100"
                    >
                      {renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { DataTable };
export type { Column, DataTableProps };
