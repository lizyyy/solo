import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { SourceRow } from '@/types';

interface SourceRowsTableProps {
  rows: SourceRow[];
  title?: string;
}

export default function SourceRowsTable({ rows, title = '来源行详情' }: SourceRowsTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">数据来源表</TableHead>
              <TableHead className="w-[80px]">行号</TableHead>
              <TableHead className="w-[120px]">字段名</TableHead>
              <TableHead>原始值</TableHead>
              <TableHead>当前值</TableHead>
              <TableHead>备注</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium text-slate-700">
                  {row.tableName}
                </TableCell>
                <TableCell className="text-slate-600">第 {row.rowNumber} 行</TableCell>
                <TableCell className="text-slate-600">{row.columnName}</TableCell>
                <TableCell>
                  <span className="inline-block px-2 py-1 bg-rose-50 text-rose-700 rounded text-xs font-mono">
                    {row.originalValue}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-block px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-mono">
                    {row.currentValue}
                  </span>
                </TableCell>
                <TableCell className="text-slate-500 text-sm">{row.remark || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
