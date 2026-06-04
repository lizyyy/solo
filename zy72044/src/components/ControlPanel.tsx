import { useGameStore } from '@/store/useGameStore';
import { Play, Pause, RotateCcw, Flag, StopCircle } from 'lucide-react';
import { formatSeconds, getStatusLabel, getStatusColorClass } from '@/utils/formatUtils';

export default function ControlPanel() {
  const {
    engineState,
    currentConfig,
    selectedConfigId,
    selectConfig,
    startNewGame,
    pauseCurrentGame,
    resumeCurrentGame,
    restartGame,
    settleGame,
    getElapsed,
    getProgress,
    getCurrentLevelName,
    getAvailableConfigs,
  } = useGameStore();

  const configs = getAvailableConfigs();
  const status = engineState.status;
  const elapsed = getElapsed();
  const progress = getProgress();
  const levelName = getCurrentLevelName();
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';
  const isFinished = status === 'finished';

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-800/80 rounded-xl border border-slate-700/50">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">选择配置：</span>
        <select
          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          value={selectedConfigId}
          onChange={(e) => selectConfig(e.target.value)}
          disabled={!isIdle && !isFinished}
        >
          <option value="">-- 请选择 --</option>
          {configs.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColorClass(status)}`}>
          {getStatusLabel(status)}
        </span>
        <span className="font-mono text-2xl text-slate-100 tabular-nums">
          {formatSeconds(elapsed)}
        </span>
      </div>

      {currentConfig && !isIdle && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{levelName}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isIdle && (
          <button
            onClick={startNewGame}
            disabled={!currentConfig}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Play size={16} /> 开始
          </button>
        )}

        {isRunning && (
          <>
            <button
              onClick={pauseCurrentGame}
              className="flex items-center gap-1.5 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Pause size={16} /> 暂停
            </button>
            <button
              onClick={() => useGameStore.getState().stepEvent()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={16} /> 推进一步
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={resumeCurrentGame}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={16} /> 继续
            </button>
            <button
              onClick={() => useGameStore.getState().stepEvent()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={16} /> 推进一步
            </button>
          </>
        )}

        {!isIdle && (
          <>
            <button
              onClick={restartGame}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw size={16} /> 重开
            </button>
            {!isFinished && (
              <button
                onClick={settleGame}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Flag size={16} /> 结算
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
