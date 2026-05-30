import { Play, Pause, RotateCcw, Flag, BookOpen } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { GAME_VERSION, GAME_SOURCE } from '../data/initialData';

export function ControlBar() {
  const { status, startGame, pauseGame, resumeGame, resetGame, endGame, reviewMode, setReviewMode } = useGameStore();

  return (
    <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-2xl p-4 shadow-lg border-2 border-amber-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🐹</span>
          <div>
            <h1 className="text-2xl font-bold text-amber-900">仓鼠债券交易所</h1>
            <p className="text-xs text-amber-600">
              v{GAME_VERSION} | {GAME_SOURCE}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {status === 'idle' && (
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <Play size={20} />
              开始游戏
            </button>
          )}

          {status === 'playing' && (
            <>
              <button
                onClick={pauseGame}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold shadow-md transform hover:scale-105 transition-all duration-200"
              >
                <Pause size={18} />
                暂停
              </button>
              <button
                onClick={endGame}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-md transform hover:scale-105 transition-all duration-200"
              >
                <Flag size={18} />
                结算
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                onClick={resumeGame}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-md transform hover:scale-105 transition-all duration-200"
              >
                <Play size={18} />
                继续
              </button>
              <button
                onClick={resetGame}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-bold shadow-md transform hover:scale-105 transition-all duration-200"
              >
                <RotateCcw size={18} />
                重开
              </button>
            </>
          )}

          {(status === 'ended' || status === 'playing') && (
            <button
              onClick={() => setReviewMode(!reviewMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold shadow-md transform hover:scale-105 transition-all duration-200 ${
                reviewMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
              }`}
            >
              <BookOpen size={18} />
              {reviewMode ? '返回游戏' : '复盘'}
            </button>
          )}

          {status === 'ended' && (
            <button
              onClick={resetGame}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-md transform hover:scale-105 transition-all duration-200"
            >
              <RotateCcw size={18} />
              再来一局
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
