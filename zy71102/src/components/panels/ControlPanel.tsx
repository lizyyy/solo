import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Layers, Eye, Grid3X3, Settings2 } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { scenes } from '../../data/scenes';

export const ControlPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const {
    selectedScene,
    setScene,
    isPlaying,
    setPlaying,
    speed,
    setSpeed,
    reset,
    is2DMode,
    toggle2DMode,
    cameraView,
    setCameraView
  } = useSimulationStore();

  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-slate-700 overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-700/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-white">控制面板</span>
          </div>
          <span className="text-slate-400 text-sm">{isExpanded ? '收起' : '展开'}</span>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-700">
            <div className="pt-3">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                选择场景
              </label>
              <select
                value={selectedScene?.id || ''}
                onChange={(e) => {
                  const scene = scenes.find(s => s.id === e.target.value);
                  if (scene) setScene(scene);
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 请选择场景 --</option>
                {scenes.map(scene => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
              </select>
              {selectedScene && (
                <p className="mt-2 text-xs text-slate-400">
                  {selectedScene.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlaying(!isPlaying)}
                disabled={!selectedScene}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    播放
                  </>
                )}
              </button>
              <button
                onClick={reset}
                disabled={!selectedScene}
                className="px-4 py-2.5 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                title="重置"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                播放速度: {speed}x
              </label>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0.5x</span>
                <span>2.5x</span>
                <span>5x</span>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-3">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                视图模式
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={toggle2DMode}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    is2DMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  2D
                </button>
                <button
                  onClick={toggle2DMode}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    !is2DMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                  3D
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                摄像机视角
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'default', label: '默认' },
                  { value: 'top', label: '俯视' },
                  { value: 'angle', label: '斜45°' },
                  { value: 'firstPerson', label: '第一人称' }
                ].map(view => (
                  <button
                    key={view.value}
                    onClick={() => setCameraView(view.value as any)}
                    disabled={is2DMode && view.value !== 'top'}
                    className={`flex items-center justify-center gap-1 px-3 py-2 rounded-md text-sm transition-colors ${
                      cameraView === view.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    } ${is2DMode && view.value !== 'top' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {view.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
