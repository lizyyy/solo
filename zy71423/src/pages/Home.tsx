import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { functionCards } from '../data/functionCards';
import { FunctionCardComponent } from '../components/FunctionCardComponent';
import { Play, Filter, Info, Zap, Target, TrendingUp } from 'lucide-react';

export const Home = () => {
  const { selectedFunctionCard, selectFunctionCard, setScreen } = useGameStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');

  const typeLabels: Record<string, string> = {
    all: '全部',
    linear: '线性函数',
    quadratic: '二次函数',
    piecewise: '分段函数',
    trigonometric: '三角函数',
  };

  const difficultyLabels: Record<string, string> = {
    all: '全部',
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };

  const filteredCards = functionCards.filter((card) => {
    const typeMatch = filterType === 'all' || card.type === filterType;
    const difficultyMatch =
      filterDifficulty === 'all' || card.difficulty === filterDifficulty;
    return typeMatch && difficultyMatch;
  });

  const handleStartGame = () => {
    if (selectedFunctionCard) {
      setScreen('game');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full mb-6">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-medium">数学 × 游戏</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 font-orbitron">
            函数怪兽躲避战
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            沿函数曲线移动，根据斜率提示避开不可导陷阱。
            在操作中感受数学的取舍，让学习成为一种乐趣。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">斜率实时反馈</h3>
            <p className="text-slate-400 text-sm">
              实时计算当前点的斜率和可导性，用颜色和文字直观显示，帮助你快速判断前方是否有陷阱。
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">不可导陷阱</h3>
            <p className="text-slate-400 text-sm">
              角点、尖点、间断点、垂直切线... 各种不可导陷阱等着你去挑战，减速通过可获得额外分数。
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
              <Info className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">完整记录系统</h3>
            <p className="text-slate-400 text-sm">
              每一步操作都被记录，异常情况单独列出，支持补录、撤回、标记重复，批次报告一目了然。
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white font-orbitron">
            选择函数卡
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {Object.entries(difficultyLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredCards.map((card) => (
            <FunctionCardComponent
              key={card.id}
              card={card}
              selected={selectedFunctionCard?.id === card.id}
              onClick={() => selectFunctionCard(card)}
            />
          ))}
        </div>

        {selectedFunctionCard && (
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 p-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-cyan-400 font-bold text-xl font-orbitron">
                    {selectedFunctionCard.name.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-white font-bold">{selectedFunctionCard.name}</p>
                  <p className="text-sm text-cyan-400 font-mono">
                    {selectedFunctionCard.expression}
                  </p>
                </div>
              </div>
              <button
                onClick={handleStartGame}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-xl text-lg font-bold hover:from-cyan-500 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105"
              >
                <Play className="w-6 h-6" />
                开始游戏
              </button>
            </div>
          </div>
        )}

        {selectedFunctionCard && <div className="h-24" />}
      </div>
    </div>
  );
};
