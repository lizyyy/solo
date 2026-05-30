import React from 'react';
import { Play, Pause, RotateCcw, Square, FileText, Users } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';

export const GameControls: React.FC = () => {
  const status = useGameStore(state => state.status);
  const startGame = useGameStore(state => state.startGame);
  const pauseGame = useGameStore(state => state.pauseGame);
  const resumeGame = useGameStore(state => state.resumeGame);
  const restartGame = useGameStore(state => state.restartGame);
  const endGame = useGameStore(state => state.endGame);
  const toggleReview = useGameStore(state => state.toggleReview);
  const toggleClueOrganizer = useGameStore(state => state.toggleClueOrganizer);

  const isIdle = status === 'idle';
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isEnded = status === 'ended';

  return (
    <div className="bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-gray-700">
      <div className="flex items-center gap-3 flex-wrap">
        {isIdle && (
          <button
            onClick={startGame}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
          >
            <Play size={18} />
            开始演出
          </button>
        )}

        {isPlaying && (
          <>
            <button
              onClick={pauseGame}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
            >
              <Pause size={18} />
              暂停
            </button>
            <button
              onClick={endGame}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
            >
              <Square size={18} />
              结束
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={resumeGame}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
            >
              <Play size={18} />
              继续
            </button>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
            >
              <RotateCcw size={18} />
              重新开始
            </button>
          </>
        )}

        {(isEnded || isPaused) && (
          <>
            <button
              onClick={toggleReview}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
            >
              <FileText size={18} />
              复盘
            </button>
            <button
              onClick={toggleClueOrganizer}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
            >
              <Users size={18} />
              交接助手
            </button>
          </>
        )}

        {isEnded && (
          <button
            onClick={restartGame}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95"
          >
            <RotateCcw size={18} />
            再来一局
          </button>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        {isIdle && '点击"开始演出"进入游戏'}
        {isPlaying && '正在演出中，注意处理各种问题！'}
        {isPaused && '游戏已暂停，可以查看复盘或继续'}
        {isEnded && '演出结束，查看复盘分析'}
      </div>
    </div>
  );
};
