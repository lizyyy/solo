import { useNetworkStore } from '@/store/useNetworkStore';
import { Eye, MapPin, Layers, Box, Square, RotateCcw } from 'lucide-react';
import type { ViewMode } from '@/types';

const viewModes: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: '3d', label: '3D视图', icon: <Box className="w-4 h-4" /> },
  { mode: '2d-top', label: '俯视图', icon: <Square className="w-4 h-4" /> },
  { mode: '2d-front', label: '正视图', icon: <Square className="w-4 h-4" /> },
];

export function ViewControls() {
  const {
    viewMode,
    setViewMode,
    showZones,
    showValves,
    showRepairPoints,
    toggleShowZones,
    toggleShowValves,
    toggleShowRepairPoints,
    reset,
  } = useNetworkStore();

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span>视图模式</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {viewModes.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all ${
                viewMode === mode
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-300'
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>显示控制</span>
        </div>
        <div className="space-y-2">
          <button
            onClick={toggleShowZones}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-all ${
              showZones
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
            }`}
          >
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              用户片区
            </span>
            <span className={`w-8 h-4 rounded-full transition-all ${
              showZones ? 'bg-green-500' : 'bg-slate-600'
            }`}>
              <span className={`block w-3 h-3 rounded-full bg-white mt-0.5 transition-all ${
                showZones ? 'ml-4' : 'ml-0.5'
              }`} />
            </span>
          </button>

          <button
            onClick={toggleShowValves}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-all ${
              showValves
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              阀门
            </span>
            <span className={`w-8 h-4 rounded-full transition-all ${
              showValves ? 'bg-green-500' : 'bg-slate-600'
            }`}>
              <span className={`block w-3 h-3 rounded-full bg-white mt-0.5 transition-all ${
                showValves ? 'ml-4' : 'ml-0.5'
              }`} />
            </span>
          </button>

          <button
            onClick={toggleShowRepairPoints}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-all ${
              showRepairPoints
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
            }`}
          >
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              抢修点
            </span>
            <span className={`w-8 h-4 rounded-full transition-all ${
              showRepairPoints ? 'bg-green-500' : 'bg-slate-600'
            }`}>
              <span className={`block w-3 h-3 rounded-full bg-white mt-0.5 transition-all ${
                showRepairPoints ? 'ml-4' : 'ml-0.5'
              }`} />
            </span>
          </button>
        </div>
      </div>

      <button
        onClick={reset}
        className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
      >
        <RotateCcw className="w-4 h-4" />
        重置演练
      </button>
    </div>
  );
}
