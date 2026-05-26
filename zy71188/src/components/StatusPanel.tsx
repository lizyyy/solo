import type { GameState } from '../game/types';

interface StatusPanelProps {
  gameState: GameState | null;
  levelName: string;
}

export function StatusPanel({ gameState, levelName }: StatusPanelProps) {
  if (!gameState) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <p className="text-gray-400 text-center">等待游戏开始...</p>
      </div>
    );
  }

  const timePercentage = (gameState.timeRemaining / gameState.totalTime) * 100;
  const isLowTime = gameState.timeRemaining <= 10;
  const realHazards = gameState.hazards.filter(h => h.isHazard);
  const foundHazards = realHazards.filter(h => h.marked && h.markCorrect).length;
  const wrongMarks = gameState.hazards.filter(h => h.marked && !h.markCorrect).length;

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">{levelName}</h2>
        <p className="text-sm text-gray-400">消防安全巡检</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">剩余时间</span>
          <span className={`font-mono font-bold text-lg ${isLowTime ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {Math.ceil(gameState.timeRemaining)}秒
          </span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isLowTime ? 'bg-red-500' : timePercentage > 50 ? 'bg-green-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${timePercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-amber-400">{gameState.score}</p>
          <p className="text-xs text-gray-400 mt-1">当前分数</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-400">
            {foundHazards}/{realHazards.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">发现隐患</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">隐患进度</h3>
        <div className="space-y-2">
          {gameState.hazards.slice(0, 6).map((hazard, index) => (
            <div key={hazard.id} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                hazard.marked
                  ? hazard.markCorrect ? 'bg-green-500' : 'bg-red-500'
                  : 'bg-gray-600'
              }`} />
              <span className={`text-sm ${
                hazard.marked ? (hazard.markCorrect ? 'text-green-400' : 'text-red-400') : 'text-gray-500'
              }`}>
                {hazard.isHazard ? '⚠️' : '🔵'} {hazard.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">操作提示</h3>
        <div className="space-y-1 text-sm text-gray-400">
          <p><kbd className="px-2 py-0.5 bg-gray-600 rounded text-xs">W A S D</kbd> 移动</p>
          <p><kbd className="px-2 py-0.5 bg-gray-600 rounded text-xs">方向键</kbd> 移动</p>
          <p><kbd className="px-2 py-0.5 bg-gray-600 rounded text-xs">空格</kbd> 标记隐患</p>
        </div>
      </div>

      {wrongMarks > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
          <p className="text-red-400 text-sm">
            ⚠️ 误报次数: {wrongMarks}
          </p>
        </div>
      )}
    </div>
  );
}
