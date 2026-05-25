import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, History, BookOpen, Lock, Trophy, ChevronRight, Info, X } from 'lucide-react';
import { levels } from '../data/levels';
import { useGameStore } from '../store/gameStore';
import { StarRating } from '../components/StarRating';

export const MainMenu = () => {
  const navigate = useNavigate();
  const { unlockedLevels, levelScores, loadProgress } = useGameStore();
  const [showRules, setShowRules] = useState(false);
  
  useState(() => {
    loadProgress();
  });
  
  const handleStartLevel = (levelId: string) => {
    if (!unlockedLevels.includes(levelId)) return;
    navigate(`/game/${levelId}`);
  };
  
  const getDifficultyStars = (difficulty: number) => {
    return '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <Package size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            仓库装箱排序游戏
          </h1>
          <p className="text-gray-600 text-lg">电商仓储培训模拟器</p>
        </header>
        
        <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <BookOpen size={24} className="text-blue-500" />
            <span className="font-semibold text-gray-700">规则说明</span>
          </button>
          
          <button
            onClick={() => navigate('/history')}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <History size={24} className="text-purple-500" />
            <span className="font-semibold text-gray-700">历史记录</span>
          </button>
          
          <div className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-md text-white">
            <Trophy size={24} />
            <div className="text-left">
              <div className="text-xs opacity-80">已解锁</div>
              <div className="font-bold">{unlockedLevels.length} / {levels.length} 关</div>
            </div>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Package size={28} className="text-blue-500" />
            选择关卡
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {levels.map((level, index) => {
              const isUnlocked = unlockedLevels.includes(level.id);
              const bestScore = levelScores[level.id] || 0;
              const stars = bestScore >= 90 ? 3 : bestScore >= 80 ? 2 : bestScore >= 60 ? 1 : 0;
              
              return (
                <div
                  key={level.id}
                  onClick={() => handleStartLevel(level.id)}
                  className={`
                    relative bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300
                    ${isUnlocked ? 'cursor-pointer hover:shadow-xl hover:-translate-y-2' : 'opacity-60 cursor-not-allowed'}
                  `}
                >
                  <div className={`h-2 ${isUnlocked ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                            关卡 {index + 1}
                          </span>
                          {!isUnlocked && <Lock size={16} className="text-gray-400" />}
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">{level.name}</h3>
                      </div>
                      <div className="text-yellow-500 text-sm font-mono">
                        {getDifficultyStars(level.difficulty)}
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4">{level.description}</p>
                    
                    {level.specialRule && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-4">
                        <div className="flex items-center gap-1 text-orange-600 text-xs">
                          <Info size={12} />
                          <span className="font-medium">{level.specialRule}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div>
                        {isUnlocked && bestScore > 0 && (
                          <div className="flex items-center gap-2">
                            <StarRating rating={stars} maxRating={3} size={16} />
                            <span className="text-sm text-gray-500">{bestScore}分</span>
                          </div>
                        )}
                        {isUnlocked && bestScore === 0 && (
                          <span className="text-sm text-gray-400">未挑战</span>
                        )}
                      </div>
                      
                      {isUnlocked && (
                        <div className="flex items-center gap-1 text-blue-500 font-medium text-sm">
                          开始 <ChevronRight size={16} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>提示：重物不压易碎，时效件优先，空间利用率≥70%</p>
        </footer>
      </div>
      
      {showRules && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">游戏规则</h3>
              <button
                onClick={() => setShowRules(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <section>
                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">1</span>
                  商品属性
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="font-medium">重量等级：</span>
                    <span className="text-green-600">轻</span> / 
                    <span className="text-orange-600"> 中</span> / 
                    <span className="text-red-600"> 重</span> / 
                    <span className="text-gray-600"> 超重</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="font-medium">易碎等级：</span>
                    <span className="text-gray-600">普通</span> / 
                    <span className="text-orange-600"> 易碎</span> / 
                    <span className="text-red-600"> 极易碎</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="font-medium">时效等级：</span>
                    <span className="text-gray-600">普通</span> / 
                    <span className="text-purple-600"> 次日达</span> / 
                    <span className="text-blue-600"> 当日达</span> / 
                    <span className="text-red-600"> 特快</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="font-medium">操作方式：</span>
                    <span className="text-gray-600">左键拖拽放置，右键移除</span>
                  </div>
                </div>
              </section>
              
              <section>
                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">2</span>
                  装箱规则
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span><strong className="text-red-600">重物不压易碎：</strong>重量≥中等的商品不能放在易碎品上方，累计2次直接失败</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span><strong className="text-red-600">易碎品在上：</strong>易碎品只能放在最上层或非易碎品上方，被压直接失败</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">•</span>
                    <span><strong className="text-orange-600">时效优先：</strong>时效等级高的商品应放在易取位置（上层或外侧），累计3次失败</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">•</span>
                    <span><strong className="text-orange-600">空间利用率：</strong>实际占用体积/箱容积 ≥ 70%，低于70%扣20分</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 mt-0.5">•</span>
                    <span><strong className="text-orange-600">重心稳定：</strong>重物应放在底部，重心偏移超过30%扣40分</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span><strong className="text-red-600">重量限制：</strong>总重量不能超过箱型最大承重，超重直接失败</span>
                  </li>
                </ul>
              </section>
              
              <section>
                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">3</span>
                  评分标准
                </h4>
                <div className="grid grid-cols-5 gap-2 text-center text-sm">
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <div className="text-yellow-600 font-bold">S级</div>
                    <div className="text-gray-600">90-100分</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-green-600 font-bold">A级</div>
                    <div className="text-gray-600">80-89分</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-blue-600 font-bold">B级</div>
                    <div className="text-gray-600">70-79分</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="text-orange-600 font-bold">C级</div>
                    <div className="text-gray-600">60-69分</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-red-600 font-bold">F级</div>
                    <div className="text-gray-600">＜60分</div>
                  </div>
                </div>
              </section>
              
              <section>
                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">4</span>
                  快捷键
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded flex justify-between">
                    <span>撤销</span>
                    <kbd className="bg-white px-2 py-0.5 rounded border text-xs">Ctrl+Z</kbd>
                  </div>
                  <div className="bg-gray-50 p-2 rounded flex justify-between">
                    <span>重做</span>
                    <kbd className="bg-white px-2 py-0.5 rounded border text-xs">Ctrl+Y</kbd>
                  </div>
                  <div className="bg-gray-50 p-2 rounded flex justify-between">
                    <span>旋转商品</span>
                    <kbd className="bg-white px-2 py-0.5 rounded border text-xs">R</kbd>
                  </div>
                  <div className="bg-gray-50 p-2 rounded flex justify-between">
                    <span>暂停/继续</span>
                    <kbd className="bg-white px-2 py-0.5 rounded border text-xs">Space</kbd>
                  </div>
                  <div className="bg-gray-50 p-2 rounded flex justify-between">
                    <span>调整层级</span>
                    <kbd className="bg-white px-2 py-0.5 rounded border text-xs">滚轮</kbd>
                  </div>
                  <div className="bg-gray-50 p-2 rounded flex justify-between">
                    <span>取消选择</span>
                    <kbd className="bg-white px-2 py-0.5 rounded border text-xs">Esc</kbd>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
