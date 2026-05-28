import { useState } from 'react';
import { Settings, RotateCcw, Brain, Bone, Wind } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const PRESETS = [
  { name: '脑组织', width: 80, center: 40, icon: Brain },
  { name: '骨窗', width: 2000, center: 400, icon: Bone },
  { name: '肺窗', width: 1500, center: -500, icon: Wind },
  { name: '软组织', width: 400, center: 50, icon: Settings },
];

export const WindowControl = () => {
  const { currentWindowWidth, currentWindowCenter, setWindowLevel } =
    useAppStore();
  const [localWidth, setLocalWidth] = useState(currentWindowWidth);
  const [localCenter, setLocalCenter] = useState(currentWindowCenter);

  const handlePresetClick = (width: number, center: number) => {
    setLocalWidth(width);
    setLocalCenter(center);
    setWindowLevel(width, center);
  };

  const handleWidthChange = (value: number) => {
    setLocalWidth(value);
    setWindowLevel(value, localCenter);
  };

  const handleCenterChange = (value: number) => {
    setLocalCenter(value);
    setWindowLevel(localWidth, value);
  };

  const handleReset = () => {
    setLocalWidth(400);
    setLocalCenter(50);
    setWindowLevel(400, 50);
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cyan-400 font-semibold text-sm flex items-center gap-2">
          <Settings className="w-4 h-4" />
          窗宽窗位控制
        </h3>
        <button
          onClick={handleReset}
          className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
          title="重置"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isActive =
            Math.abs(localWidth - preset.width) < 10 &&
            Math.abs(localCenter - preset.center) < 10;
          return (
            <button
              key={preset.name}
              onClick={() => handlePresetClick(preset.width, preset.center)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                isActive
                  ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                  : 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3 h-3" />
              {preset.name}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-slate-400 text-xs">窗宽 (WW)</label>
            <span className="text-cyan-400 font-mono text-xs">{localWidth}</span>
          </div>
          <input
            type="range"
            min="100"
            max="2000"
            value={localWidth}
            onChange={(e) => handleWidthChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>100</span>
            <span>2000</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-slate-400 text-xs">窗位 (WL)</label>
            <span className="text-cyan-400 font-mono text-xs">{localCenter}</span>
          </div>
          <input
            type="range"
            min="-1000"
            max="1000"
            value={localCenter}
            onChange={(e) => handleCenterChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>-1000</span>
            <span>1000</span>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
        <div className="text-xs text-slate-500 mb-2">直方图预览</div>
        <div className="h-12 bg-slate-800 rounded flex items-end gap-px p-1">
          {Array.from({ length: 32 }).map((_, i) => {
            const height = Math.random() * 60 + 20;
            const inWindow =
              i >= 8 && i <= 20;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t transition-all ${
                  inWindow ? 'bg-cyan-500' : 'bg-slate-600'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
