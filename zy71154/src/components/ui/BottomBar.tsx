import { Play, Pause, RotateCcw, Settings, Info, Hand } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { LEVELS } from '../../game/levels';
import { useState } from 'react';

export function BottomBar() {
  const { status, endTurn, pauseGame, resumeGame, restartGame, initializeGame, currentLevel, selectedTeam, selectedNode, assignTeamToNode, teams } = useGameStore();
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';

  const handleAssignTeam = () => {
    if (selectedTeam && selectedNode) {
      const team = teams.find(t => t.id === selectedTeam);
      if (team && team.status === 'idle') {
        assignTeamToNode(selectedTeam, selectedNode);
      }
    }
  };

  const canAssign = selectedTeam && selectedNode && teams.find(t => t.id === selectedTeam)?.status === 'idle';

  return (
    <div className="absolute bottom-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-sm border-t border-slate-700 flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            className="p-2 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            onClick={() => setShowLevelSelect(!showLevelSelect)}
          >
            <Settings className="w-5 h-5" />
          </button>

          {showLevelSelect && (
            <div className="absolute bottom-full left-0 mb-2 bg-slate-800 rounded-lg border border-slate-600 p-2 min-w-48">
              <div className="text-xs text-slate-400 mb-2 px-2">选择关卡</div>
              {LEVELS.map(level => (
                <button
                  key={level.id}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    currentLevel.id === level.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  onClick={() => {
                    initializeGame(level);
                    setShowLevelSelect(false);
                  }}
                >
                  <div className="font-medium">{level.name}</div>
                  <div className="text-xs opacity-70">{level.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="p-2 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          onClick={restartGame}
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {isPlaying && (
          <button
            className="p-2 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            onClick={pauseGame}
          >
            <Pause className="w-5 h-5" />
          </button>
        )}

        {isPaused && (
          <button
            className="p-2 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            onClick={resumeGame}
          >
            <Play className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {canAssign && (
          <button
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            onClick={handleAssignTeam}
          >
            <Hand className="w-4 h-4" />
            派遣队伍
          </button>
        )}

        {selectedTeam && !selectedNode && (
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <Info className="w-4 h-4" />
            <span>请在地图上选择要抢修的目标</span>
          </div>
        )}

        {selectedNode && !selectedTeam && (
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <Info className="w-4 h-4" />
            <span>请选择一个待命的抢修队伍</span>
          </div>
        )}

        {(isPlaying || isPaused) && (
          <button
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
            onClick={endTurn}
            disabled={!isPlaying}
          >
            <Play className="w-4 h-4" />
            结束回合
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="hidden sm:inline">操作提示:</span>
        <span className="px-2 py-1 bg-slate-700 rounded text-xs">点击选择队伍</span>
        <span className="px-2 py-1 bg-slate-700 rounded text-xs">点击故障点派遣</span>
        <span className="px-2 py-1 bg-slate-700 rounded text-xs">鼠标控制视角</span>
      </div>
    </div>
  );
}
