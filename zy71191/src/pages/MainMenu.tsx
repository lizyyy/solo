import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { LEVELS } from '@/data/levels';
import { Play, FileText } from 'lucide-react';

export default function MainMenu() {
  const state = useGameStore();
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  const handleStartGame = (levelId: number) => {
    state.startGame(levelId);
    navigate(`/game/${levelId}`);
  };

  const handleReplay = (levelId: number) => {
    navigate(`/replay/${levelId}`);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-emerald-900/50 text-emerald-400';
      case 'medium':
        return 'bg-amber-900/50 text-amber-400';
      case 'hard':
        return 'bg-red-900/50 text-red-400';
      default:
        return 'bg-slate-700 text-slate-400';
    }
  };

  const getDifficultyStars = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '★☆☆';
      case 'medium':
        return '★★☆';
      case 'hard':
        return '★★★';
      default:
        return '☆☆☆';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">
            展会搭建进度游戏
          </h1>
          <p className="text-slate-400">
            培训项目助理的展会搭建排程模拟器
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {LEVELS.map((level) => (
            <div
              key={level.id}
              className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-sky-500 transition-all cursor-pointer"
              onClick={() => setSelectedLevel(level.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl font-bold text-white">{level.id}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(level.difficulty)}`}>
                  {getDifficultyStars(level.difficulty)}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">
                {level.name}
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                {level.description}
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">展位数量</span>
                  <span className="text-slate-300">{level.boothCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">施工队</span>
                  <span className="text-slate-300">{level.crewCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">限定回合</span>
                  <span className="text-slate-300">{level.maxTurns}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedLevel !== null && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-sky-500/50">
            <h3 className="text-lg font-semibold text-white mb-4">
              选择操作 - {LEVELS.find((l) => l.id === selectedLevel)?.name}
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => handleStartGame(selectedLevel)}
                className="flex-1 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Play size={18} />
                开始游戏
              </button>
              <button
                onClick={() => handleReplay(selectedLevel)}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
                disabled
              >
                <FileText size={18} />
                历史回放（需要完成记录）
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-slate-800/30 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-400 mb-2">游戏说明</h4>
          <ul className="text-xs text-slate-500 space-y-1">
            <li>• 按顺序推进：水电 → 展架 → 消防，每个阶段完成后才能申请对应验收</li>
            <li>• 合理分配施工队，避免任务冲突</li>
            <li>• 关注材料到货时间，提前安排施工计划</li>
            <li>• 目标：在限定回合内完成所有验收并获得最高分</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
