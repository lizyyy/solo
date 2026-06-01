import { Table, FileText } from 'lucide-react';
import type { Point } from '../../types';
import { SOURCE_LABELS } from '../../types';

interface SourceRowProps {
  point: Point;
}

export function SourceRow({ point }: SourceRowProps) {
  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Table size={14} className="text-blue-400" />
        来源数据行
      </h4>
      
      <div
        className="p-3 rounded-xl font-mono text-xs"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
        }}
      >
        <div className="text-gray-400 text-[10px] mb-1.5">
          // {SOURCE_LABELS[point.sourceType]} | {point.sourceDetail}
        </div>
        <code className="text-green-400 break-all">
          {point.sourceRow}
        </code>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-gray-500 mb-1">数据来源</div>
          <div className="flex items-center gap-1.5 text-sm text-white">
            <FileText size={12} className="text-blue-400" />
            {SOURCE_LABELS[point.sourceType]}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1">来源详情</div>
          <div className="text-sm text-white truncate" title={point.sourceDetail}>
            {point.sourceDetail}
          </div>
        </div>
      </div>
    </div>
  );
}
