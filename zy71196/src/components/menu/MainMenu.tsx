import { useState } from 'react';
import { LEVELS } from '../../game/config';
import { loadGameRecords, getBestScore } from '../../game/replay';
import type { Difficulty } from '../../game/types';

interface MainMenuProps {
  onStartGame: (levelId: number) => void;
  onViewRecords: () => void;
}

const difficultyColors: Record<Difficulty, string> = {
  easy: 'bg-green-500',
  medium: 'bg-yellow-500',
  hard: 'bg-red-500',
};

const difficultyLabels: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export function MainMenu({ onStartGame, onViewRecords }: MainMenuProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all');
  const records = loadGameRecords();

  const filteredLevels = selectedDifficulty === 'all'
    ? LEVELS
    : LEVELS.filter((l) => l.difficulty === selectedDifficulty);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
          屋顶排水巡检
        </h1>
        <p className="text-xl text-slate-400">
          在暴雨来临前，排查并处理屋顶排水隐患
        </p>
      </div>

      <div className="flex gap-4 mb-8">
        {(['all', 'easy', 'medium', 'hard'] as const).map((diff) => (
          <button
            key={diff}
            onClick={() => setSelectedDifficulty(diff)}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              selectedDifficulty === diff
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {diff === 'all' ? '全部' : difficultyLabels[diff]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full mb-8">
        {filteredLevels.map((level) => {
          const bestScore = getBestScore(level.id);
          const levelRecords = records.filter((r) => r.levelId === level.id);
          
          return (
            <div
              key={level.id}
              className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-blue-500 transition-all cursor-pointer group"
              onClick={() => onStartGame(level.id)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
                    {level.name}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    第 {level.id} 关
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium text-white ${difficultyColors[level.difficulty]}`}
                >
                  {difficultyLabels[level.difficulty]}
                </span>
              </div>

              <p className="text-slate-300 text-sm mb-4 min-h-[40px]">
                {level.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-slate-400">排水口</p>
                  <p className="text-white font-bold text-lg">{level.drainCount}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-slate-400">低洼区</p>
                  <p className="text-white font-bold text-lg">{level.lowAreaCount}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-slate-400">回合数</p>
                  <p className="text-white font-bold text-lg">{level.totalRounds}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-slate-400">行动点</p>
                  <p className="text-white font-bold text-lg">{level.maxActionPoints}</p>
                </div>
              </div>

              {bestScore !== null && (
                <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                  <span className="text-slate-400 text-sm">最佳成绩</span>
                  <span className="text-yellow-400 font-bold">{bestScore} 分</span>
                </div>
              )}

              <button
                className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                开始游戏
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={onViewRecords}
        className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
      >
        查看历史记录
      </button>

      <div className="mt-12 text-center text-slate-500 text-sm max-w-xl">
        <p className="mb-2">游戏说明：</p>
        <p>使用巡检工具检查排水口和低洼区，发现堵塞或积水后使用疏通和抽水工具处理。</p>
        <p>每回合结束会模拟降雨，积水溢出会导致漏水失败。合理分配行动点数，优先处理高风险区域。</p>
      </div>
    </div>
  );
}
