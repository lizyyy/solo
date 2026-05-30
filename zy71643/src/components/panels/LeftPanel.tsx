import { useState } from 'react';
import {
  Layers,
  Droplets,
  Zap,
  Flame,
  AlertTriangle,
  MapPin,
  Grid3X3,
  Search,
  Eye,
  EyeOff,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { usePipelineStore } from '../../stores/pipelineStore';
import { searchSegmentsByPileNo } from '../../engine/pileNo';
import type { PipelineSegment, PileMarker } from '../../types';
import { cn } from '../../lib/utils';
import { pipelineColors } from '../../data/config';

interface LeftPanelProps {
  pileMarkers: PileMarker[];
  onPileSelect: (marker: PileMarker) => void;
  highlightedPileNo: string;
}

export function LeftPanel({ pileMarkers, onPileSelect, highlightedPileNo }: LeftPanelProps) {
  const collapsed = useUIStore((state) => state.leftPanelCollapsed);
  const visibility = usePipelineStore((state) => state.visibility);
  const transparency = usePipelineStore((state) => state.transparency);
  const segments = usePipelineStore((state) => state.segments);
  const selectedSegment = usePipelineStore((state) => state.selectedSegment);
  const setVisibility = usePipelineStore((state) => state.setVisibility);
  const setTransparency = usePipelineStore((state) => state.setTransparency);
  const setSelectedSegment = usePipelineStore((state) => state.setSelectedSegment);
  const searchPileNo = useUIStore((state) => state.searchPileNo);
  const setSearchPileNo = useUIStore((state) => state.setSearchPileNo);
  const setSearchResults = useUIStore((state) => state.setSearchResults);
  const showNotification = useUIStore((state) => state.showNotification);

  const [showLayerSettings, setShowLayerSettings] = useState(true);
  const [showPileSearch, setShowPileSearch] = useState(true);
  const [showSegmentInfo, setShowSegmentInfo] = useState(true);

  const handleSearch = () => {
    if (!searchPileNo.trim()) {
      setSearchResults([]);
      return;
    }

    const results = searchSegmentsByPileNo(searchPileNo, segments);
    setSearchResults(results);

    if (results.length > 0) {
      showNotification(`找到 ${results.length} 条管线`, 'info');
    } else {
      showNotification('未找到匹配的管线', 'warning');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleJumpToPile = (marker: PileMarker) => {
    onPileSelect(marker);
    useUIStore.getState().applyCameraPreset({
      name: '桩号定位',
      position: { x: marker.position.x + 30, y: 20, z: 30 },
      target: marker.position,
    });
  };

  if (collapsed) return null;

  return (
    <aside className="w-72 bg-slate-900/95 backdrop-blur border-r border-slate-700 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-slate-700">
        <h2 className="text-white font-medium text-sm flex items-center gap-2">
          <Layers size={16} className="text-blue-400" />
          控制面板
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3 border-b border-slate-700/50">
          <button
            onClick={() => setShowLayerSettings(!showLayerSettings)}
            className="w-full flex items-center justify-between text-slate-300 hover:text-white transition-colors"
          >
            <span className="text-xs font-medium flex items-center gap-2">
              <Sliders size={14} />
              图层控制
            </span>
            {showLayerSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showLayerSettings && (
            <div className="mt-3 space-y-2">
              {[
                { key: 'water', label: '给排水', icon: Droplets, color: pipelineColors.water },
                { key: 'electric', label: '电力电缆', icon: Zap, color: pipelineColors.electric },
                { key: 'gas', label: '燃气管道', icon: Flame, color: pipelineColors.gas },
                { key: 'collision', label: '碰撞标记', icon: AlertTriangle, color: '#e53935' },
                { key: 'pileNo', label: '桩号标记', icon: MapPin, color: '#94a3b8' },
                { key: 'grid', label: '地面网格', icon: Grid3X3, color: '#334155' },
              ].map(({ key, label, icon: Icon, color }) => (
                <div key={key} className="flex items-center gap-2">
                  <button
                    onClick={() => setVisibility(key as any, !visibility[key as keyof typeof visibility])}
                    className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                  >
                    {visibility[key as keyof typeof visibility] ? (
                      <Eye size={14} className="text-slate-300" />
                    ) : (
                      <EyeOff size={14} className="text-slate-500" />
                    )}
                  </button>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-slate-300 flex-1">{label}</span>
                </div>
              ))}

              <div className="mt-4 pt-3 border-t border-slate-700/50">
                <label className="text-xs text-slate-400 block mb-2">
                  管线透明度: {Math.round(transparency * 100)}%
                </label>
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={transparency}
                  onChange={(e) => setTransparency(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-b border-slate-700/50">
          <button
            onClick={() => setShowPileSearch(!showPileSearch)}
            className="w-full flex items-center justify-between text-slate-300 hover:text-white transition-colors"
          >
            <span className="text-xs font-medium flex items-center gap-2">
              <MapPin size={14} />
              桩号定位
            </span>
            {showPileSearch ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showPileSearch && (
            <div className="mt-3 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="输入桩号 (如 K0+100)"
                  value={searchPileNo}
                  onChange={(e) => setSearchPileNo(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-600 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {pileMarkers.map((marker) => (
                  <button
                    key={marker.id}
                    onClick={() => handleJumpToPile(marker)}
                    className={cn(
                      'px-2 py-1 text-xs rounded transition-all',
                      highlightedPileNo === marker.no
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    )}
                  >
                    {marker.no}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3">
          <button
            onClick={() => setShowSegmentInfo(!showSegmentInfo)}
            className="w-full flex items-center justify-between text-slate-300 hover:text-white transition-colors"
          >
            <span className="text-xs font-medium flex items-center gap-2">
              <Eye size={14} />
              管线详情
            </span>
            {showSegmentInfo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showSegmentInfo && (
            <div className="mt-3">
              {selectedSegment ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: pipelineColors[selectedSegment.type] }}
                    />
                    <span className="text-white font-medium">{selectedSegment.pipelineName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-500 mb-0.5">类型</div>
                      <div className="text-slate-200">
                        {selectedSegment.type === 'water' ? '给排水' : selectedSegment.type === 'electric' ? '电力' : '燃气'}
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-500 mb-0.5">管径</div>
                      <div className="text-slate-200">
                        {selectedSegment.diameter > 0 ? `${selectedSegment.diameter}m` : '缺失'}
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-500 mb-0.5">起点标高</div>
                      <div className="text-slate-200">{selectedSegment.startPoint.y.toFixed(2)}m</div>
                    </div>
                    <div className="bg-slate-800 rounded p-2">
                      <div className="text-slate-500 mb-0.5">终点标高</div>
                      <div className="text-slate-200">{selectedSegment.endPoint.y.toFixed(2)}m</div>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded p-2">
                    <div className="text-slate-500 mb-0.5">桩号范围</div>
                    <div className="text-slate-200">
                      {selectedSegment.startPileNo || '未知'} → {selectedSegment.endPileNo || '未知'}
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded p-2">
                    <div className="text-slate-500 mb-0.5">数据来源</div>
                    <div className={cn(
                      selectedSegment.dataSource === 'corrected' ? 'text-orange-400' :
                      selectedSegment.dataSource === 'duplicate' ? 'text-red-400' : 'text-slate-200'
                    )}>
                      {selectedSegment.dataSource === 'survey' ? '实测数据' :
                       selectedSegment.dataSource === 'design' ? '设计数据' :
                       selectedSegment.dataSource === 'corrected' ? '人工修正' : '重复数据'}
                    </div>
                  </div>

                  {selectedSegment.hasWarning && (
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 text-orange-400">
                      <div className="flex items-center gap-1.5 font-medium mb-1">
                        <AlertTriangle size={12} />
                        数据警告
                      </div>
                      <div className="text-xs">{selectedSegment.warningMessage}</div>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedSegment(null)}
                    className="w-full py-1.5 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors mt-2"
                  >
                    取消选中
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  <Eye size={24} className="mx-auto mb-2 opacity-50" />
                  点击管线段查看详情
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
