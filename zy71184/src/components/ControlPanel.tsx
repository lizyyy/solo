import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export function ControlPanel() {
  const { state, togglePause, resetGame, setSpeed, nextTurn, setReplayMode } = useGameStore();

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl px-6 py-4 shadow-2xl border border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">回合</span>
            <span className="text-white text-xl font-bold">
              {state.isReplayMode ? state.replayTurn : state.turn}
            </span>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">{state.maxTurns}</span>
          </div>

          <div className="w-px h-8 bg-gray-700" />

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">分数</span>
            <span className={`text-xl font-bold ${state.score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {state.score}
            </span>
          </div>

          <div className="w-px h-8 bg-gray-700" />

          <div className="flex items-center gap-2">
            {!state.isGameOver && !state.isReplayMode && (
              <>
                <button
                  onClick={togglePause}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  title={state.isPaused ? '开始' : '暂停'}
                >
                  {state.isPaused ? <Play size={20} /> : <Pause size={20} />}
                </button>
                <button
                  onClick={nextTurn}
                  className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                  title="下一回合"
                >
                  <SkipForward size={20} />
                </button>
              </>
            )}

            {state.isReplayMode && (
              <button
                onClick={() => setReplayMode(false)}
                className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
                title="退出回放，返回结算"
              >
                返回结算
              </button>
            )}

            <button
              onClick={resetGame}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              title="重新开始"
            >
              <RotateCcw size={20} />
            </button>
          </div>

          <div className="w-px h-8 bg-gray-700" />

          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-sm mr-2">速度</span>
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setSpeed(speed as 1 | 2 | 4)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  state.speed === speed
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
