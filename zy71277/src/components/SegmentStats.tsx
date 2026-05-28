import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SegmentStat } from '../../shared/types';

interface SegmentStatsProps {
  segments: SegmentStat[];
  threshold?: number;
  onViewDetails?: (segment: SegmentStat) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function MiniBarChart({ value, maxValue }: { value: number; maxValue: number }) {
  const percentage = Math.min((Math.abs(value) / maxValue) * 100, 100);
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-3 bg-gray-200 rounded-full overflow-hidden relative">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isPositive ? 'bg-blue-500' : 'bg-orange-500'
          )}
          style={{
            width: `${percentage}%`,
            marginLeft: isPositive ? '50%' : `${50 - percentage}%`,
          }}
        />
        <div className="absolute top-0 left-1/2 w-px h-full bg-gray-400" />
      </div>
      <span className="text-sm font-mono">{value.toFixed(2)}ms</span>
    </div>
  );
}

export default function SegmentStats({
  segments,
  threshold = 50,
  onViewDetails,
}: SegmentStatsProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const maxDrift = Math.max(
    ...segments.map((s) => Math.max(Math.abs(s.meanDrift), Math.abs(s.maxDrift))),
    1
  );

  const toggleRow = (segmentId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  };

  const isOverThreshold = (segment: SegmentStat) => {
    return Math.abs(segment.meanDrift) > threshold || Math.abs(segment.maxDrift) > threshold;
  };

  if (segments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无分段统计数据
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="w-10 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              分段名称
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              开始时间
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              结束时间
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              平均漂移
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              方差
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              最大漂移
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              节拍数
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {segments.map((segment) => {
            const isExpanded = expandedRows.has(segment.segmentId);
            const overThreshold = isOverThreshold(segment);

            return (
              <>
                <tr
                  key={segment.segmentId}
                  className={cn(
                    'transition-colors',
                    overThreshold && 'bg-red-50 hover:bg-red-100',
                    !overThreshold && 'hover:bg-gray-50'
                  )}
                >
                  <td className="px-3 py-3">
                    <button
                      onClick={() => toggleRow(segment.segmentId)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900">
                    {segment.label}
                    {overThreshold && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        超过阈值
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500 font-mono">
                    {formatTime(segment.startMs)}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500 font-mono">
                    {formatTime(segment.endMs)}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500">
                    <MiniBarChart value={segment.meanDrift} maxValue={maxDrift} />
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500 font-mono">
                    {segment.variance.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-3 text-sm font-mono',
                      Math.abs(segment.maxDrift) > threshold
                        ? 'text-red-600 font-medium'
                        : 'text-gray-500'
                    )}
                  >
                    {segment.maxDrift.toFixed(2)}ms
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500">
                    {segment.beatCount}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <button
                      onClick={() => onViewDetails?.(segment)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Info className="w-4 h-4" />
                      查看详情
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                              计算审计信息
                            </h4>
                            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">sumDrift</span>
                                <span className="text-sm font-mono text-gray-900">
                                  {segment.calculationDetail.sumDrift.toFixed(4)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">sumDriftSquared</span>
                                <span className="text-sm font-mono text-gray-900">
                                  {segment.calculationDetail.sumDriftSquared.toFixed(4)}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-gray-100">
                                <span className="text-sm text-gray-600 block mb-1">formulaMean</span>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
                                  {segment.calculationDetail.formulaMean}
                                </code>
                              </div>
                              <div>
                                <span className="text-sm text-gray-600 block mb-1">formulaVariance</span>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
                                  {segment.calculationDetail.formulaVariance}
                                </code>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
