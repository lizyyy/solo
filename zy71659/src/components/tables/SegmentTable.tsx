import React from 'react';
import { Eye, ZoomIn } from 'lucide-react';
import { OperationSegment } from '@/types/segments';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatTime, formatDuration, formatTorque, formatSpeed, formatTemperature, formatLoadLevel } from '@/utils/formatters';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

interface SegmentTableProps {
  segments: OperationSegment[];
  onViewDetail?: (segment: OperationSegment) => void;
}

export const SegmentTable: React.FC<SegmentTableProps> = ({ segments, onViewDetail }) => {
  const { selectedSegmentId, setSelectedSegmentId, highlightAnomaly } = useAppStore();

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <span className="text-sm font-medium text-slate-200">工况段划分</span>
        <span className="text-xs text-slate-500">共 {segments.length} 个工况段</span>
      </div>
      <div className="overflow-x-auto max-h-80 scrollbar-thin">
        <table className="w-full">
          <thead className="table-header sticky top-0">
            <tr>
              <th className="table-cell text-left">负载档</th>
              <th className="table-cell text-left">开始时间</th>
              <th className="table-cell text-left">结束时间</th>
              <th className="table-cell text-left">持续时间</th>
              <th className="table-cell text-left">平均转速</th>
              <th className="table-cell text-left">平均扭矩</th>
              <th className="table-cell text-left">最大扭矩</th>
              <th className="table-cell text-left">最高温度</th>
              <th className="table-cell text-left">采样数</th>
              <th className="table-cell text-left">状态</th>
              <th className="table-cell text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr
                key={segment.id}
                className={cn(
                  'transition-colors hover:bg-slate-700/30 cursor-pointer',
                  selectedSegmentId === segment.id && 'bg-blue-500/10 border-l-2 border-l-blue-500'
                )}
                onClick={() => setSelectedSegmentId(segment.id)}
              >
                <td className="table-cell font-mono text-xs text-amber-400">
                  {formatLoadLevel(segment.loadLevel)}
                </td>
                <td className="table-cell font-mono text-xs text-slate-300">
                  {formatTime(segment.startTime)}
                </td>
                <td className="table-cell font-mono text-xs text-slate-300">
                  {formatTime(segment.endTime)}
                </td>
                <td className="table-cell font-mono text-xs text-slate-400">
                  {formatDuration(segment.endTime - segment.startTime)}
                </td>
                <td className="table-cell font-mono text-xs text-blue-400">
                  {formatSpeed(segment.avgSpeed)}
                </td>
                <td className="table-cell font-mono text-xs text-emerald-400">
                  {formatTorque(segment.avgTorque)}
                </td>
                <td className="table-cell font-mono text-xs text-emerald-300">
                  {formatTorque(segment.maxTorque)}
                </td>
                <td className="table-cell font-mono text-xs">
                  <span className={cn(
                    segment.maxTemperature > 130 ? 'text-red-400' : 'text-slate-300'
                  )}>
                    {formatTemperature(segment.maxTemperature)}
                  </span>
                </td>
                <td className="table-cell font-mono text-xs text-slate-400">
                  {segment.sampleCount}
                </td>
                <td className="table-cell">
                  {segment.hasAnomaly ? (
                    <span className="text-xs text-red-400 font-medium">含异常</span>
                  ) : (
                    <span className="text-xs text-emerald-400">正常</span>
                  )}
                </td>
                <td className="table-cell text-right">
                  <button
                    className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetail?.(segment);
                    }}
                  >
                    <Eye size={14} />
                  </button>
                  {segment.anomalyIds.length > 0 && (
                    <button
                      className="p-1 text-slate-400 hover:text-red-400 transition-colors ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        highlightAnomaly(segment.anomalyIds[0]);
                      }}
                    >
                      <ZoomIn size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
