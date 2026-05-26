import type { GameStatus, LevelConfig } from '../game/types';

interface ControlPanelProps {
  status: GameStatus;
  levels: LevelConfig[];
  currentLevelId: number;
  onStartLevel: (levelId: number) => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onShowHistory: () => void;
}

export function ControlPanel({
  status,
  levels,
  currentLevelId,
  onStartLevel,
  onPause,
  onResume,
  onRestart,
  onShowHistory
}: ControlPanelProps) {
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isFinished = status === 'finished';
  const isIdle = status === 'idle';

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-gray-400 text-sm">关卡:</label>
          <select
            value={currentLevelId}
            onChange={(e) => onStartLevel(Number(e.target.value))}
            disabled={isPlaying || isPaused}
            className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name} - {level.difficulty}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          {isIdle && (
            <button
              onClick={() => onStartLevel(currentLevelId)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              开始巡检
            </button>
          )}

          {isPlaying && (
            <button
              onClick={onPause}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              暂停
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              继续
            </button>
          )}

          {(isPlaying || isPaused) && (
            <button
              onClick={onRestart}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              重新开始
            </button>
          )}

          {isFinished && (
            <button
              onClick={() => onStartLevel(currentLevelId)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
            >
              再来一局
            </button>
          )}

          <button
            onClick={onShowHistory}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
          >
            历史记录
          </button>
        </div>
      </div>
    </div>
  );
}
