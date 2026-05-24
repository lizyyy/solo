import { useState } from 'react';
import { Layers, BarChart3, Filter, CheckSquare, Square } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import { useTimeStore } from '../../store/useTimeStore';

type TabType = 'components' | 'statistics' | 'filter';

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'components', label: '组件', icon: <Layers className="w-4 h-4" /> },
  { id: 'filter', label: '筛选', icon: <Filter className="w-4 h-4" /> },
  { id: 'statistics', label: '统计', icon: <BarChart3 className="w-4 h-4" /> },
];

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('components');
  const {
    components,
    selectedComponents,
    filter,
    toggleComponentSelection,
    selectAllComponents,
    deselectAllComponents,
    setFilter,
    getFilteredComponents,
    getComponentGroups,
  } = useSceneStore();
  const { month } = useTimeStore();

  const filteredComponents = getFilteredComponents();
  const groups = getComponentGroups();

  const getShadowRateColor = (rate: number) => {
    if (rate < 10) return 'text-green-400';
    if (rate < 25) return 'text-yellow-400';
    if (rate < 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const handleGroupFilter = (group: string) => {
    const newGroups = filter.groups.includes(group)
      ? filter.groups.filter((g) => g !== group)
      : [...filter.groups, group];
    setFilter({ ...filter, groups: newGroups });
  };

  return (
    <div className="w-80 bg-gray-900/90 backdrop-blur-md border-l border-gray-700 flex flex-col h-full">
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-3 text-sm transition-colors ${
              activeTab === tab.id
                ? 'text-teal-400 border-b-2 border-teal-400 bg-teal-400/10'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'components' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">
                共 {components.length} 个组件
                {filter.groups.length > 0 && ` (筛选 ${filteredComponents.length} 个)`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllComponents}
                  className="text-xs text-teal-400 hover:text-teal-300"
                >
                  全选
                </button>
                <button
                  onClick={deselectAllComponents}
                  className="text-xs text-gray-400 hover:text-gray-300"
                >
                  取消
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {filteredComponents.map((comp) => (
                <div
                  key={comp.id}
                  onClick={() => toggleComponentSelection(comp.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedComponents.includes(comp.id)
                      ? 'bg-teal-600/30 border border-teal-500'
                      : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {selectedComponents.includes(comp.id) ? (
                      <CheckSquare className="w-4 h-4 text-teal-400" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="text-white text-sm font-medium flex-1">
                      {comp.name}
                    </span>
                    <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-700 rounded">
                      {comp.group}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-gray-400 text-xs">遮挡率</span>
                    <span
                      className={`font-mono text-sm ${getShadowRateColor(
                        comp.shadowStats.shadowRate
                      )}`}
                    >
                      {comp.shadowStats.shadowRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        comp.shadowStats.shadowRate < 25
                          ? 'bg-green-500'
                          : comp.shadowStats.shadowRate < 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${comp.shadowStats.shadowRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'filter' && (
          <div className="p-4 space-y-6">
            <div>
              <h4 className="text-white font-medium mb-3">按分组筛选</h4>
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <button
                    key={group}
                    onClick={() => handleGroupFilter(group)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      filter.groups.includes(group)
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
              {filter.groups.length > 0 && (
                <button
                  onClick={() => setFilter({ ...filter, groups: [] })}
                  className="mt-3 text-xs text-gray-400 hover:text-gray-300"
                >
                  清除分组筛选
                </button>
              )}
            </div>

            <div>
              <h4 className="text-white font-medium mb-3">遮挡率范围</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>最低: {filter.shadowRateMin}%</span>
                    <span>最高: {filter.shadowRateMax}%</span>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filter.shadowRateMin}
                      onChange={(e) =>
                        setFilter({
                          ...filter,
                          shadowRateMin: Math.min(
                            parseInt(e.target.value),
                            filter.shadowRateMax
                          ),
                        })
                      }
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filter.shadowRateMax}
                      onChange={(e) =>
                        setFilter({
                          ...filter,
                          shadowRateMax: Math.max(
                            parseInt(e.target.value),
                            filter.shadowRateMin
                          ),
                        })
                      }
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <div className="text-gray-400 text-sm mb-2">筛选结果</div>
              <div className="text-2xl font-bold text-teal-400">
                {filteredComponents.length}
                <span className="text-gray-500 text-sm font-normal ml-2">
                  / {components.length} 个组件
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="p-4 space-y-6">
            <div>
              <h4 className="text-white font-medium mb-3">总体统计</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-gray-400 text-xs">组件总数</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {components.length}
                  </div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-gray-400 text-xs">已选组件</div>
                  <div className="text-xl font-bold text-teal-400 mt-1">
                    {selectedComponents.length}
                  </div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-gray-400 text-xs">平均遮挡率</div>
                  <div className="text-xl font-bold text-orange-400 mt-1">
                    {components.length > 0
                      ? (
                          components.reduce(
                            (sum, c) => sum + c.shadowStats.shadowRate,
                            0
                          ) / components.length
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-gray-400 text-xs">总遮挡时长</div>
                  <div className="text-xl font-bold text-yellow-400 mt-1">
                    {components.length > 0
                      ? (
                          components.reduce(
                            (sum, c) => sum + c.shadowStats.shadowHours,
                            0
                          ) / components.length
                        ).toFixed(1)
                      : 0}
                    h
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-white font-medium mb-3">
                {month}月遮挡排行
              </h4>
              <div className="space-y-2">
                {[...components]
                  .sort(
                    (a, b) =>
                      b.shadowStats.shadowRate - a.shadowStats.shadowRate
                  )
                  .slice(0, 5)
                  .map((comp, index) => (
                    <div
                      key={comp.id}
                      className="flex items-center gap-3 p-2 bg-gray-800 rounded"
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0
                            ? 'bg-yellow-500 text-black'
                            : index === 1
                            ? 'bg-gray-400 text-black'
                            : index === 2
                            ? 'bg-orange-700 text-white'
                            : 'bg-gray-600 text-gray-300'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-white text-sm flex-1">
                        {comp.name}
                      </span>
                      <span
                        className={`font-mono text-sm ${getShadowRateColor(
                          comp.shadowStats.shadowRate
                        )}`}
                      >
                        {comp.shadowStats.shadowRate.toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-medium mb-3">分组统计</h4>
              <div className="space-y-3">
                {groups.map((group) => {
                  const groupComponents = components.filter(
                    (c) => c.group === group
                  );
                  const avgShadowRate =
                    groupComponents.reduce(
                      (sum, c) => sum + c.shadowStats.shadowRate,
                      0
                    ) / groupComponents.length;
                  return (
                    <div key={group} className="p-3 bg-gray-800 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white text-sm font-medium">
                          {group}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {groupComponents.length} 个组件
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              avgShadowRate < 25
                                ? 'bg-green-500'
                                : avgShadowRate < 50
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${avgShadowRate}%` }}
                          />
                        </div>
                        <span
                          className={`text-sm font-mono ${getShadowRateColor(
                            avgShadowRate
                          )}`}
                        >
                          {avgShadowRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
