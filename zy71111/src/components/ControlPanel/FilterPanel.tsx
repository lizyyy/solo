
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useState } from 'react';
import { CrackLevel, RecheckStatus } from '../../types';
import { useInspectionStore } from '../../store/useInspectionStore';
import { cn } from '../../lib/utils';

const levelLabels: Record<CrackLevel, string> = {
  [CrackLevel.LIGHT]: '轻微',
  [CrackLevel.MODERATE]: '中等',
  [CrackLevel.SEVERE]: '严重',
};

const levelColors: Record<CrackLevel, string> = {
  [CrackLevel.LIGHT]: 'bg-green-500',
  [CrackLevel.MODERATE]: 'bg-orange-500',
  [CrackLevel.SEVERE]: 'bg-red-500',
};

const statusLabels: Record<RecheckStatus, string> = {
  [RecheckStatus.PENDING]: '待复检',
  [RecheckStatus.VERIFIED]: '已确认',
  [RecheckStatus.RESOLVED]: '已修复',
};

const statusColors: Record<RecheckStatus, string> = {
  [RecheckStatus.PENDING]: 'bg-yellow-500',
  [RecheckStatus.VERIFIED]: 'bg-cyan-500',
  [RecheckStatus.RESOLVED]: 'bg-green-500',
};

export function FilterPanel() {
  const [levelExpanded, setLevelExpanded] = useState(true);
  const [statusExpanded, setStatusExpanded] = useState(true);
  const [timeExpanded, setTimeExpanded] = useState(true);

  const filterLevel = useInspectionStore((state) => state.filterLevel);
  const filterStatus = useInspectionStore((state) => state.filterStatus);
  const timeRange = useInspectionStore((state) => state.timeRange);
  const inspectionData = useInspectionStore((state) => state.inspectionData);
  const setFilterLevel = useInspectionStore((state) => state.setFilterLevel);
  const setFilterStatus = useInspectionStore((state) => state.setFilterStatus);
  const setTimeRange = useInspectionStore((state) => state.setTimeRange);

  const toggleLevel = (level: CrackLevel) => {
    if (filterLevel.includes(level)) {
      setFilterLevel(filterLevel.filter((l) => l !== level));
    } else {
      setFilterLevel([...filterLevel, level]);
    }
  };

  const toggleStatus = (status: RecheckStatus) => {
    if (filterStatus.includes(status)) {
      setFilterStatus(filterStatus.filter((s) => s !== status));
    } else {
      setFilterStatus([...filterStatus, status]);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!inspectionData) return;
    const timeStr = e.target.value;
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const baseDate = new Date(inspectionData.startTime);
    baseDate.setHours(hours, minutes, seconds, 0);
    const newStartTime = baseDate.getTime();
    if (newStartTime <= timeRange[1]) {
      setTimeRange([newStartTime, timeRange[1]]);
    }
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!inspectionData) return;
    const timeStr = e.target.value;
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const baseDate = new Date(inspectionData.endTime);
    baseDate.setHours(hours, minutes, seconds, 0);
    const newEndTime = baseDate.getTime();
    if (newEndTime >= timeRange[0]) {
      setTimeRange([timeRange[0], newEndTime]);
    }
  };

  const timeToInputValue = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      <div className="bg-slate-800/50 rounded-lg overflow-hidden">
        <button
          onClick={() => setTimeExpanded(!timeExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-200">时间范围</span>
          </div>
          {timeExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {timeExpanded && inspectionData && (
          <div className="px-3 pb-3 space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-slate-400">开始时间</label>
              <input
                type="time"
                step="1"
                value={timeToInputValue(timeRange[0])}
                onChange={handleStartTimeChange}
                min={timeToInputValue(inspectionData.startTime)}
                max={timeToInputValue(timeRange[1])}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400">结束时间</label>
              <input
                type="time"
                step="1"
                value={timeToInputValue(timeRange[1])}
                onChange={handleEndTimeChange}
                min={timeToInputValue(timeRange[0])}
                max={timeToInputValue(inspectionData.endTime)}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-md text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="text-xs text-slate-500 text-center">
              {formatTime(timeRange[0])} - {formatTime(timeRange[1])}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-lg overflow-hidden">
        <button
          onClick={() => setLevelExpanded(!levelExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-slate-700/50 transition-colors"
        >
          <span className="text-sm font-medium text-slate-200">裂纹等级</span>
          {levelExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {levelExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {Object.values(CrackLevel).map((level) => (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all',
                  filterLevel.includes(level)
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900/50 text-slate-400 hover:bg-slate-700/50'
                )}
              >
                <span className={cn('w-3 h-3 rounded-full', levelColors[level])} />
                {levelLabels[level]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-lg overflow-hidden">
        <button
          onClick={() => setStatusExpanded(!statusExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-slate-700/50 transition-colors"
        >
          <span className="text-sm font-medium text-slate-200">复检状态</span>
          {statusExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {statusExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {Object.values(RecheckStatus).map((status) => (
              <button
                key={status}
                onClick={() => toggleStatus(status)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all',
                  filterStatus.includes(status)
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900/50 text-slate-400 hover:bg-slate-700/50'
                )}
              >
                <span className={cn('w-3 h-3 rounded-full', statusColors[status])} />
                {statusLabels[status]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
