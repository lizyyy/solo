import { useState } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { Search, ClipboardList, AlertTriangle, Copy, CheckCircle } from 'lucide-react';

export default function ThresholdsPage() {
  const { thresholds } = useScheduleStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [materialTypeFilter, setMaterialTypeFilter] = useState<string>('all');

  const materialTypes = Array.from(new Set(thresholds.map((t) => t.materialType)));

  const filteredThresholds = thresholds.filter((th) => {
    const matchesSearch =
      th.materialType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      th.parameter.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      materialTypeFilter === 'all' || th.materialType === materialTypeFilter;
    return matchesSearch && matchesType;
  });

  const groupedByMaterial = filteredThresholds.reduce((acc, th) => {
    if (!acc[th.materialType]) {
      acc[th.materialType] = [];
    }
    acc[th.materialType].push(th);
    return acc;
  }, {} as Record<string, typeof thresholds>);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-bold text-industrial-900 mb-2">
            阈值表管理
          </h1>
          <p className="text-industrial-500 text-sm">
            查看和管理各类材料的试验参数阈值配置，支持重复检测
          </p>
        </div>

        {thresholds.some((t) => t.isDuplicate) && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                检测到重复阈值表条目
              </p>
              <p className="text-xs text-amber-700 mt-1">
                系统已自动检测到重复的阈值配置，排程时会自动去重使用最新版本。
                请检查并清理重复条目。
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-industrial-400" />
            <input
              type="text"
              placeholder="搜索材料类型、参数名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-industrial-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={materialTypeFilter}
            onChange={(e) => setMaterialTypeFilter(e.target.value)}
            className="px-3 py-2 border border-industrial-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">全部材料</option>
            {materialTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-8">
          {Object.entries(groupedByMaterial).map(([materialType, items]) => (
            <div key={materialType}>
              <h2 className="text-lg font-semibold text-industrial-900 mb-4 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary-600" />
                {materialType}
                <span className="text-sm font-normal text-industrial-400">
                  ({items.filter((t) => !t.isDuplicate).length} 个有效参数)
                </span>
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {items.map((th) => (
                  <div
                    key={th.id}
                    className={`bg-white border p-5 shadow-industrial transition-all ${
                      th.isDuplicate
                        ? 'border-amber-300 bg-amber-50/30 opacity-70'
                        : 'border-industrial-200 hover:shadow-industrial-lg'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {th.isDuplicate ? (
                          <Copy className="w-4 h-4 text-amber-600" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        <span className="font-semibold text-industrial-900">
                          {th.parameter}
                        </span>
                      </div>
                      {th.isDuplicate && (
                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700">
                          重复 v{th.version}
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <div className="font-mono text-2xl font-bold text-industrial-900">
                        [{th.minValue}, {th.maxValue}]
                      </div>
                      <div className="text-sm text-industrial-500 mt-1">
                        单位: {th.unit}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-industrial-500 pt-3 border-t border-industrial-200">
                      <span>版本: v{th.version}</span>
                      {th.isDuplicate && th.duplicateOf && (
                        <span className="text-amber-600">
                          重复于: {th.duplicateOf}
                        </span>
                      )}
                    </div>

                    {th.isDuplicate && (
                      <div className="mt-3 p-2 bg-amber-100/50 text-xs text-amber-700">
                        此阈值为重复条目，排程时将自动忽略
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
