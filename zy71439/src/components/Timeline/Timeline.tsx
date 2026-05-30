import React, { useState } from 'react';
import { Clock, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { OperationLog, OperationType } from '../../types';
import TimelineItem from './TimelineItem';
import { useTimeline } from '../../hooks/useTimeline';

interface TimelineProps {
  operations: OperationLog[];
  title?: string;
  maxVisible?: number;
}

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: OperationType.BEARING_INPUT, label: '方位角输入' },
  { value: OperationType.BEARING_MODIFY, label: '方位角修改' },
  { value: OperationType.POSITION_MARK, label: '位置标注' },
  { value: OperationType.ROUTE_SELECT, label: '路线选择' },
  { value: OperationType.UNIT_ERROR_DETECTED, label: '错误记录' }
];

export const Timeline: React.FC<TimelineProps> = ({
  operations,
  title = '操作时间线',
  maxVisible = 10
}) => {
  const [filter, setFilter] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const { groupedOperations, hasUnitErrors, totalOperations } = useTimeline(operations);

  const filteredOperations = React.useMemo(() => {
    if (filter === 'all') return operations;
    return operations.filter(op => op.actionType === filter);
  }, [operations, filter]);

  const visibleOperations = React.useMemo(() => {
    if (showAll) return filteredOperations;
    return filteredOperations.slice(0, maxVisible);
  }, [filteredOperations, showAll, maxVisible]);

  const hasMore = filteredOperations.length > maxVisible;

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
            <Clock size={16} className="text-slate-300" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>共 {totalOperations} 条记录</span>
              {hasUnitErrors && (
                <span className="text-red-400">⚠️ 含错误记录</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="relative"
          >
            <Filter size={16} className="text-slate-400 hover:text-white transition-colors" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            >
              {FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </button>
          {isExpanded ? (
            <ChevronUp size={20} className="text-slate-400" />
          ) : (
            <ChevronDown size={20} className="text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="px-4 pb-4 max-h-[500px] overflow-y-auto">
            {visibleOperations.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                暂无操作记录
              </div>
            ) : (
              visibleOperations.map((op, index) => (
                <TimelineItem
                  key={op.id}
                  operation={op}
                  isFirst={index === 0}
                  isLast={index === visibleOperations.length - 1}
                />
              ))
            )}

            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-white transition-colors border-t border-slate-700 pt-4"
              >
                {showAll
                  ? `收起（共 ${filteredOperations.length} 条）`
                  : `查看更多（还有 ${filteredOperations.length - maxVisible} 条）`
                }
              </button>
            )}
          </div>

          {groupedOperations.length > 1 && (
            <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
              <div className="text-xs text-slate-400">
                按日期分组：
                {groupedOperations.map((group, i) => (
                  <span key={i} className="ml-2 text-slate-300">
                    {group.date} ({group.items.length}条)
                    {i < groupedOperations.length - 1 && ' ·'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Timeline;
