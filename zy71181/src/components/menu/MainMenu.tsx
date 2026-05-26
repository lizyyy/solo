import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS } from '../../game/data/levels';
import { useGameStore } from '../../store/useGameStore';
import { ReplayData } from '../../game/types';

export function MainMenu() {
  const navigate = useNavigate();
  const { startGame, getReplayList, deleteReplay } = useGameStore();
  const [showLevels, setShowLevels] = useState(false);
  const [showReplays, setShowReplays] = useState(false);
  const [replays] = useState<ReplayData[]>(getReplayList());

  const handleStartGame = (levelId: string) => {
    startGame(levelId);
    navigate(`/game/${levelId}`);
  };

  const handleViewReplay = (replayId: string) => {
    navigate(`/replay/${replayId}`);
  };

  const handleDeleteReplay = (replayId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteReplay(replayId);
    window.location.reload();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  if (showLevels) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          <button
            onClick={() => setShowLevels(false)}
            className="mb-6 text-slate-300 hover:text-white flex items-center gap-2"
          >
            ← 返回
          </button>

          <h2 className="text-4xl font-bold text-white mb-8 text-center">选择关卡</h2>

          <div className="grid md:grid-cols-3 gap-6">
            {LEVELS.map((level) => (
              <div
                key={level.id}
                onClick={() => handleStartGame(level.id)}
                className="bg-slate-800/80 rounded-2xl p-6 cursor-pointer transition-all transform hover:scale-105 hover:bg-slate-700/80 border border-slate-700 hover:border-blue-500"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">{level.name}</h3>
                  <div className="flex">
                    {Array.from({ length: level.difficulty }).map((_, i) => (
                      <span key={i} className="text-yellow-400">⭐</span>
                    ))}
                  </div>
                </div>
                <p className="text-slate-300 text-sm mb-4">{level.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">⏱️ {level.timeLimit}秒</span>
                  <span className="text-slate-400">👤 {level.victims.length}名伤员</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showReplays) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <button
            onClick={() => setShowReplays(false)}
            className="mb-6 text-slate-300 hover:text-white flex items-center gap-2"
          >
            ← 返回
          </button>

          <h2 className="text-4xl font-bold text-white mb-8 text-center">历史记录</h2>

          {replays.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-lg">暂无历史记录</p>
              <p className="text-slate-500 mt-2">完成一局游戏后将显示在这里</p>
            </div>
          ) : (
            <div className="space-y-4">
              {replays.map((replay) => {
                const level = LEVELS.find((l) => l.id === replay.levelId);
                return (
                  <div
                    key={replay.id}
                    onClick={() => handleViewReplay(replay.id)}
                    className="bg-slate-800/80 rounded-xl p-4 cursor-pointer transition-all hover:bg-slate-700/80 flex items-center justify-between group"
                  >
                    <div>
                      <h3 className="text-white font-medium">{level?.name || '未知关卡'}</h3>
                      <p className="text-slate-400 text-sm">{formatDate(replay.startTime)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-yellow-400 font-bold">{replay.finalScore} 分</span>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          replay.result === 'victory'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {replay.result === 'victory' ? '胜利' : '失败'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteReplay(replay.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            🏔️ 滑雪救援派遣
          </h1>
          <p className="text-xl text-slate-300 max-w-lg mx-auto">
            作为雪场救援调度员，在复杂的天气和地形条件下，
            合理派遣巡逻员，选择正确装备，拯救每一位伤员。
          </p>
        </div>

        <div className="space-y-4 max-w-xs mx-auto">
          <button
            onClick={() => setShowLevels(true)}
            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-green-600/30"
          >
            🎮 开始游戏
          </button>

          <button
            onClick={() => setShowReplays(true)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-blue-600/30"
          >
            📼 历史记录
          </button>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <h3 className="text-white font-semibold mb-1">路线规划</h3>
            <p className="text-slate-400 text-sm">选择最优救援路线</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">🎒</div>
            <h3 className="text-white font-semibold mb-1">装备匹配</h3>
            <p className="text-slate-400 text-sm">正确选择救援装备</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">⏱️</div>
            <h3 className="text-white font-semibold mb-1">时间压力</h3>
            <p className="text-slate-400 text-sm">在时间耗尽前完成救援</p>
          </div>
        </div>
      </div>
    </div>
  );
}
