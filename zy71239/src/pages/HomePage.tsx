import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, History, Trophy, Ticket, ChevronRight } from 'lucide-react';
import { Difficulty } from '../game/types';
import { useGameStore } from '../store/useGameStore';
import { getSessions } from '../utils/storage';
import { formatTime } from '../utils/export';
import { scoringEngine } from '../game/scoringEngine';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { startGame } = useGameStore();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal');
  const [history] = useState(() => getSessions());

  const difficulties: { value: Difficulty; label: string; desc: string; color: string }[] = [
    { value: 'easy', label: '简单', desc: '观众较少，违禁品明显', color: 'bg-success' },
    { value: 'normal', label: '普通', desc: '标准难度，推荐新手', color: 'bg-blue-500' },
    { value: 'hard', label: '困难', desc: '人多货杂，考验眼力', color: 'bg-warning' }
  ];

  const handleStart = () => {
    startGame(selectedDifficulty);
    navigate('/game');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="text-6xl mb-4">🎫</div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-vip to-warning bg-clip-text text-transparent">
            演唱会安检排队局
          </h1>
          <p className="text-gray-400 text-lg">志愿者安检培训模拟系统</p>
        </div>

        <div className="w-full max-w-md space-y-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="bg-navy-800/50 rounded-2xl p-6 border border-navy-700">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-vip" />
              选择难度
            </h3>
            <div className="space-y-3">
              {difficulties.map(d => (
                <button
                  key={d.value}
                  onClick={() => setSelectedDifficulty(d.value)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    selectedDifficulty === d.value
                      ? 'border-vip bg-vip/10'
                      : 'border-navy-600 hover:border-navy-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${d.color}`} />
                        <span className="font-medium">{d.label}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{d.desc}</p>
                    </div>
                    {selectedDifficulty === d.value && (
                      <ChevronRight className="w-5 h-5 text-vip" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full py-4 bg-gradient-to-r from-vip to-warning hover:opacity-90 
              rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
              shadow-lg shadow-vip/20 hover:shadow-vip/40"
          >
            <Play className="w-6 h-6" />
            开始游戏
          </button>
        </div>

        {history.length > 0 && (
          <div className="w-full max-w-md mt-8 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="bg-navy-800/50 rounded-2xl p-6 border border-navy-700">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" />
                历史记录
              </h3>
              <div className="space-y-3">
                {history.slice(0, 5).map(session => {
                  const rating = scoringEngine.getScoreRating(session.finalScore);
                  return (
                    <button
                      key={session.id}
                      onClick={() => navigate(`/replay/${session.id}`)}
                      className="w-full p-4 rounded-xl bg-navy-700/50 hover:bg-navy-700 
                        transition-all text-left flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Trophy className={`w-4 h-4 ${rating.color}`} />
                          <span className={`font-bold ${rating.color}`}>{rating.grade}</span>
                          <span className="text-sm text-gray-400">
                            {session.difficulty === 'easy' ? '简单' : 
                             session.difficulty === 'normal' ? '普通' : '困难'}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          <span>{session.totalAudience}人</span>
                          <span>{formatTime(session.duration)}</span>
                          <span>{new Date(session.endTime).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold">{session.finalScore}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 text-center text-gray-600 text-sm">
        快捷键：空格扫描 | F放行 | G拦截
      </div>
    </div>
  );
};

export default HomePage;
