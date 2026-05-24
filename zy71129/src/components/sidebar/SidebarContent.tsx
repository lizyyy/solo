
import { useState } from 'react';
import { Layers, Eye, EyeOff, Filter, Search, X } from 'lucide-react';
import { useModelStore } from '../../store/useModelStore';
import { useFilterStore } from '../../store/useFilterStore';
import { ElementType } from '../../types/model';

const elementTypeLabels: Record<ElementType, { label: string; color: string }> = {
  cable_tray: { label: '线缆桥架', color: 'bg-blue-500' },
  duct: { label: '通风管道', color: 'bg-cyan-500' },
  fire_pipe: { label: '消防管线', color: 'bg-red-500' }
};

interface SidebarContentProps {
  onClose?: () => void;
}

export function SidebarContent({ onClose }: SidebarContentProps) {
  const [activeTab, setActiveTab] = useState<'layers' | 'filter'>('layers');
  const { toggleElementVisibility, getFilteredElements, currentVersion } = useModelStore();
  const { types, toggleType, elevationRange, setElevationRange, searchText, setSearchText } = useFilterStore();

  const visibleElements = getFilteredElements().filter(el => el.version === currentVersion);

  const filteredBySearch = visibleElements.filter(el =>
    searchText === '' || el.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex flex-1">
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === 'layers'
                ? 'text-white bg-slate-800 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              图层
            </div>
          </button>
          <button
            onClick={() => setActiveTab('filter')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === 'filter'
                ? 'text-white bg-slate-800 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              筛选
            </div>
          </button>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'layers' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-300 px-1">专业类型</h3>
              <div className="space-y-1">
                {(Object.keys(elementTypeLabels) as ElementType[]).map(type => (
                  <label
                    key={type}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={types.includes(type)}
                      onChange={() => toggleType(type)}
                      className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span className={`w-3 h-3 rounded ${elementTypeLabels[type].color}`} />
                    <span className="text-xs text-slate-300">
                      {elementTypeLabels[type].label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-700" />

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-medium text-slate-300">构件列表</h3>
                <span className="text-xs text-slate-500">{filteredBySearch.length} 个</span>
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="搜索构件..."
                  className="w-full pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredBySearch.map(element => (
                  <div
                    key={element.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 group"
                  >
                    <button
                      onClick={() => toggleElementVisibility(element.id)}
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      {element.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${element.visible ? '' : 'opacity-30'}`}
                      style={{ backgroundColor: element.color }}
                    />
                    <span className={`flex-1 text-xs truncate ${element.visible ? 'text-slate-300' : 'text-slate-600'}`}>
                      {element.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {element.elevation.toFixed(1)}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'filter' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-300 px-1">标高范围</h3>
              <div className="bg-slate-800 rounded p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">最低</span>
                  <span className="text-xs text-white font-mono">
                    {elevationRange[0].toFixed(1)}m
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="6"
                  step="0.1"
                  value={elevationRange[0]}
                  onChange={e => setElevationRange([parseFloat(e.target.value), elevationRange[1]])}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">最高</span>
                  <span className="text-xs text-white font-mono">
                    {elevationRange[1].toFixed(1)}m
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="6"
                  step="0.1"
                  value={elevationRange[1]}
                  onChange={e => setElevationRange([elevationRange[0], parseFloat(e.target.value)])}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>

            <div className="h-px bg-slate-700" />

            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-300 px-1">图例说明</h3>
              <div className="bg-slate-800 rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500/70" />
                  <span className="text-xs text-slate-300">线缆桥架</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-cyan-500/70" />
                  <span className="text-xs text-slate-300">通风管道</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500/70" />
                  <span className="text-xs text-slate-300">消防管线</span>
                </div>
                <div className="h-px bg-slate-700 my-2" />
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500" />
                  <span className="text-xs text-slate-300">硬碰撞</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500" />
                  <span className="text-xs text-slate-300">软碰撞</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
