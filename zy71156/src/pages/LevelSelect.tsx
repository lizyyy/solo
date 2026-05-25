import { LEVELS } from '@/config/levels';
import { useGameStore } from '@/store/gameStore';
import { Building2, Clock, Users, Wrench, Star, Play, Info } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LevelConfig } from '@/types/game';

export default function LevelSelect() {
  const startGame = useGameStore((state) => state.startGame);
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);

  const handleStartGame = (level: LevelConfig) => {
    startGame(level);
    navigate('/game');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'hard':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '简单';
      case 'medium':
        return '中等';
      case 'hard':
        return '困难';
      default:
        return difficulty;
    }
  };

  const getDifficultyStars = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 1;
      case 'medium':
        return 2;
      case 'hard':
        return 3;
      default:
        return 1;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1e3d] via-[#1a2a4a] to-[#0f1e3d] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 text-[#ff8a00] font-mono tracking-wider">
            电梯救援协作
          </h1>
          <p className="text-xl text-gray-300 mb-2">物业培训模拟系统</p>
          <p className="text-sm text-gray-400">
            派遣维保队 · 安抚乘客 · 控制楼层 · 完成救援
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setShowRules(!showRules)}
            className="flex items-center gap-2 px-6 py-3 bg-[#1a2a4a] hover:bg-[#2a3a5a] rounded-lg transition-all border border-[#ff8a00]/30"
          >
            <Info size={20} />
            游戏规则
          </button>
        </div>

        {showRules && (
          <div className="mb-8 p-6 bg-[#1a2a4a] rounded-xl border border-[#ff8a00]/30">
            <h3 className="text-xl font-bold mb-4 text-[#ff8a00]">游戏规则</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-bold mb-2 text-white">🎯 游戏目标</h4>
                  <ul className="space-y-1 text-gray-300">
                    <li>• 在规定时间内救援所有故障电梯中的乘客</li>
                    <li>• 或达到关卡要求的分数阈值</li>
                    <li>• 合理调度维保队，避免冲突</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-white">⚡ 核心操作</h4>
                  <ul className="space-y-1 text-gray-300">
                    <li>• <span className="text-[#ff8a00]">维保派遣</span>：点击队伍 → 点击故障电梯</li>
                    <li>• <span className="text-[#4caf50]">安抚乘客</span>：点击"安抚乘客"按钮派遣队伍</li>
                    <li>• <span className="text-[#2196f3]">停靠管制</span>：将电梯锁定在指定楼层</li>
                    <li>• <span className="text-[#9c27b0]">故障诊断</span>：判断故障类型获得额外分数</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-white">📊 计分规则</h4>
                  <ul className="space-y-1 text-gray-300">
                    <li>• 成功救援：+200~500 分（根据关卡）</li>
                    <li>• 维保队冲突：-50~200 分</li>
                    <li>• 乘客恐慌：-100~400 分</li>
                    <li>• 故障误报：-50 分</li>
                    <li>• <span className="text-[#4caf50]">成功安抚：+30 分</span></li>
                    <li>• <span className="text-[#9c27b0]">诊断正确：+100 分，错误：-50 分</span></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-white">⚠️ 失败条件</h4>
                  <ul className="space-y-1 text-gray-300">
                    <li>• 乘客等待时间超过 90 秒</li>
                    <li>• 时间结束仍有未救援故障</li>
                    <li>• 未达到分数阈值</li>
                  </ul>
                  <h4 className="font-bold mb-2 text-white mt-3">🏆 胜利条件</h4>
                  <ul className="space-y-1 text-gray-300">
                    <li>• 所有故障电梯救援完成（即时胜利）</li>
                    <li>• 达到目标分数（即时胜利）</li>
                    <li>• 时间结束时达成胜利条件</li>
                  </ul>
                </div>
              </div>
          </div>
        )}

        <h2 className="text-2xl font-bold mb-6 text-center">选择关卡</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {LEVELS.map((level: LevelConfig) => (
            <div
              key={level.id}
              className="group bg-[#1a2a4a] rounded-xl p-6 border border-[#ff8a00]/20 hover:border-[#ff8a00] hover:shadow-lg hover:shadow-[#ff8a00]/10 transition-all cursor-pointer transform hover:-translate-y-1"
              onClick={() => handleStartGame(level)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-[#ff8a00] transition-colors">
                    {level.name}
                  </h3>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < getDifficultyStars(level.difficulty) ? 'text-[#ff8a00] fill-[#ff8a00]' : 'text-gray-600'}
                      />
                    ))}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${getDifficultyColor(level.difficulty)}`}>
                      {getDifficultyText(level.difficulty)}
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-[#ff8a00]/20 rounded-lg group-hover:bg-[#ff8a00]/30 transition-colors">
                  <Play size={20} className="text-[#ff8a00]" />
                </div>
              </div>

              <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                {level.description}
              </p>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Building2 size={16} className="text-[#4caf50]" />
                  <span>{level.floorCount} 层</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Wrench size={16} className="text-[#ff8a00]" />
                  <span>{level.elevatorCount} 部电梯</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Users size={16} className="text-[#2196f3]" />
                  <span>{level.teamCount} 支维保队</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock size={16} className="text-[#ff4d4d]" />
                  <span>{level.gameDuration} 秒</span>
                </div>
              </div>

              <button
                className="w-full mt-4 py-2 bg-[#ff8a00] hover:bg-[#ff9a20] rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartGame(level);
                }}
              >
                <Play size={18} />
                开始游戏
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>提示：点击维保队，再点击故障电梯完成派遣</p>
        </div>
      </div>
    </div>
  );
}
