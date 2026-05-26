import { Droplets, Waves, ArrowDownToLine, ArrowUpFromLine, Clock, Target } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export function DataPanel() {
  const { currentState, currentLevel, history } = useGameStore();

  if (!currentState || !currentLevel) {
    return (
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-lg font-bold text-white mb-3">实时数据</h3>
        <p className="text-slate-400 text-sm">等待游戏开始...</p>
      </div>
    );
  }

  const progress = (currentState.time / currentLevel.duration) * 100;
  const storagePercent = (currentState.reservoirStorage / currentLevel.maxStorage) * 100;
  const targetPercent = (currentLevel.targetStorage / currentLevel.maxStorage) * 100;

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-bold text-white mb-3">实时数据</h3>

      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400 flex items-center gap-1">
            <Clock size={14} />
            时间进度
          </span>
          <span className="text-white font-mono">
            {currentState.time}h / {currentLevel.duration}h
          </span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Droplets size={14} />
            水库库容
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {currentState.reservoirStorage.toFixed(0)}
            <span className="text-sm text-slate-400"> 万m³</span>
          </div>
          <div className="w-full h-1.5 bg-slate-600 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                currentState.isOvertopping ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, storagePercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>死水位</span>
            <span className="text-green-400">目标 {targetPercent.toFixed(0)}%</span>
            <span>上限</span>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Target size={14} />
            目标库容
          </div>
          <div className="text-xl font-bold text-green-400 font-mono">
            {currentLevel.targetStorage}
            <span className="text-sm text-slate-400"> 万m³</span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            偏差: <span className={Math.abs(storagePercent - targetPercent) < 10 ? 'text-green-400' : 'text-amber-400'}>
              {(storagePercent - targetPercent).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <ArrowDownToLine size={14} className="text-purple-400" />
            上游来水
          </div>
          <div className="text-lg font-bold text-purple-400 font-mono">
            {currentState.inflow.toFixed(0)}
            <span className="text-sm text-slate-400"> m³/s</span>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <ArrowUpFromLine size={14} className="text-cyan-400" />
            下泄流量
          </div>
          <div className={`text-lg font-bold font-mono ${
            currentState.isDownstreamDanger ? 'text-red-500' :
            currentState.isDownstreamWarning ? 'text-amber-500' : 'text-cyan-400'
          }`}>
            {currentState.outflow.toFixed(0)}
            <span className="text-sm text-slate-400"> m³/s</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-700/50 rounded-lg p-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
          <Waves size={14} />
          下游安全流量
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-slate-400">预警: </span>
            <span className="text-amber-400 font-mono">{currentLevel.warningDischarge} m³/s</span>
          </div>
          <div className="text-sm">
            <span className="text-slate-400">安全: </span>
            <span className="text-red-400 font-mono">{currentLevel.safeDischarge} m³/s</span>
          </div>
        </div>
        <div className="w-full h-3 bg-slate-600 rounded-full mt-2 overflow-hidden relative">
          <div
            className="absolute h-full bg-amber-500/30"
            style={{
              left: `${(currentLevel.warningDischarge / currentLevel.maxDischarge) * 100}%`,
              width: `${((currentLevel.safeDischarge - currentLevel.warningDischarge) / currentLevel.maxDischarge) * 100}%`,
            }}
          />
          <div
            className="absolute h-full bg-red-500/30"
            style={{
              left: `${(currentLevel.safeDischarge / currentLevel.maxDischarge) * 100}%`,
              width: `${100 - (currentLevel.safeDischarge / currentLevel.maxDischarge) * 100}%`,
            }}
          />
          <div
            className={`absolute h-full w-2 -ml-1 rounded-full transition-all duration-300 ${
              currentState.isDownstreamDanger ? 'bg-red-500' :
              currentState.isDownstreamWarning ? 'bg-amber-500' : 'bg-cyan-500'
            }`}
            style={{ left: `${(currentState.outflow / currentLevel.maxDischarge) * 100}%` }}
          />
        </div>
      </div>

      {history.length > 0 && (
        <div className="text-xs text-slate-500 border-t border-slate-700 pt-2">
          已记录 {history.length} 个时间步的数据
        </div>
      )}
    </div>
  );
}
