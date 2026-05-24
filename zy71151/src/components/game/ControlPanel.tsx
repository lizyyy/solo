import { GameState } from '../../types';
import { useGameActions } from '../../store/gameStore';
import { formatTime } from '../../utils/math';

interface ControlPanelProps {
  state: GameState;
}

export default function ControlPanel({ state }: ControlPanelProps) {
  const { pauseGame, resumeGame, setTimeSpeed, resetGame, recallTug } = useGameActions();

  const handleTogglePause = () => {
    if (state.phase === 'playing') {
      pauseGame();
    } else if (state.phase === 'paused') {
      resumeGame();
    }
  };

  const selectedTug = state.tugs.find((t) => t.id === state.selectedTugId);
  const selectedShip = state.ships.find((s) => s.id === state.selectedShipId);

  return (
    <div className="glass-panel rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-oswald font-bold text-lg text-white">时间控制</h3>
        <div className="font-mono text-xl text-warning-500">
          {formatTime(state.time)} / {formatTime(state.maxTime)}
        </div>
      </div>

      <div className="h-2 bg-navy-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-warning-500 to-warning-400 transition-all duration-300"
          style={{ width: `${(state.time / state.maxTime) * 100}%` }}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleTogglePause}
          className={`flex-1 btn-industrial ${
            state.phase === 'paused'
              ? 'bg-green-600 border-green-400 hover:bg-green-500'
              : 'bg-yellow-600 border-yellow-400 hover:bg-yellow-500'
          } text-white`}
        >
          {state.phase === 'paused' ? '▶ 继续' : '⏸ 暂停'}
        </button>
        <button
          onClick={() => resetGame()}
          className="btn-industrial bg-red-600 border-red-400 hover:bg-red-500 text-white"
        >
          🔄 重置
        </button>
      </div>

      <div className="flex gap-2">
        {[1, 2, 4].map((speed) => (
          <button
            key={speed}
            onClick={() => setTimeSpeed(speed)}
            className={`flex-1 btn-industrial text-sm ${
              state.timeSpeed === speed
                ? 'bg-warning-500 border-warning-400 text-white'
                : 'bg-navy-700 border-navy-500 text-harbor-300 hover:bg-navy-600'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      {(selectedTug || selectedShip) && (
        <div className="border-t border-harbor-600 pt-4">
          <h4 className="font-oswald font-semibold text-harbor-200 mb-3">
            已选择
          </h4>

          {selectedTug && (
            <div className="bg-navy-800 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-white">{selectedTug.name}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  selectedTug.status === 'idle' ? 'bg-harbor-600 text-harbor-200' :
                  selectedTug.status === 'moving' ? 'bg-blue-600 text-white' :
                  selectedTug.status === 'towing' ? 'bg-warning-500 text-white' :
                  'bg-harbor-600 text-harbor-200'
                }`}>
                  {selectedTug.status === 'idle' ? '待命' :
                   selectedTug.status === 'moving' ? '移动中' :
                   selectedTug.status === 'towing' ? '作业中' : '返航中'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-harbor-300">
                <span>⛽ 燃油:</span>
                <div className="flex-1 h-2 bg-navy-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      selectedTug.fuel > 30 ? 'bg-green-500' :
                      selectedTug.fuel > 10 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${selectedTug.fuel}%` }}
                  />
                </div>
                <span className="font-mono">{Math.round(selectedTug.fuel)}%</span>
              </div>
              {selectedTug.status !== 'idle' && (
                <button
                  onClick={() => recallTug(selectedTug.id)}
                  className="mt-2 w-full btn-industrial bg-navy-600 border-navy-400 text-sm text-harbor-200 hover:bg-navy-500"
                >
                  召回拖轮
                </button>
              )}
            </div>
          )}

          {selectedShip && (
            <div className="bg-navy-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-white">{selectedShip.name}</span>
                <span className="text-xs px-2 py-1 rounded bg-blue-600 text-white">
                  {selectedShip.status === 'approaching' ? '进港中' :
                   selectedShip.status === 'waiting' ? '等待中' :
                   selectedShip.status === 'docking' ? '靠泊中' :
                   selectedShip.status === 'docked' ? '已靠泊' :
                   selectedShip.status === 'undocking' ? '离泊中' : '离港中'}
                </span>
              </div>
              <div className="text-sm text-harbor-300 space-y-1">
                <div className="flex justify-between">
                  <span>类型:</span>
                  <span>{selectedShip.type === 'cargo' ? '货船' : selectedShip.type === 'container' ? '集装箱船' : '油轮'}</span>
                </div>
                <div className="flex justify-between">
                  <span>吃水:</span>
                  <span>{selectedShip.draft}m</span>
                </div>
                <div className="flex justify-between">
                  <span>需要拖轮:</span>
                  <span className={selectedShip.assignedTugIds.length >= selectedShip.requiredTugs ? 'text-green-400' : 'text-yellow-400'}>
                    {selectedShip.assignedTugIds.length}/{selectedShip.requiredTugs}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-harbor-400">
                💡 点击空闲拖轮分配任务
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
