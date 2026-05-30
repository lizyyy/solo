import { Inbox } from 'lucide-react';

export interface ColumnDef<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  statusAccessor?: keyof T;
  onRowClick?: (row: T) => void;
  emptyText?: string;
}

export default function DataTable<T extends object>({
  columns,
  data,
  statusAccessor,
  onRowClick,
  emptyText = '暂无数据',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
        <Inbox size={40} strokeWidth={1} />
        <p className="mt-3 text-sm">{emptyText}</p>
      </div>
    );
  }

  const getRowClass = (row: T) => {
    if (!statusAccessor) return '';
    const status = row[statusAccessor] as string;
    if (status === 'error') return 'error-row';
    if (status === 'warning') return 'warning-row';
    return '';
  };

  const getCellContent = (row: T, col: ColumnDef<T>) => {
    if (typeof col.accessor === 'function') return col.accessor(row);
    return row[col.accessor] as React.ReactNode;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200">
            {columns.map((col) => (
              <th
                key={col.header}
                className={`px-3 py-2.5 font-medium text-zinc-500 whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const rowClass = getRowClass(row);
            return (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-zinc-100 transition-colors ${
                  rowClass
                    ? rowClass
                    : i % 2 === 1
                    ? 'bg-zinc-50/50'
                    : ''
                } ${onRowClick ? 'cursor-pointer hover:bg-zinc-50' : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`px-3 py-2.5 whitespace-nowrap ${
                      col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {getCellContent(row, col)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
