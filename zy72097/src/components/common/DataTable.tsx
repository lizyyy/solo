import React, { useRef, useEffect } from 'react';
import { Eye, ArrowRight, AlertTriangle, Copy, AlertCircle, Clock, History } from 'lucide-react';
import type { ProcessedData, RawData } from '../../types';
import StatusBadge from './StatusBadge';
import { formatNumber } from '../../utils/format';

type TableRowData = ProcessedData | RawData;

interface DataTableProps {
  data: TableRowData[];
  highlightId?: string;
  onRowClick: (dataId: string) => void;
}

const isProcessedData = (item: TableRowData): item is ProcessedData => {
  return 'stressConverted' in item;
};

const DataTable: React.FC<DataTableProps> = ({ data, highlightId, onRowClick }) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    if (highlightId && rowRefs.current.has(highlightId)) {
      const row = rowRefs.current.get(highlightId)!;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('bg-warning-100');
      setTimeout(() => row.classList.remove('bg-warning-100'), 2000);
    }
  }, [highlightId]);

  const getRowStatusClass = (item: TableRowData): string => {
    if (!isProcessedData(item)) return 'hover:bg-engineering-50';
    if (item.status === 'pending') return 'bg-warning-50/50';
    if (item.status === 'historical') return 'bg-historical-50/50';
    if (item.isAnomaly) return 'bg-danger-50/50';
    return 'hover:bg-engineering-50';
  };

  const getIssueIcon = (item: TableRowData) => {
    if (!isProcessedData(item)) return null;
    if (item.isNull) return <AlertCircle className="w-4 h-4 text-warning-600" />;
    if (item.isDuplicate) return <Copy className="w-4 h-4 text-historical-600" />;
    if (item.isAnomaly) return <AlertTriangle className="w-4 h-4 text-danger-600" />;
    if (item.stressUnit !== item.targetStressUnit || item.lifeUnit !== item.targetLifeUnit) {
      return <ArrowRight className="w-4 h-4 text-blue-600" />;
    }
    return null;
  };

  return (
    <div ref={tableRef} className="overflow-auto scrollbar-thin max-h-[600px]">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="table-header">
            <th className="table-cell text-left w-16">序号</th>
            <th className="table-cell text-left w-24">记录ID</th>
            <th className="table-cell text-left w-28">材料</th>
            <th className="table-cell text-right w-32">应力 (MPa)</th>
            <th className="table-cell text-right w-32">寿命 (次)</th>
            <th className="table-cell text-left w-32">来源</th>
            <th className="table-cell text-left w-24">状态</th>
            <th className="table-cell text-center w-16">问题</th>
            <th className="table-cell text-center w-16">操作</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={item.id}
              ref={(el) => {
                if (el) rowRefs.current.set(item.id, el);
              }}
              className={`border-b border-engineering-100 transition-colors cursor-pointer ${getRowStatusClass(item)}`}
              onClick={() => onRowClick(item.id)}
            >
              <td className="table-cell text-engineering-500">{index + 1}</td>
              <td className="table-cell font-mono-num text-sm text-engineering-700">{item.id}</td>
              <td className="table-cell font-medium text-engineering-800">{item.material}</td>
              <td className="table-cell text-right">
                <div className="flex items-center justify-end gap-1">
                  {isProcessedData(item) && item.stressUnit !== item.targetStressUnit && (
                    <span className="text-xs text-warning-600">
                      {formatNumber(item.stress)} {item.stressUnit}
                      <ArrowRight className="w-3 h-3 inline mx-1" />
                    </span>
                  )}
                  <span className={`font-mono-num ${isProcessedData(item) && item.stressUnit !== item.targetStressUnit ? 'font-semibold text-engineering-800' : 'text-engineering-700'}`}>
                    {formatNumber(isProcessedData(item) ? item.stressConverted : item.stress)}
                  </span>
                </div>
              </td>
              <td className="table-cell text-right">
                <div className="flex items-center justify-end gap-1">
                  {isProcessedData(item) && item.lifeUnit !== item.targetLifeUnit && (
                    <span className="text-xs text-warning-600">
                      {formatNumber(item.life)} {item.lifeUnit}
                      <ArrowRight className="w-3 h-3 inline mx-1" />
                    </span>
                  )}
                  <span className={`font-mono-num ${isProcessedData(item) && item.lifeUnit !== item.targetLifeUnit ? 'font-semibold text-engineering-800' : 'text-engineering-700'}`}>
                    {formatNumber(isProcessedData(item) ? item.lifeConverted : item.life)}
                  </span>
                </div>
              </td>
              <td className="table-cell">
                <div className="flex items-center gap-1">
                  {item.source.includes('汇总页') && <History className="w-3 h-3 text-historical-600" />}
                  <span className="text-xs text-engineering-600 truncate max-w-[120px]" title={item.source}>
                    {item.source}
                  </span>
                </div>
              </td>
              <td className="table-cell">
                {isProcessedData(item) ? (
                  <StatusBadge status={item.status} showIcon={false} size="sm" />
                ) : (
                  <span className="text-xs text-engineering-400">未处理</span>
                )}
              </td>
              <td className="table-cell text-center">
                {getIssueIcon(item)}
              </td>
              <td className="table-cell text-center">
                <button
                  className="p-1.5 hover:bg-engineering-200 rounded-engineering text-engineering-500 hover:text-engineering-800 transition-colors"
                  title="查看明细"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
