import React, { useState, useEffect } from 'react';
import { BookOpen, History, Droplets } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { levels } from '../data/levels';
import { LevelCard } from '../components/menu/LevelCard';
import { GameGuide } from '../components/menu/GameGuide';
import { useGameStore } from '../store/useGameStore';
import { Level } from '../types';
import { getGameRecords, getUnlockedLevels } from '../utils/scoring';

export const Menu: React.FC = () => {
  const navigate = useNavigate();
  const { startGame } = useGameStore();
  const [showGuide, setShowGuide] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [unlockedLevels, setUnlockedLevels] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unlocked = getUnlockedLevels();
    setUnlockedLevels(new Set(unlocked));
  }, []);

  const handleSelectLevel = (level: Level) => {
    startGame(level);
    navigate(`/game/${level.id}`);
  };

  const records = getGameRecords().slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg shadow-blue-500/30">
              <Droplets size={40} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-1">
                污水处理厂
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                  药剂投加模拟
                </span>
              </h1>
              <p className="text-slate-400">通过游戏学习药剂投加与水质指标的关系</p>
            </div>
          </div>
        </header>

        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
          >
            <BookOpen size={18} />
            游戏说明
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
          >
            <History size={18} />
            历史记录
          </button>
        </div>

        {showHistory && (
          <div className="mb-8 bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">历史游戏记录</h3>
            {records.length === 0 ? (
              <p className="text-slate-400 text-center py-8">暂无游戏记录，开始你的第一次游戏吧！</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors"
                  >
                    <div>
                      <span className="text-white font-medium">{record.levelName}</span>
                      <span className="text-slate-500 text-sm ml-3">
                        {new Date(record.endTime).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-mono ${record.success ? 'text-green-400' : 'text-red-400'}`}>
                        {record.score} 分
                      </span>
                      <span className="text-slate-400 text-sm">
                        回合 {record.roundsCompleted}/{record.maxRounds}
                      </span>
                      <button
                        onClick={() => navigate(`/replay/${record.id}`)}
                        className="px-3 py-1 text-sm bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                      >
                        回放
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">选择关卡</h2>
          <p className="text-slate-400 text-sm">完成前一关卡解锁后续挑战</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {levels.map((level, index) => (
            <LevelCard
              key={level.id}
              level={level}
              index={index}
              isUnlocked={unlockedLevels.has(level.id)}
              onSelect={handleSelectLevel}
            />
          ))}
        </div>

        <footer className="mt-16 text-center text-slate-500 text-sm">
          <p>环保培训模拟游戏 · 理解药剂投加与水质指标的关系</p>
        </footer>
      </div>

      <GameGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
};
