import React from 'react';
import { Eye, ZoomIn } from 'lucide-react';
import { AlignedSample } from '@/types/samples';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatTime, formatTorque, formatSpeed, formatTemperature, formatLoadLevel } from '@/utils/formatters';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

interface SampleTableProps {
  samples: AlignedSample[];
  onViewDetail?: (sample: AlignedSample) => void;
}

export const SampleTable: React.FC<SampleTableProps> = ({ samples, onViewDetail }) => {
  const { selectedSampleId, highlightSample } = useAppStore();

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <span className="text-sm font-medium text-slate-200">采样明细数据</span>
        <span className="text-xs text-slate-500">共 {samples.length} 条记录</span>
      </div>
      <div className="overflow-x-auto max-h-96 scrollbar-thin">
        <table className="w-full">
          <thead className="table-header sticky top-0">
            <tr>
              <th className="table-cell text-left">时间</th>
              <th className="table-cell text-left">转速</th>
              <th className="table-cell text-left">扭矩</th>
              <th className="table-cell text-left">温度</th>
              <th className="table-cell text-left">负载档</th>
              <th className="table-cell text-left">对齐状态</th>
              <th className="table-cell text-left">数据来源</th>
              <th className="table-cell text-left">异常</th>
              <th className="table-cell text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((sample) => (
              <tr
                key={sample.id}
                className={cn(
                  'transition-colors hover:bg-slate-700/30',
                  selectedSampleId === sample.id && 'bg-blue-500/10 border-l-2 border-l-blue-500'
                )}
                onClick={() => highlightSample(sample.id)}
              >
                <td className="table-cell font-mono text-xs text-slate-300">
                  {formatTime(sample.timestamp)}
                </td>
                <td className="table-cell font-mono text-xs text-blue-400">
                  {formatSpeed(sample.speed)}
                </td>
                <td className="table-cell font-mono text-xs text-emerald-400">
                  {formatTorque(sample.torque)}
                </td>
                <td className="table-cell font-mono text-xs">
                  <span className={cn(
                    sample.temperature > 130 ? 'text-red-400' : 'text-slate-300'
                  )}>
                    {formatTemperature(sample.temperature)}
                  </span>
                </td>
                <td className="table-cell font-mono text-xs text-amber-400">
                  {formatLoadLevel(sample.loadLevel)}
                </td>
                <td className="table-cell">
                  <StatusBadge type="alignment" value={sample.alignmentStatus} />
                </td>
                <td className="table-cell">
                  <StatusBadge type="source" value="direct" />
                </td>
                <td className="table-cell">
                  {sample.anomalyIds.length > 0 ? (
                    <span className="text-xs text-red-400 font-medium">
                      {sample.anomalyIds.length} 个
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">-</span>
                  )}
                </td>
                <td className="table-cell text-right">
                  <button
                    className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetail?.(sample);
                    }}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    className="p-1 text-slate-400 hover:text-emerald-400 transition-colors ml-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      highlightSample(sample.id);
                    }}
                  >
                    <ZoomIn size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
