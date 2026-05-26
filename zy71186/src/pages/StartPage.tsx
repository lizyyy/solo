import { useNavigate } from 'react-router-dom';
import { Play, Droplets, Waves, AlertTriangle, Target } from 'lucide-react';
import { getLevels } from '../engine/levels';
import type { Difficulty } from '../engine/types';
import { useGameStore } from '../store/useGameStore';

const difficultyColors: Record<Difficulty, string> = {
  easy: 'bg-green-600',
  medium: 'bg-amber-600',
  hard: 'bg-red-600',
};

const difficultyLabels: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export function StartPage() {
  const navigate = useNavigate();
  const levels = getLevels();
  const { selectLevel, startGame } = useGameStore();

  const handleLevelSelect = (levelId: string) => {
    const level = levels.find(l => l.id === levelId);
    if (level) {
      selectLevel(level);
      startGame();
      navigate('/game');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Droplets className="w-12 h-12 text-blue-500" />
            <h1 className="text-4xl font-bold text-white">水库调度闸门游戏</h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            在上游来水、下游安全和水库蓄水之间做出明智的取舍。
            学习水利调度的核心原理，理解"开闸过猛、下游超警、蓄水不足"的调度难点。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">保持库容</h3>
            <p className="text-slate-400 text-sm">
              游戏结束时水库库容需维持在正常范围，既要避免漫坝风险，也要防止蓄水放空。
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
              <Waves className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">保护下游</h3>
            <p className="text-slate-400 text-sm">
              控制下泄流量不超过下游安全标准。超警时间过长会导致溃坝，游戏失败。
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="w-12 h-12 bg-amber-600/20 rounded-lg flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">平稳调度</h3>
            <p className="text-slate-400 text-sm">
              频繁大幅调节闸门会影响稳定性评分。提前预判来水变化，做出精准决策。
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-6">选择关卡</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {levels.map((level) => (
            <div
              key={level.id}
              className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-blue-500 transition-all cursor-pointer group"
              onClick={() => handleLevelSelect(level.id)}
            >
              <div className="h-2 bg-slate-700">
                <div
                  className={`h-full ${difficultyColors[level.difficulty]}`}
                  style={{ width: `${level.duration / 1.2}%` }}
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">{level.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs text-white ${difficultyColors[level.difficulty]}`}>
                    {difficultyLabels[level.difficulty]}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-4">{level.description}</p>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>时长: {level.duration}h</span>
                  <span>最大流量: {level.maxDischarge} m³/s</span>
                </div>
                <button className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all group-hover:shadow-lg group-hover:shadow-blue-500/20">
                  <Play size={18} />
                  开始游戏
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>💡 提示：使用滑块控制闸门开度，观察来水曲线预判洪水到来时机</p>
        </div>
      </div>
    </div>
  );
}
