
import { ChevronDown, ChevronUp } from 'lucide-react';
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

  const filterLevel = useInspectionStore((state) => state.filterLevel);
  const filterStatus = useInspectionStore((state) => state.filterStatus);
  const setFilterLevel = useInspectionStore((state) => state.setFilterLevel);
  const setFilterStatus = useInspectionStore((state) => state.setFilterStatus);

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

  return (
    <div className="space-y-3">
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
