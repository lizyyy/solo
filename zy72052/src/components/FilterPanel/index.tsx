import { useAppStore } from '@/store/useAppStore';
import { FilterCriteria, PointType, PointStatus, SchemeVersion } from '@/types';
import { Filter, RotateCcw } from 'lucide-react';

const TYPE_OPTIONS: { value: PointType; label: string }[] = [
  { value: 'reflection-chamber', label: '声线反射舱' },
  { value: 'microphone', label: '麦克风' },
  { value: 'speaker', label: '音箱' },
  { value: 'boundary', label: '边界点' },
];

const STATUS_OPTIONS: { value: PointStatus; label: string }[] = [
  { value: 'normal', label: '正常' },
  { value: 'warning', label: '注意' },
  { value: 'error', label: '冲突' },
  { value: 'empty', label: '坐标缺失' },
  { value: 'duplicate', label: '重复记录' },
  { value: 'boundary', label: '边界记录' },
];

const SCHEME_OPTIONS: { value: SchemeVersion; label: string }[] = [
  { value: 'v1', label: 'V1方案' },
  { value: 'v2', label: 'V2方案' },
];

function ToggleChip<T extends string>({
  value,
  label,
  selected,
  onToggle,
}: {
  value: T;
  label: string;
  selected: boolean;
  onToggle: (v: T) => void;
}) {
  return (
    <button
      onClick={() => onToggle(value)}
      className={`px-2 py-1 text-xs rounded-md border transition-all duration-200 ${
        selected
          ? 'bg-amber-600/30 text-amber-300 border-amber-600/50 shadow-sm shadow-amber-600/20'
          : 'bg-slate-800/50 text-slate-400 border-slate-600/30 hover:border-slate-500/50'
      }`}
    >
      {label}
    </button>
  );
}

export function FilterPanel() {
  const criteria = useAppStore(s => s.filterCriteria);
  const setFilterCriteria = useAppStore(s => s.setFilterCriteria);
  const currentDate = useAppStore(s => s.currentDate);
  const filteredCount = useAppStore(s => s.filteredPoints.length);
  const totalCount = useAppStore(s => s.points.length);

  const toggleType = (type: PointType) => {
    const types = criteria.types.includes(type)
      ? criteria.types.filter(t => t !== type)
      : [...criteria.types, type];
    setFilterCriteria({ ...criteria, types });
  };

  const toggleStatus = (status: PointStatus) => {
    const statuses = criteria.statuses.includes(status)
      ? criteria.statuses.filter(s => s !== status)
      : [...criteria.statuses, status];
    setFilterCriteria({ ...criteria, statuses });
  };

  const toggleScheme = (version: SchemeVersion) => {
    const schemeVersions = criteria.schemeVersions.includes(version)
      ? criteria.schemeVersions.filter(v => v !== version)
      : [...criteria.schemeVersions, version];
    setFilterCriteria({ ...criteria, schemeVersions });
  };

  const resetFilters = () => {
    setFilterCriteria({
      types: [],
      statuses: [],
      schemeVersions: [],
      dateRange: [currentDate, currentDate],
      onlyReflectionChambers: false,
      onlyAnomalies: false,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <Filter size={14} />
          <span className="text-sm font-medium">筛选条件</span>
        </div>
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RotateCcw size={12} />
          重置
        </button>
      </div>

      <div className="text-xs text-slate-500">
        显示 {filteredCount} / {totalCount} 个点位
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-medium">点位类型</div>
        <div className="flex flex-wrap gap-1">
          {TYPE_OPTIONS.map(opt => (
            <ToggleChip
              key={opt.value}
              value={opt.value}
              label={opt.label}
              selected={criteria.types.includes(opt.value)}
              onToggle={toggleType}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-medium">状态</div>
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map(opt => (
            <ToggleChip
              key={opt.value}
              value={opt.value}
              label={opt.label}
              selected={criteria.statuses.includes(opt.value)}
              onToggle={toggleStatus}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-400 font-medium">方案版本</div>
        <div className="flex flex-wrap gap-1">
          {SCHEME_OPTIONS.map(opt => (
            <ToggleChip
              key={opt.value}
              value={opt.value}
              label={opt.label}
              selected={criteria.schemeVersions.includes(opt.value)}
              onToggle={toggleScheme}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2 pt-1 border-t border-slate-700/50">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={criteria.onlyReflectionChambers}
            onChange={e =>
              setFilterCriteria({ ...criteria, onlyReflectionChambers: e.target.checked })
            }
            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
          />
          <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
            仅声线反射舱
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={criteria.onlyAnomalies}
            onChange={e =>
              setFilterCriteria({ ...criteria, onlyAnomalies: e.target.checked })
            }
            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/30"
          />
          <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
            仅异常项
          </span>
        </label>
      </div>
    </div>
  );
}
