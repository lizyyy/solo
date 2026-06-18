import { Search, Filter, RotateCcw } from 'lucide-react';
import { useReportStore } from '@/store/reportStore';
import type { DataSource, AnomalyType, SedimentLevel } from '@/types';

const sourceOptions: { value: DataSource; label: string }[] = [
  { value: 'buoy', label: '浮标数据' },
  { value: 'remoteSensing', label: '遥感数据' },
];

const anomalyOptions: { value: AnomalyType; label: string }[] = [
  { value: 'none', label: '正常记录' },
  { value: 'cloudCover', label: '云遮挡' },
  { value: 'missingData', label: '数据缺失' },
];

const levelOptions: { value: SedimentLevel; label: string }[] = [
  { value: 'normal', label: '正常' },
  { value: 'mild', label: '轻度' },
  { value: 'moderate', label: '中度' },
  { value: 'severe', label: '严重' },
];

export default function FilterPanel() {
  const { filter, setFilter, resetFilter } = useReportStore();

  const toggleSource = (source: DataSource) => {
    const current = filter.dataSources;
    const next = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source];
    setFilter({ dataSources: next });
  };

  const toggleAnomaly = (type: AnomalyType) => {
    const current = filter.anomalyTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setFilter({ anomalyTypes: next });
  };

  const toggleLevel = (level: SedimentLevel) => {
    const current = filter.sedimentLevels;
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    setFilter({ sedimentLevels: next });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <Filter size={16} />
          <span>筛选条件</span>
        </div>
        <button
          onClick={resetFilter}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-ocean-600 transition-colors"
        >
          <RotateCcw size={14} />
          重置
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-2">关键词搜索</label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={filter.keyword}
              onChange={(e) => setFilter({ keyword: e.target.value })}
              placeholder="搜索ID、备注..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-2">数据来源</label>
          <div className="flex flex-wrap gap-2">
            {sourceOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleSource(opt.value)}
                className={`px-3 py-1 text-sm rounded border transition-colors ${
                  filter.dataSources.includes(opt.value)
                    ? 'bg-ocean-100 text-ocean-700 border-ocean-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-2">异常类型</label>
          <div className="flex flex-wrap gap-2">
            {anomalyOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleAnomaly(opt.value)}
                className={`px-3 py-1 text-sm rounded border transition-colors ${
                  filter.anomalyTypes.includes(opt.value)
                    ? 'bg-warning-100 text-warning-700 border-warning-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-2">淤积等级</label>
          <div className="flex flex-wrap gap-2">
            {levelOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleLevel(opt.value)}
                className={`px-3 py-1 text-sm rounded border transition-colors ${
                  filter.sedimentLevels.includes(opt.value)
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
