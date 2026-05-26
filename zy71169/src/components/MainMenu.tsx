import React from 'react';
import { Play, Trophy, Clock, Settings, History, Star } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { LEVELS } from '../game/levels';
import { useNavigate } from 'react-router-dom';

export default function MainMenu() {
  const navigate = useNavigate();
  const { sessions, startGame, setPhase } = useGameStore();

  const [showSettings, setShowSettings] = React.useState(false);

  const getBestScore = (levelId: string) => {
    const levelSessions = sessions.filter(s => s.levelId === levelId);
    if (levelSessions.length === 0) return 0;
    return Math.max(...levelSessions.map(s => s.totalScore));
  };

  const getRecentSessions = () => {
    return sessions.slice(0, 5);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const handleLevelSelect = (levelId: string) => {
    startGame(levelId);
    navigate(`/game/${levelId}`);
  };

  const handleFreePlay = () => {
    navigate('/training');
  };

  const formatDifficulty = (difficulty: number) => {
    return Array.from({ length: difficulty }, (_, i) => (
      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-800 mb-2">🍱 食堂备餐训练</h1>
          <p className="text-amber-600">选择关卡开始训练</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {LEVELS.map((level) => {
            const bestScore = getBestScore(level.id);
            return (
              <button
                key={level.id}
                onClick={() => handleLevelSelect(level.id)}
                className="group bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-2 border-transparent hover:border-amber-400 text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-amber-800">{level.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      {formatDifficulty(level.difficulty)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-amber-600 text-sm">
                      <Trophy className="w-4 h-4" />
                      <span className="font-semibold">{bestScore}</span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-3">{level.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {Math.floor(level.durationSeconds / 60)}分钟
                  </span>
                  <span>订单量: {level.orderCount}</span>
                  <span>窗口: {level.windowCount}</span>
                </div>
                <div className="mt-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1 bg-amber-400 text-white px-3 py-1 rounded-full text-sm font-medium">
                    <Play className="w-4 h-4" />
                    开始
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <button
              onClick={handleFreePlay}
              className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600 transition-all"
            >
              <Play className="w-10 h-10" />
              <span className="font-bold text-lg">自由训练</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-amber-800 flex items-center gap-2">
                <History className="w-5 h-5" />
                历史记录
              </h3>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            {getRecentSessions().length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">暂无对局记录</p>
            ) : (
              <div className="space-y-2">
                {getRecentSessions().map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-50 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-amber-800">{session.levelName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${session.result === 'win' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {session.result === 'win' ? '胜利' : '失败'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {session.totalScore}
                      </span>
                      <span className="text-xs">{formatTime(session.endTime)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="text-xl font-bold text-amber-800 mb-4">设置</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">音量</label>
                <input type="range" min="0" max="100" defaultValue="80" className="w-full accent-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">画质</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-amber-400">
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">操作方式</label>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-lg bg-amber-500 text-white font-medium">键鼠</button>
                  <button className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-600 font-medium">触屏</button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="mt-6 w-full py-2 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}