import React from 'react';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import type { SettlementDetail, DetailStatus } from '../../shared/types.js';
import { CurrencyCell } from './CurrencyCell.js';
import { Clock, AlertCircle, Eye, CheckCircle2 } from 'lucide-react';

interface SettlementTableProps {
  details: SettlementDetail[];
  onSelectDetail: (id: string) => void;
  selectedDetailId?: string;
}

const statusConfig: Record<DetailStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'PENDING': { label: '待处理', color: 'text-navy-600', bg: 'bg-navy-100', icon: <Clock size={12} /> },
  'EXCEPTION': { label: '异常', color: 'text-audit-red', bg: 'bg-audit-red/10', icon: <AlertCircle size={12} /> },
  'PENDING_REVIEW': { label: '待复核', color: 'text-audit-orange', bg: 'bg-audit-orange/10', icon: <Eye size={12} /> },
  'REVIEWED': { label: '已复核', color: 'text-navy-600', bg: 'bg-navy-200', icon: <Eye size={12} /> },
  'APPROVED': { label: '已通过', color: 'text-audit-green', bg: 'bg-audit-green/10', icon: <CheckCircle2 size={12} /> }
};

export const SettlementTable: React.FC<SettlementTableProps> = ({ details, onSelectDetail, selectedDetailId }) => {
  const columns = React.useMemo(() => [
    {
      accessorKey: 'originalLineNo',
      header: '原始行号',
      cell: ({ row }: any) => (
        <span className="font-mono text-sm font-semibold text-navy-800">#{row.original.originalLineNo}</span>
      ),
      size: 80
    },
    {
      accessorKey: 'policyNo',
      header: '保单号',
      cell: ({ row }: any) => (
        <span className="font-mono text-sm text-navy-700">{row.original.policyNo}</span>
      ),
      size: 120
    },
    {
      accessorKey: 'productName',
      header: '产品名称',
      cell: ({ row }: any) => (
        <span className="text-sm text-navy-700">{row.original.productName}</span>
      ),
      size: 160
    },
    {
      accessorKey: 'commissionAmount',
      header: '佣金金额',
      cell: ({ row }: any) => (
        <span className="font-mono text-sm text-right block text-navy-700">
          {row.original.commissionAmount.toLocaleString()}
        </span>
      ),
      size: 120
    },
    {
      accessorKey: 'currency',
      header: '币种',
      cell: ({ row }: any) => (
        <CurrencyCell
          currencyRaw={row.original.currencyRaw}
          currency={row.original.currency}
          hasMixed={row.original.hasMixedCurrency}
          onReview={() => onSelectDetail(row.original.id)}
        />
      ),
      size: 180
    },
    {
      accessorKey: 'tierLevel',
      header: '阶梯',
      cell: ({ row }: any) => (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-navy-100 text-navy-700 font-mono text-sm font-semibold">
          Lv.{row.original.tierLevel}
        </span>
      ),
      size: 60
    },
    {
      accessorKey: 'tierRate',
      header: '阶梯费率',
      cell: ({ row }: any) => (
        <span className="font-mono text-sm text-navy-700">
          {(row.original.tierRate * 100).toFixed(0)}%
        </span>
      ),
      size: 80
    },
    {
      accessorKey: 'taxRate',
      header: '税费率',
      cell: ({ row }: any) => (
        <span className={`font-mono text-sm ${row.original.taxRate !== undefined ? 'text-navy-700' : 'text-navy-400 italic'}`}>
          {row.original.taxRate !== undefined ? `${(row.original.taxRate * 100).toFixed(1)}%` : '待补录'}
        </span>
      ),
      size: 80
    },
    {
      accessorKey: 'netAmount',
      header: '净佣金',
      cell: ({ row }: any) => (
        <span className="font-mono text-sm font-semibold text-right block text-navy-800">
          {row.original.netAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
      size: 120
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: ({ row }: any) => {
        const config = statusConfig[row.original.status as DetailStatus];
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.color}`}>
            {config.icon}
            {config.label}
          </span>
        );
      },
      size: 90
    }
  ], []);

  const table = useReactTable({
    data: details,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div className="bg-white rounded-lg border border-navy-200 overflow-hidden">
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-navy-800">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider"
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-navy-100">
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                onClick={() => onSelectDetail(row.original.id)}
                className={`cursor-pointer transition-colors ${
                  selectedDetailId === row.original.id 
                    ? 'bg-navy-50 border-l-4 border-l-navy-600' 
                    : idx % 2 === 0 ? 'bg-white hover:bg-navy-50/50' : 'bg-navy-50/30 hover:bg-navy-50/50'
                } ${row.original.hasMixedCurrency ? 'bg-audit-orange/5' : ''}`}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className="px-4 py-3"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {details.length === 0 && (
        <div className="p-12 text-center text-navy-400">
          <p className="font-display text-lg">暂无明细数据</p>
          <p className="text-sm mt-1">请先导入除权日截图数据</p>
        </div>
      )}
    </div>
  );
};
