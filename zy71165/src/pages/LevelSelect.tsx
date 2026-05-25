import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Lock, Trophy, PlayCircle, History } from 'lucide-react';
import { levels } from '../data/levels';
import { useGameStore } from '../store/useGameStore';

export const LevelSelect: React.FC = () => {
  const navigate = useNavigate();
  const { unlockedLevels, bestScores, gameRecords, loadRecords } = useGameStore();

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const renderStars = (difficulty: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < difficulty ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
      />
    ));
  };

  const handleLevelClick = (levelId: string) => {
    if (unlockedLevels.includes(levelId)) {
      navigate(`/game/${levelId}`);
    }
  };

  const handleViewReplays = () => {
    navigate('/replay-list');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-4">
            管道阀门解谜
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            隔离漏点，保护居民。通过开关阀门控制管网水流，在最小化影响的前提下完成抢修任务。
          </p>
        </div>

        <div className="flex justify-end mb-6">
          <button
            onClick={handleViewReplays}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 hover:text-white transition-all"
          >
            <History className="w-5 h-5" />
            <span>历史记录</span>
            <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
              {gameRecords.length}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {levels.map((level) => {
            const isUnlocked = unlockedLevels.includes(level.id);
            const bestScore = bestScores[level.id];

            return (
              <div
                key={level.id}
                onClick={() => handleLevelClick(level.id)}
                className={`relative group rounded-2xl overflow-hidden transition-all duration-300 ${
                  isUnlocked
                    ? 'cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20'
                    : 'cursor-not-allowed opacity-60'
                }`}
              >
                <div
                  className={`p-6 border-2 transition-all duration-300 ${
                    isUnlocked
                      ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-blue-500'
                      : 'bg-slate-800/50 border-slate-700'
                  }`}
                >
                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center z-10">
                      <Lock className="w-12 h-12 text-slate-500" />
                    </div>
                  )}

                  {bestScore !== undefined && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 bg-yellow-500/20 px-3 py-1 rounded-full">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 text-sm font-bold">
                        {bestScore}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold ${
                        isUnlocked
                          ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'
                          : 'bg-slate-700 text-slate-500'
                      }`}
                    >
                      {level.id.split('-')[1]}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{level.name}</h3>
                      <div className="flex items-center gap-1">
                        {renderStars(level.difficulty)}
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                    {level.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                      <div className="text-blue-400 font-bold text-lg">
                        {level.targetIsolatedLeaks}
                      </div>
                      <div className="text-slate-500 text-xs">漏点</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                      <div className="text-orange-400 font-bold text-lg">
                        {level.maxAffectedUsers}
                      </div>
                      <div className="text-slate-500 text-xs">最大影响</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                      <div className="text-green-400 font-bold text-lg">
                        {level.minPressure}+
                      </div>
                      <div className="text-slate-500 text-xs">最低压力</div>
                    </div>
                  </div>

                  {level.timeLimit && (
                    <div className="text-yellow-400 text-xs mb-3">
                      ⏱️ 限时 {level.timeLimit} 秒
                    </div>
                  )}
                  {level.maxSteps && (
                    <div className="text-purple-400 text-xs mb-3">
                      👣 限 {level.maxSteps} 步
                    </div>
                  )}

                  {isUnlocked && (
                    <div className="flex items-center justify-center gap-2 py-2 bg-blue-600 rounded-xl text-white font-medium group-hover:bg-blue-500 transition-all">
                      <PlayCircle className="w-5 h-5" />
                      <span>开始挑战</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">🎮 操作说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">点击阀门</h4>
                <p className="text-slate-400">点击管道上的阀门图标可以开关阀门</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">观察状态</h4>
                <p className="text-slate-400">实时查看压力、受影响用户等数据</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">隔离漏点</h4>
                <p className="text-slate-400">关闭阀门将漏点与水源切断即可隔离</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 flex-shrink-0">
                4
              </div>
              <div>
                <h4 className="text-white font-medium mb-1">提交结算</h4>
                <p className="text-slate-400">完成后点击提交查看得分和报告</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
