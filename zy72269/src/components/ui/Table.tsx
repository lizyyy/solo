import { cn } from '@/lib/utils';

interface TableProps {
  headers: string[];
  data: Array<Record<string, unknown>>;
  className?: string;
  renderRow?: (row: Record<string, unknown>, index: number) => React.ReactNode;
}

export default function Table({ headers, data, className, renderRow }: TableProps) {
  return (
    <div className={cn('overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {headers.map((header, idx) => (
              <th key={idx} className="table-header text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="table-cell text-center text-primary-400 py-8">
                暂无数据
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              renderRow ? (
                renderRow(row, rowIdx)
              ) : (
                <tr key={rowIdx} className="hover:bg-primary-800/30 transition-colors">
                  {headers.map((header, colIdx) => (
                    <td key={colIdx} className="table-cell">
                      {String(row[header.toLowerCase().replace(/\s/g, '_')] ?? '')}
                    </td>
                  ))}
                </tr>
              )
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
