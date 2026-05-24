import { useAppStore } from '../../store/useAppStore';
import { TrendingUp, Construction, ArrowUpDown, Eye, EyeOff } from 'lucide-react';

export const FilterPanel = () => {
  const { filters, setFilters } = useAppStore();

  const Toggle = ({
    label,
    checked,
    onChange,
    icon: Icon,
  }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon: React.ElementType;
  }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? 'bg-blue-500' : 'bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            最大坡度限制: {filters.maxSlope}%
          </label>
          <input
            type="range"
            min="1"
            max="15"
            value={filters.maxSlope}
            onChange={(e) => setFilters({ maxSlope: Number(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1%</span>
            <span>8% (推荐)</span>
            <span>15%</span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-gray-400">规划偏好</p>
          <div className="space-y-3">
            <Toggle
              label="避让施工区域"
              checked={filters.avoidConstruction}
              onChange={(v) => setFilters({ avoidConstruction: v })}
              icon={Construction}
            />
            <Toggle
              label="优先使用电梯"
              checked={filters.preferElevator}
              onChange={(v) => setFilters({ preferElevator: v })}
              icon={ArrowUpDown}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700/50 pt-3 space-y-2">
        <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          显示选项
        </p>
        <div className="space-y-3">
          <Toggle
            label="显示坡道"
            checked={filters.showRamps}
            onChange={(v) => setFilters({ showRamps: v })}
            icon={TrendingUp}
          />
          <Toggle
            label="显示电梯"
            checked={filters.showElevators}
            onChange={(v) => setFilters({ showElevators: v })}
            icon={ArrowUpDown}
          />
          <Toggle
            label="显示施工围挡"
            checked={filters.showConstructions}
            onChange={(v) => setFilters({ showConstructions: v })}
            icon={Construction}
          />
        </div>
      </div>
    </div>
  );
};
