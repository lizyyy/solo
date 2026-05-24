import { Filter, X, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ArtifactType } from '../../types';
import { getTypeLabel } from '../../utils/filterEngine';

const artifactTypes: ArtifactType[] = ['pottery', 'stone', 'bone', 'metal', 'other'];

export const FilterPanel = () => {
  const excavationData = useStore((state) => state.excavationData);
  const filters = useStore((state) => state.filters);
  const setFilterTypes = useStore((state) => state.setFilterTypes);
  const setFilterPeriods = useStore((state) => state.setFilterPeriods);
  const resetFilters = useStore((state) => state.resetFilters);
  const validationErrors = useStore((state) => state.validationErrors);

  if (!excavationData) return null;

  const uniquePeriods = [...new Set(excavationData.artifacts.map((a) => a.period))];

  const toggleType = (type: ArtifactType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    setFilterTypes(newTypes);
  };

  const togglePeriod = (period: string) => {
    const newPeriods = filters.periods.includes(period)
      ? filters.periods.filter((p) => p !== period)
      : [...filters.periods, period];
    setFilterPeriods(newPeriods);
  };

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.periods.length > 0 ||
    filters.depthRange[0] > 0 ||
    filters.depthRange[1] < excavationData.gridSize.z;

  return (
    <div className="w-64 bg-stone-900 border-l border-stone-700 flex flex-col h-full">
      <div className="p-4 border-b border-stone-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-200 flex items-center gap-2">
            <Filter size={20} className="text-amber-500" />
            筛选条件
          </h2>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1"
            >
              <X size={14} />
              清除
            </button>
          )}
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="p-4 border-b border-stone-700 bg-red-950">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle size={16} />
            <span className="font-medium text-sm">数据问题</span>
            <span className="text-xs bg-red-900 px-2 py-0.5 rounded">
              {validationErrors.length}
            </span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {validationErrors.slice(0, 5).map((error, index) => (
              <p key={index} className="text-xs text-red-300">
                • {error.message}
              </p>
            ))}
            {validationErrors.length > 5 && (
              <p className="text-xs text-red-400">
                还有 {validationErrors.length - 5} 个问题...
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-stone-300 mb-3">出土物类型</h3>
          <div className="grid grid-cols-2 gap-2">
            {artifactTypes.map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`px-3 py-2 rounded text-xs transition-all ${
                  filters.types.includes(type)
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200'
                }`}
              >
                {getTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-stone-300 mb-3">年代筛选</h3>
          <div className="space-y-2">
            {uniquePeriods.map((period) => (
              <button
                key={period}
                onClick={() => togglePeriod(period)}
                className={`w-full px-3 py-2 rounded text-xs text-left transition-all ${
                  filters.periods.includes(period)
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-stone-300 mb-3">统计信息</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-stone-400">
              <span>总出土物:</span>
              <span className="text-stone-200">
                {excavationData.artifacts.length} 件
              </span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>当前筛选:</span>
              <span className="text-amber-400">
                {
                  excavationData.artifacts.filter(
                    (a) =>
                      (filters.types.length === 0 ||
                        filters.types.includes(a.type)) &&
                      (filters.periods.length === 0 ||
                        filters.periods.includes(a.period)) &&
                      a.position.z >= filters.depthRange[0] &&
                      a.position.z <= filters.depthRange[1]
                  ).length
                }{' '}
                件
              </span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>总层数:</span>
              <span className="text-stone-200">
                {excavationData.layers.length} 层
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
