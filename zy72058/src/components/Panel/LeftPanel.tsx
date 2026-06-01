import { Search, Filter, X, ChevronDown, AlertTriangle, MapPin, FileText, Image, Edit3, MessageSquare } from 'lucide-react';
import { useStore, useFilteredComponents, useCoordinateSystems } from '@/store/useStore';
import { SOURCE_TYPE_LABELS, STATUS_LABELS, COORDINATE_COLORS, SourceType, ComponentStatus } from '@/types';
import { useState } from 'react';

const sourceTypeIcons: Record<SourceType, React.ReactNode> = {
  point_table: <MapPin className="w-3 h-3" />,
  photo: <Image className="w-3 h-3" />,
  manual_edit: <Edit3 className="w-3 h-3" />,
  remark: <MessageSquare className="w-3 h-3" />,
};

export function LeftPanel() {
  const filteredComponents = useFilteredComponents();
  const coordinateSystems = useCoordinateSystems();
  const { filter, setFilter, resetFilter, selectedComponentId, setSelectedComponent } = useStore();
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="w-80 h-full bg-slate-900 border-r border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold text-amber-400 mb-3" style={{ fontFamily: 'serif' }}>
          古建筑修缮构件库
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索构件名称、来源..."
            value={filter.search || ''}
            onChange={(e) => setFilter({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="mt-2 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
        >
          <Filter className="w-4 h-4" />
          筛选条件
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="mt-3 space-y-3 p-3 bg-slate-800 rounded-lg">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">坐标系</label>
              <select
                value={filter.coordinateSystem || ''}
                onChange={(e) => setFilter({ coordinateSystem: e.target.value || undefined })}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">全部</option>
                {coordinateSystems.map((cs) => (
                  <option key={cs} value={cs}>{cs}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">来源类型</label>
              <select
                value={filter.sourceType || ''}
                onChange={(e) => setFilter({ sourceType: (e.target.value as SourceType) || undefined })}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">全部</option>
                {Object.entries(SOURCE_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">状态</label>
              <select
                value={filter.status || ''}
                onChange={(e) => setFilter({ status: (e.target.value as ComponentStatus) || undefined })}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">全部</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anomaly-filter"
                checked={filter.isAnomaly || false}
                onChange={(e) => setFilter({ isAnomaly: e.target.checked || undefined })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="anomaly-filter" className="text-sm text-slate-300">仅显示异常</label>
            </div>
            <button
              onClick={resetFilter}
              className="w-full py-1.5 text-sm text-slate-400 hover:text-slate-300 border border-slate-600 rounded hover:border-slate-500 transition-colors"
            >
              重置筛选
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">共 {filteredComponents.length} 条记录</span>
          <span className="text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {filteredComponents.filter((c) => c.isAnomaly).length} 异常
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredComponents.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无匹配的构件</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {filteredComponents.map((component) => (
              <div
                key={component.id}
                onClick={() => setSelectedComponent(component.id)}
                className={`p-3 cursor-pointer transition-all hover:bg-slate-800 ${
                  selectedComponentId === component.id
                    ? 'bg-slate-800 border-l-4 border-amber-500'
                    : 'border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm truncate">
                        {component.name}
                      </span>
                      {component.isAnomaly && (
                        <span className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: `${COORDINATE_COLORS[component.coordinateSystem] || COORDINATE_COLORS['默认']}20`,
                          color: COORDINATE_COLORS[component.coordinateSystem] || COORDINATE_COLORS['默认'],
                        }}
                      >
                        {component.coordinateSystem}
                      </span>
                      <span className="flex items-center gap-1">
                        {sourceTypeIcons[component.sourceType]}
                        {SOURCE_TYPE_LABELS[component.sourceType]}
                      </span>
                    </div>
                    {component.status !== 'normal' && (
                      <div className="mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          component.status === 'empty' ? 'bg-yellow-900/50 text-yellow-400' :
                          component.status === 'duplicate' ? 'bg-orange-900/50 text-orange-400' :
                          'bg-blue-900/50 text-blue-400'
                        }`}>
                          {STATUS_LABELS[component.status]}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedComponent(null);
                    }}
                    className="flex-shrink-0 p-1 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {component.remark && (
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                    {component.remark}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
