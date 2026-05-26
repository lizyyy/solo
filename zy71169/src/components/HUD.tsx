import React from 'react';
import { Pause, Play, Home, Target, Zap, XCircle, CheckCircle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';

export default function HUD() {
  const navigate = useNavigate();
  const {
    gameTime,
    remainingTime,
    isPaused,
    score,
    combo,
    correctCount,
    errorCount,
    pauseGame,
    resumeGame,
    resetGame,
  } = useGameStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handlePauseToggle = () => {
    if (isPaused) {
      resumeGame();
    } else {
      pauseGame();
    }
  };

  const handleHome = () => {
    resetGame();
    navigate('/');
  };

  return (
    <>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-gray-900/80 backdrop-blur-md rounded-2xl px-6 py-3 shadow-2xl border border-gray-700">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-white">
              <Target className="w-5 h-5 text-amber-400" />
              <span className="text-sm text-gray-400">游戏时间</span>
              <span className="font-mono text-lg font-bold">{formatTime(gameTime)}</span>
            </div>

            <div className="w-px h-6 bg-gray-700" />

            <div className="flex items-center gap-2 text-white">
              <span className="text-sm text-gray-400">剩余</span>
              <span
                className={`font-mono text-lg font-bold ${remainingTime < 30 ? 'text-red-400' : 'text-white'}`}
              >
                {formatTime(remainingTime)}
              </span>
            </div>

            <div className="w-px h-6 bg-gray-700" />

            <button
              onClick={handlePauseToggle}
              className="p-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              title={isPaused ? '继续' : '暂停'}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>

            <button
              onClick={handleHome}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              title="返回主菜单"
            >
              <Home className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                remainingTime < 30
                  ? 'bg-red-500'
                  : remainingTime < 60
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${(remainingTime / (gameTime + remainingTime || 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="fixed right-4 top-20 z-50">
        <div className="bg-gray-900/80 backdrop-blur-md rounded-2xl px-5 py-4 shadow-2xl border border-gray-700 w-56">
          <div className="text-center mb-4">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">当前得分</div>
            <div className="text-3xl font-bold text-white font-mono">{score}</div>
          </div>

          {combo > 0 && (
            <div className="flex items-center justify-center gap-2 bg-amber-500/20 rounded-lg py-2 mb-3">
              <Zap className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-bold text-lg">
                {combo}x 连击!
              </span>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>正确操作</span>
              </span>
              <span className="font-mono font-bold text-white">{correctCount}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-red-400">
                <XCircle className="w-4 h-4" />
                <span>错误操作</span>
              </span>
              <span className="font-mono font-bold text-white">{errorCount}</span>
            </div>

            <div className="border-t border-gray-700 pt-2 flex items-center justify-between text-sm">
              <span className="text-gray-400">准确率</span>
              <span className="font-mono font-bold text-amber-400">
                {correctCount + errorCount > 0
                  ? Math.round((correctCount / (correctCount + errorCount)) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-gray-900/80 backdrop-blur-md rounded-xl px-6 py-3 shadow-2xl border border-gray-700">
          <p className="text-gray-300 text-sm text-center">
            <span className="text-amber-400">拖拽</span> 订单到对应年级备餐台 ·
            <span className="text-amber-400"> 点击</span> 取餐窗口分配订单 ·
            <span className="text-amber-400"> 空格</span> 暂停/继续
          </p>
        </div>
      </div>
    </>
  );
}