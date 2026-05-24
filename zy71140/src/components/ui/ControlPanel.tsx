import { Layers, Clock, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { CameraView } from '../../types';

const cameraViewLabels: Record<CameraView, string> = {
  overview: '总览',
  front: '正面',
  side: '侧面',
  top: '俯视',
  free: '自由',
};

export function ControlPanel() {
  const {
    layers,
    selectedLayerIds,
    toggleLayer,
    expiryFilterDays,
    setExpiryFilterDays,
    cameraView,
    setCameraView,
    leftPanelOpen,
    toggleLeftPanel,
  } = useStore();

  if (!leftPanelOpen) {
    return (
      <button
        onClick={toggleLeftPanel}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800/90 backdrop-blur-md border border-slate-600/50 border-l-0 rounded-r-lg p-2 text-slate-400 hover:text-white hover:bg-slate-700/90 transition-all"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="absolute left-4 top-20 bottom-20 z-20 w-72 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <h2 className="text-white font-semibold text-sm">控制面板</h2>
        <button
          onClick={toggleLeftPanel}
          className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-slate-300 text-sm font-medium">温层筛选</h3>
          </div>
          <div className="space-y-2">
            {layers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                  selectedLayerIds.includes(layer.id)
                    ? 'bg-slate-700/50 border-slate-500/50'
                    : 'bg-slate-800/30 border-slate-700/30 opacity-50'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: layer.color, boxShadow: `0 0 8px ${layer.color}` }}
                />
                <div className="flex-1 text-left">
                  <p className="text-white text-sm">{layer.name}</p>
                  <p className="text-slate-500 text-xs">{layer.tempRange}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-slate-300 text-sm font-medium">效期高亮</h3>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs">临期天数阈值</span>
              <span className="text-amber-400 font-mono text-sm">{expiryFilterDays} 天</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              value={expiryFilterDays}
              onChange={(e) => setExpiryFilterDays(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-slate-600 text-xs">0</span>
              <span className="text-slate-600 text-xs">30</span>
              <span className="text-slate-600 text-xs">60</span>
              <span className="text-slate-600 text-xs">90</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-purple-400" />
            <h3 className="text-slate-300 text-sm font-medium">视角切换</h3>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {(Object.keys(cameraViewLabels) as CameraView[]).map((view) => (
              <button
                key={view}
                onClick={() => setCameraView(view)}
                className={`px-2 py-2 rounded text-xs font-medium transition-all ${
                  cameraView === view
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                {cameraViewLabels[view]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-slate-300 text-sm font-medium mb-3">图例说明</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-cyan-500" />
              <span className="text-slate-400">正常货位</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-slate-400">温层错放</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-slate-400">货位冲突</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-slate-600" />
              <span className="text-slate-400">空货位</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded ring-2 ring-red-400 animate-pulse" />
              <span className="text-slate-400">临期商品</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
