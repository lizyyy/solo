import { useState, useRef } from 'react';
import {
  Search,
  Filter,
  Upload,
  RefreshCw,
  FolderOpen,
  Layers,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { sampleScenarios } from '../../data/sampleData';
import { Container, Yard } from '../../types';

export function LeftPanel() {
  const {
    yard,
    containers,
    filter,
    setFilter,
    loadScenario,
    resetState,
    importCustomData,
    selectedContainerId,
    selectContainer,
    analyzeTargetContainer,
  } = useStore();

  const [showScenarios, setShowScenarios] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [showContainerList, setShowContainerList] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredContainers = containers.filter((c) => {
    if (filter.bay !== null && c.bay !== filter.bay) {
      return false;
    }
    if (filter.search) {
      return c.id.toLowerCase().includes(filter.search.toLowerCase());
    }
    return true;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.yard && data.containers) {
          importCustomData(data.yard as Yard, data.containers as Container[]);
        }
      } catch (err) {
        console.error('Failed to import data:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleContainerClick = (containerId: string) => {
    selectContainer(containerId);
    analyzeTargetContainer(containerId);
  };

  return (
    <div className="w-80 bg-gray-900/95 backdrop-blur-sm border-r border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-400" />
          港口箱堆可达性分析
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {yard?.name || 'A区堆场'} | 共 {containers.length} 个集装箱
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-gray-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowScenarios(!showScenarios)}
            className="w-full p-3 flex items-center justify-between text-white hover:bg-gray-700/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-yellow-400" />
              样例场景
            </span>
            {showScenarios ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showScenarios && (
            <div className="px-3 pb-3 space-y-2">
              {sampleScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => loadScenario(scenario.id)}
                  className="w-full p-3 text-left bg-gray-700/50 hover:bg-gray-600/50 rounded-lg transition-colors"
                >
                  <div className="text-white text-sm font-medium">
                    {scenario.name}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    {scenario.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full p-3 flex items-center justify-between text-white hover:bg-gray-700/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-400" />
              筛选条件
            </span>
            {showFilters ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showFilters && (
            <div className="px-3 pb-3 space-y-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  搜索集装箱
                </label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={filter.search}
                    onChange={(e) =>
                      setFilter({ ...filter, search: e.target.value })
                    }
                    placeholder="输入箱号..."
                    className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  {filter.search && (
                    <button
                      onClick={() => setFilter({ ...filter, search: '' })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  箱区筛选
                </label>
                <select
                  value={filter.bay ?? ''}
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      bay: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">全部箱区</option>
                  {yard &&
                    Array.from({ length: yard.bays }).map((_, i) => (
                      <option key={i} value={i}>
                        {i + 1}区
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setFilter({ bay: null, search: '' })}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
                >
                  清除筛选
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowContainerList(!showContainerList)}
            className="w-full p-3 flex items-center justify-between text-white hover:bg-gray-700/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-green-400" />
              集装箱列表 ({filteredContainers.length})
            </span>
            {showContainerList ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showContainerList && (
            <div className="max-h-64 overflow-y-auto">
              {filteredContainers.map((container) => (
                <button
                  key={container.id}
                  onClick={() => handleContainerClick(container.id)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-700/50 transition-colors ${
                    container.id === selectedContainerId
                      ? 'bg-blue-900/50 border-l-2 border-blue-500'
                      : ''
                  }`}
                >
                  <div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: container.color }}
                    >
                      {container.id}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {container.bay + 1}区 {container.row + 1}行{' '}
                      {container.tier + 1}层
                    </div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      container.status === 'target'
                        ? 'bg-green-500'
                        : container.status === 'blocking'
                        ? 'bg-orange-500'
                        : 'bg-gray-600'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-700 space-y-2">
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center gap-2 transition-colors"
        >
          <Upload className="w-4 h-4" />
          导入数据
        </button>
        <button
          onClick={resetState}
          className="w-full py-2 px-4 bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重置状态
        </button>
      </div>
    </div>
  );
}
