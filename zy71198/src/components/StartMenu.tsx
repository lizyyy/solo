import { Play, BookOpen, Clock, Wrench, Route } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

interface StartMenuProps {
  onShowHistory: () => void;
}

export default function StartMenu({ onShowHistory }: StartMenuProps) {
  const { startGame } = useGameStore();

  const levels = [
    { level: 1, name: '初级', desc: '6个故障点，1辆维修车', color: 'from-emerald-500 to-teal-500' },
    { level: 2, name: '中级', desc: '8个故障点，1辆维修车', color: 'from-sky-500 to-blue-500' },
    { level: 3, name: '高级', desc: '10个故障点，2辆维修车', color: 'from-amber-500 to-orange-500' },
    { level: 4, name: '专家', desc: '12个故障点，2辆维修车', color: 'from-red-500 to-rose-500' },
    { level: 5, name: '噩梦', desc: '14个故障点，3辆维修车', color: 'from-purple-500 to-pink-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/20 mb-4">
            <Wrench className="w-10 h-10 text-amber-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">城市路灯检修</h1>
          <p className="text-slate-400">夜间调度模拟器</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Play size={20} />
            选择关卡
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {levels.map((lvl) => (
              <button
                key={lvl.level}
                onClick={() => startGame(lvl.level)}
                className={`p-4 rounded-lg bg-gradient-to-br ${lvl.color} text-white text-left hover:scale-105 transition-transform shadow-lg`}
              >
                <div className="text-2xl font-bold mb-1">{lvl.name}</div>
                <div className="text-sm opacity-80">{lvl.desc}</div>
                <div className="mt-2 text-xs opacity-60">难度 {lvl.level}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BookOpen size={20} />
            游戏规则
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                <Route size={16} className="text-sky-400" />
              </div>
              <div>
                <div className="font-medium text-white">路线规划</div>
                <div className="text-slate-400">选择维修车后点击故障路灯派遣，路线会自动规划</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Wrench size={16} className="text-amber-400" />
              </div>
              <div>
                <div className="font-medium text-white">备件管理</div>
                <div className="text-slate-400">每盏路灯需要不同数量的备件，合理分配</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-red-400" />
              </div>
              <div>
                <div className="font-medium text-white">时间紧迫</div>
                <div className="text-slate-400">高优先级路灯超时扣分更多，注意优先级</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Play size={16} className="text-emerald-400" />
              </div>
              <div>
                <div className="font-medium text-white">效率得分</div>
                <div className="text-slate-400">提前完成维修有额外奖励，避免空驶和浪费</div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onShowHistory}
          className="w-full py-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
        >
          <BookOpen size={18} />
          历史记录
        </button>
      </div>
    </div>
  );
}
