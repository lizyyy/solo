import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { levels, failOperationDemo } from '@/data/levels';
import { Difficulty } from '@/types';
import { useGameStore } from '@/store/gameStore';
import { Play, CheckCircle, Star, Info, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Home() {
  const navigate = useNavigate();
  const { completedLevels, setCurrentLevel } = useGameStore();
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all');
  const [showDemoInfo, setShowDemoInfo] = useState(false);

  const filteredLevels =
    selectedDifficulty === 'all'
      ? levels
      : levels.filter((l) => l.difficulty === selectedDifficulty);

  const handleLevelClick = (levelId: string) => {
    setCurrentLevel(levelId);
    navigate(`/game/${levelId}`);
  };

  const difficultyColors: Record<Difficulty, string> = {
    easy: 'bg-green-500',
    medium: 'bg-yellow-500',
    hard: 'bg-red-500',
  };

  const difficultyLabels: Record<Difficulty, string> = {
    easy: '入门',
    medium: '进阶',
    hard: '专家',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            量子门电路拼装
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            通过拖拽量子门构建电路，观察测量概率分布，学习量子计算的核心原理
          </p>
        </header>

        <div className="mb-8 bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            快速体验
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleLevelClick('demo-correct')}
              className="p-4 bg-gradient-to-r from-green-600/20 to-cyan-600/20 rounded-lg border border-green-500/30 hover:border-green-400/50 transition-all text-left group"
            >
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <span className="text-white font-semibold">正确示范</span>
              </div>
              <p className="text-slate-400 text-sm">
                Bell态构建 - 学习正确的量子电路构建方式
              </p>
            </button>
            <button
              onClick={() => {
                handleLevelClick('demo-wrong');
                setShowDemoInfo(true);
              }}
              className="p-4 bg-gradient-to-r from-red-600/20 to-orange-600/20 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-all text-left group"
            >
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <span className="text-white font-semibold">错误示范</span>
              </div>
              <p className="text-slate-400 text-sm">
                典型错误案例 - 观察系统如何检测各类错误
              </p>
            </button>
          </div>

          {showDemoInfo && (
            <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-600">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                失败操作示例说明
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-red-400 text-sm font-medium">1. 门顺序错误</div>
                  <div className="text-slate-400 text-xs">{failOperationDemo.gateOrderError.description}</div>
                </div>
                <div>
                  <div className="text-red-400 text-sm font-medium">2. 概率未归一</div>
                  <div className="text-slate-400 text-xs">{failOperationDemo.normalizationError.description}</div>
                </div>
                <div>
                  <div className="text-red-400 text-sm font-medium">3. 噪声未扣除</div>
                  <div className="text-slate-400 text-xs">{failOperationDemo.noiseError.description}</div>
                </div>
              </div>
              <button
                onClick={() => setShowDemoInfo(false)}
                className="mt-3 text-sm text-cyan-400 hover:text-cyan-300"
              >
                收起详情
              </button>
            </div>
          )}
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">关卡选择</h2>
          <div className="flex gap-2">
            {(['all', 'easy', 'medium', 'hard'] as const).map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={cn(
                  'px-3 py-1 rounded-full text-sm transition-all',
                  selectedDifficulty === diff
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                )}
              >
                {diff === 'all' ? '全部' : difficultyLabels[diff]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLevels.map((level) => {
            const isCompleted = completedLevels.includes(level.id);
            const isDemo = level.id.startsWith('demo');

            return (
              <div
                key={level.id}
                onClick={() => !isDemo && handleLevelClick(level.id)}
                className={cn(
                  'relative bg-slate-800/50 rounded-xl p-5 backdrop-blur-sm border transition-all cursor-pointer group',
                  isDemo ? 'opacity-50 cursor-not-allowed' : 'hover:border-cyan-400/50 hover:bg-slate-800/70',
                  'border-slate-700',
                  isCompleted && 'border-green-500/50'
                )}
              >
                {isCompleted && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('w-2 h-2 rounded-full', difficultyColors[level.difficulty])}></span>
                  <span className="text-xs text-slate-400 uppercase">{difficultyLabels[level.difficulty]}</span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                  {level.name}
                </h3>
                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{level.description}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{level.qubits} 量子位</span>
                    <span>•</span>
                    <span>{level.slots} 槽位</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-white">{level.maxScore}</span>
                  </div>
                </div>

                {!isDemo && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-cyan-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-4 h-4" />
                    开始挑战
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-slate-800/30 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">游戏说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-cyan-400 font-semibold mb-2">1. 构建电路</div>
              <p className="text-slate-400 text-sm">从门库拖拽量子门到电路中，按正确顺序排列以实现目标量子态</p>
            </div>
            <div>
              <div className="text-cyan-400 font-semibold mb-2">2. 观察概率</div>
              <p className="text-slate-400 text-sm">实时查看测量概率分布，与目标概率对比调整电路</p>
            </div>
            <div>
              <div className="text-cyan-400 font-semibold mb-2">3. 验证提交</div>
              <p className="text-slate-400 text-sm">提交答案后系统会检测门顺序、概率归一和噪声抵消情况</p>
            </div>
          </div>
        </div>

        <footer className="mt-12 text-center text-slate-500 text-sm">
          <p>量子计算科普教育工具 | 拖拽式学习量子门电路</p>
        </footer>
      </div>
    </div>
  );
}
