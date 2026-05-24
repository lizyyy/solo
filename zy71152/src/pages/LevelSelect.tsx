import { levels } from '../data/levels';
import { Train, Clock, AlertTriangle } from 'lucide-react';

interface LevelSelectProps {
  onSelectLevel: (levelId: number) => void;
  onViewReplays: () => void;
}

export default function LevelSelect({ onSelectLevel, onViewReplays }: LevelSelectProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'medium':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'hard':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '简单';
      case 'medium':
        return '中等';
      case 'hard':
        return '困难';
      default:
        return '未知';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center">
              <Train className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            铁路信号调度
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            扮演调度员，控制信号灯，避免区间冲突，确保列车安全正点运行
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {levels.map((level) => (
            <button
              key={level.id}
              onClick={() => onSelectLevel(level.id)}
              className="group bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-blue-500/50 rounded-2xl p-6 text-left transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-slate-700 group-hover:bg-blue-600/30 rounded-xl flex items-center justify-center transition-colors">
                  <span className="text-2xl font-bold text-slate-300 group-hover:text-blue-400">
                    {level.id}
                  </span>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getDifficultyColor(level.difficulty)}`}>
                  {getDifficultyLabel(level.difficulty)}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                {level.name}
              </h3>
              <p className="text-sm text-slate-400 mb-4 line-clamp-3">
                {level.description}
              </p>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Train className="w-4 h-4" />
                  <span>{level.trains.length} 列车</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{level.timeLimit} 时间</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{level.sections.filter(s => s.maintenance.length > 0).length} 检修</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={onViewReplays}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 rounded-xl text-slate-300 hover:text-white transition-colors"
          >
            <Clock className="w-5 h-5" />
            查看历史回放
          </button>
        </div>

        <div className="mt-12 bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">游戏规则</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-400">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs">1</span>
              </div>
              <p>点击信号灯可切换：红 → 黄 → 绿 → 红</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs">2</span>
              </div>
              <p>绿灯允许通行，黄灯需要减速，红灯必须停车</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs">3</span>
              </div>
              <p>同一区间不能同时有多列列车</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-emerald-400 text-xs">4</span>
              </div>
              <p>红色轨道为检修区间，禁止列车进入</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
