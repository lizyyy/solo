import { useState } from 'react';
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw, Eye, Sun, DollarSign } from 'lucide-react';
import { useFilterStore } from '../../store/useFilterStore';
import { ANOMALY_LABELS, STATUS_LABELS } from '../../types';

export function FilterPanel() {
  const {
    criteria,
    toggleStatus,
    toggleAnomaly,
    setSearchText,
    setTransparencyRange,
    setLightfastnessRange,
    setCostRange,
    resetFilters,
  } = useFilterStore();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    search: true,
    transparency: true,
    lightfastness: true,
    cost: true,
    status: true,
    anomalies: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const statusOptions = [
    { value: 'processed', label: STATUS_LABELS.processed, color: 'bg-emerald-500' },
    { value: 'pending', label: STATUS_LABELS.pending, color: 'bg-amber-500' },
    { value: 'rejected', label: STATUS_LABELS.rejected, color: 'bg-red-500' },
  ];

  const anomalyOptions = [
    { value: 'ratio_incomplete', label: ANOMALY_LABELS.ratio_incomplete },
    { value: 'lightfastness_missing', label: ANOMALY_LABELS.lightfastness_missing },
    { value: 'cost_abnormal', label: ANOMALY_LABELS.cost_abnormal },
    { value: 'data_missing', label: ANOMALY_LABELS.data_missing },
  ];

  return (
    <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-slate-400" />
            <h2 className="font-semibold text-white">筛选条件</h2>
          </div>
          <button
            onClick={resetFilters}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            title="重置筛选"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <button
            onClick={() => toggleSection('search')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white"
          >
            <span>搜索</span>
            {expandedSections.search ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.search && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索色料名称或编号..."
                value={criteria.searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleSection('transparency')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-green-500" />
              <span>透明度范围</span>
            </div>
            {expandedSections.transparency ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.transparency && (
            <div className="space-y-3 bg-slate-700/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">最小值</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round(criteria.transparencyRange[0] * 100)}
                    onChange={(e) => {
                      const val = Math.min(Math.max(parseInt(e.target.value) || 0, 0), 100);
                      setTransparencyRange([val / 100, criteria.transparencyRange[1]]);
                    }}
                    className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <span className="text-xs text-slate-400 ml-1">%</span>
                </div>
                <div className="text-xs text-slate-500">—</div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">最大值</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round(criteria.transparencyRange[1] * 100)}
                    onChange={(e) => {
                      const val = Math.min(Math.max(parseInt(e.target.value) || 0, 0), 100);
                      setTransparencyRange([criteria.transparencyRange[0], val / 100]);
                    }}
                    className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <span className="text-xs text-slate-400 ml-1">%</span>
                </div>
              </div>
              <div className="relative pt-2">
                <div className="h-1.5 bg-slate-600 rounded-full">
                  <div
                    className="absolute h-1.5 bg-green-500 rounded-full"
                    style={{
                      left: `${criteria.transparencyRange[0] * 100}%`,
                      right: `${100 - criteria.transparencyRange[1] * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleSection('lightfastness')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-blue-500" />
              <span>耐光等级范围</span>
            </div>
            {expandedSections.lightfastness ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.lightfastness && (
            <div className="space-y-3 bg-slate-700/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">最低等级</label>
                  <select
                    value={criteria.lightfastnessRange[0]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setLightfastnessRange([val, criteria.lightfastnessRange[1]]);
                    }}
                    className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>等级 {n}</option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-slate-500">—</div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">最高等级</label>
                  <select
                    value={criteria.lightfastnessRange[1]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setLightfastnessRange([criteria.lightfastnessRange[0], val]);
                    }}
                    className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>等级 {n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="relative pt-2">
                <div className="h-1.5 bg-slate-600 rounded-full">
                  <div
                    className="absolute h-1.5 bg-blue-500 rounded-full"
                    style={{
                      left: `${((criteria.lightfastnessRange[0] - 1) / 7) * 100}%`,
                      right: `${100 - ((criteria.lightfastnessRange[1] - 1) / 7) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>6</span>
                  <span>7</span>
                  <span>8</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleSection('cost')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <span>成本范围</span>
            </div>
            {expandedSections.cost ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.cost && (
            <div className="space-y-3 bg-slate-700/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">最低成本</label>
                  <div className="flex items-center">
                    <span className="text-xs text-slate-400 mr-1">¥</span>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={criteria.costRange[0]}
                      onChange={(e) => {
                        const val = Math.min(Math.max(parseInt(e.target.value) || 0, 0), 1000);
                        setCostRange([val, criteria.costRange[1]]);
                      }}
                      className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div className="text-xs text-slate-500">—</div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">最高成本</label>
                  <div className="flex items-center">
                    <span className="text-xs text-slate-400 mr-1">¥</span>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={criteria.costRange[1]}
                      onChange={(e) => {
                        const val = Math.min(Math.max(parseInt(e.target.value) || 0, 0), 1000);
                        setCostRange([criteria.costRange[0], val]);
                      }}
                      className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
              <div className="relative pt-2">
                <div className="h-1.5 bg-slate-600 rounded-full">
                  <div
                    className="absolute h-1.5 bg-amber-500 rounded-full"
                    style={{
                      left: `${(criteria.costRange[0] / 1000) * 100}%`,
                      right: `${100 - (criteria.costRange[1] / 1000) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                  <span>¥0</span>
                  <span>¥500</span>
                  <span>¥1000</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleSection('status')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white"
          >
            <span>状态筛选</span>
            {expandedSections.status ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.status && (
            <div className="space-y-2">
              {statusOptions.map((status) => (
                <label key={status.value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={criteria.status.includes(status.value as never)}
                    onChange={() => toggleStatus(status.value as never)}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <div className={`w-3 h-3 rounded-full ${status.color}`} />
                  <span className="text-sm text-slate-300 group-hover:text-white">{status.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleSection('anomalies')}
            className="w-full flex items-center justify-between text-sm font-medium text-slate-300 hover:text-white"
          >
            <span>异常类型</span>
            {expandedSections.anomalies ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.anomalies && (
            <div className="space-y-2">
              {anomalyOptions.map((anomaly) => (
                <label key={anomaly.value} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={criteria.anomalies.includes(anomaly.value as never)}
                    onChange={() => toggleAnomaly(anomaly.value as never)}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white">{anomaly.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-400">
          图例说明：
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>已处理</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>待确认</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>需退回</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
