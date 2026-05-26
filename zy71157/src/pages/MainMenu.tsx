import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Play, History, HelpCircle, Trophy, Lock, ChevronRight } from 'lucide-react';
import { levelConfigs } from '@/utils/levelConfigs';
import { loadGameProgress, loadGameRecords } from '@/utils/reportGenerator';

export const MainMenu = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState({ clearedLevels: [] as number[], highScores: {} as Record<number, number> });
  const [totalGames, setTotalGames] = useState(0);

  useEffect(() => {
    const prog = loadGameProgress();
    setProgress({
      clearedLevels: Array.isArray(prog.clearedLevels) ? prog.clearedLevels : [],
      highScores: prog.highScores || {},
    });
    const records = loadGameRecords();
    setTotalGames(records.length);
  }, []);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-900/30 border-green-700/50';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50';
      case 'hard': return 'text-red-400 bg-red-900/30 border-red-700/50';
      default: return 'text-gray-400 bg-gray-800 border-gray-700';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '简单';
      case 'medium': return '中等';
      case 'hard': return '困难';
      default: return '未知';
    }
  };

  const isLevelUnlocked = (levelId: number) => {
    if (levelId === 1) return true;
    return Array.isArray(progress.clearedLevels) && progress.clearedLevels.includes(levelId - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950/30 to-gray-950 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-3xl mb-6 shadow-2xl shadow-blue-600/30">
          <Plane className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
          机场行李分拣模拟器
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          扮演机场地服人员，准确分拣行李，处理转机、超规件和延误航班
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
        {levelConfigs.map((level, index) => {
          const unlocked = isLevelUnlocked(level.id);
          const cleared = progress.clearedLevels.includes(level.id);
          const highScore = progress.highScores[level.id] || 0;

          return (
            <div
              key={level.id}
              className={`relative bg-gray-900/80 backdrop-blur-sm rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
              unlocked
                ? 'border-gray-700 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-600/20 hover:-translate-y-1 cursor-pointer'
                : 'border-gray-800 opacity-60 cursor-not-allowed'
            }`}
              onClick={() => unlocked && navigate(`/game/${level.id}`)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(level.difficulty)}`}>
                  {getDifficultyText(level.difficulty)}
                </span>
                {!unlocked && <Lock className="w-5 h-5 text-gray-500" />}
                {cleared && (
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-medium">已通关</span>
                  </div>
                )}
              </div>

              <h3 className="text-2xl font-bold mb-2 text-white">{level.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{level.description}</p>

              <div className="space-y-2 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-500">时间限制</span>
                  <span className="text-gray-300 font-mono">
                    {Math.floor(level.timeLimit / 60)}分{level.timeLimit % 60}秒
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">行李类型</span>
                  <span className="text-gray-300">
                    {level.baggageTypes.map(t => 
                      t === 'normal' ? '普通' : t === 'transfer' ? '转机' : '超规'
                    ).join('、')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">航班口数</span>
                  <span className="text-gray-300 font-mono">{level.gates.filter(g => g.type === 'normal').length}个</span>
                </div>
                {highScore > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">最高分</span>
                    <span className="text-yellow-400 font-mono font-bold">{highScore.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                <div className="text-xs text-gray-400 mb-2">通关条件</div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                    准确率≥{level.passConditions.minAccuracy * 100}%
                  </span>
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                    错误≤{level.passConditions.maxErrors}
                  </span>
                </div>
              </div>

              <button
                disabled={!unlocked}
                className={`w-full py-3 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                  unlocked
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {unlocked ? (
                  <>
                    <Play className="w-5 h-5" />
                    开始游戏
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    完成上一关解锁
                  </>
                )}
              </button>
            </div>

            {index < levelConfigs.length - 1 && unlocked && !cleared && (
              <div className="absolute -right-8 top-1/2 transform -translate-y-1/2 hidden md:flex">
                <ChevronRight className="w-8 h-8 text-gray-600" />
              </div>
            )}
          </div>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-white font-medium"
        >
          <History className="w-5 h-5" />
          历史记录
          {totalGames > 0 && (
            <span className="bg-blue-600 text-xs px-2 py-0.5 rounded-full">{totalGames}</span>
          )}
        </button>
        <button
          onClick={() => navigate('/help')}
          className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-white font-medium"
        >
          <HelpCircle className="w-5 h-5" />
          游戏帮助
        </button>
      </div>

      <div className="mt-16 max-w-3xl mx-auto">
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800">
          <h3 className="text-xl font-bold text-white mb-4 text-center">游戏特色</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Plane className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="font-bold text-white mb-1">真实规则</h4>
              <p className="text-sm text-gray-400">模拟真实机场行李分拣流程</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-6 h-6 text-orange-400" />
              </div>
              <h4 className="font-bold text-white mb-1">三种难度</h4>
              <p className="text-sm text-gray-400">从简单到复杂逐步提升</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <History className="w-6 h-6 text-green-400" />
              </div>
              <h4 className="font-bold text-white mb-1">回放系统</h4>
              <p className="text-sm text-gray-400">记录每一局，支持错误回放</p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-12 text-gray-500 text-sm">
        <p>提示：点击黄色切换器改变传送带方向，将行李送到正确的航班口</p>
      </div>
    </div>
    </div>
  );
};
