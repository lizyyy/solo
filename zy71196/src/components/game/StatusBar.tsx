import { getRainIntensityLabel } from '../../game/config';
import type { GameState } from '../../game/types';

interface StatusBarProps {
  gameState: GameState;
}

export function StatusBar({ gameState }: StatusBarProps) {
  const rainLabel = getRainIntensityLabel(gameState.rainfallIntensity);
  const inspectedCount = gameState.inspectedDrains.length;
  const totalDrains = gameState.roofMap.drains.length;
  const resolvedCount = gameState.resolvedIssues.length;
  const totalIssues = gameState.roofMap.drains.filter((d) => d.isBlocked).length +
    gameState.roofMap.lowAreas.filter((l) => l.waterLevel > 0).length;

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">回合</span>
            <span className="text-white font-bold text-lg">
              {gameState.currentRound} / {gameState.totalRounds}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">雨量</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${gameState.rainfallIntensity}%` }}
                />
              </div>
              <span className="text-white font-medium">{rainLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">行动点</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: gameState.maxActionPoints }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-6 rounded-sm ${
                    i < gameState.actionPoints
                      ? 'bg-yellow-500'
                      : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>
            <span className="text-white font-bold">
              {gameState.actionPoints}/{gameState.maxActionPoints}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">巡检进度</span>
            <span className="text-white font-bold">
              {inspectedCount}/{totalDrains}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">已处置</span>
            <span className="text-green-400 font-bold">
              {resolvedCount}/{totalIssues}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">得分</span>
            <span className="text-yellow-400 font-bold text-xl">
              {gameState.score}
            </span>
          </div>

          {gameState.leakPoints.length > 0 && (
            <div className="flex items-center gap-2 bg-red-500/20 px-3 py-1 rounded-lg">
              <span className="text-red-400 text-sm">漏水点</span>
              <span className="text-red-400 font-bold">
                {gameState.leakPoints.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
