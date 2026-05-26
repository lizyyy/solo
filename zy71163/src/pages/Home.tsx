import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Play, BookOpen, History, Star, Trophy, 
  Clock, AlertTriangle, ChevronRight, Info
} from 'lucide-react';
import { levels } from '@/data/levels';
import { getHighScores } from '@/utils/storage';
import { PharmacyScene } from '@/components/PharmacyScene';
import { getDifficultyStars } from '@/data/levels';
import { cn } from '@/lib/utils';

const Home = () => {
  const navigate = useNavigate();
  const [highScores, setHighScores] = useState<Record<string, number>>({});
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setHighScores(getHighScores());
  }, []);

  const handleStartGame = (levelId: string) => {
    navigate(`/game/${levelId}`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <PharmacyScene />
      
      <div className="relative z-10 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-blue-100 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">+</span>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                药房配药校验游戏
              </h1>
            </div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              在限时游戏中练习剂量计算、禁忌拦截和批号核对，成为专业的药房药师
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-100 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Trophy className="text-yellow-500" size={28} />
                    选择关卡
                  </h2>
                  <button
                    onClick={() => setShowGuide(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    <Info size={18} />
                    <span className="text-sm font-medium">游戏说明</span>
                  </button>
                </div>

                <div className="grid gap-4">
                  {levels.map((level, index) => {
                    const highScore = highScores[level.id] || 0;
                    const isUnlocked = index === 0 || highScores[levels[index - 1]?.id] >= levels[index - 1].maxScore * 0.6;
                    
                    return (
                      <motion.div
                        key={level.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.01 }}
                        className={cn(
                          'group relative p-5 rounded-2xl border-2 transition-all cursor-pointer',
                          isUnlocked 
                            ? 'bg-gradient-to-r from-white to-gray-50 border-gray-200 hover:border-blue-400 hover:shadow-xl' 
                            : 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                        )}
                        onClick={() => isUnlocked && handleStartGame(level.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              'w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg text-2xl font-bold text-white',
                              isUnlocked
                                ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                                : 'bg-gray-400'
                            )}>
                              {index + 1}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                {level.name}
                                <span className="text-sm font-normal">
                                  {getDifficultyStars(level.difficulty)}
                                </span>
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">{level.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {Math.floor(level.timeLimit / 60)}分钟
                                </span>
                                <span>{level.prescriptionCount}张处方</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {highScore > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-gray-400">最高分</p>
                                <p className="text-xl font-bold text-yellow-600 font-mono">{highScore}</p>
                              </div>
                            )}
                            {isUnlocked && (
                              <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                <Play size={24} className="ml-1" />
                              </div>
                            )}
                            {!isUnlocked && (
                              <div className="w-12 h-12 rounded-2xl bg-gray-300 flex items-center justify-center text-white">
                                <span className="text-2xl">🔒</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {level.difficulty >= 4 && (
                          <div className="absolute top-3 right-3">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                              <AlertTriangle size={12} />
                              高难度
                            </span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-100 p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen className="text-blue-500" size={22} />
                  游戏规则
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                    <p className="text-gray-600">仔细阅读处方，注意患者过敏史和诊断</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                    <p className="text-gray-600">从药品架拖拽正确的药品到配药台</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                    <p className="text-gray-600">依次核对剂量、禁忌、批号三项内容</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</div>
                    <p className="text-gray-600">全部核对正确后点击确认配药</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-100 p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Star className="text-yellow-500" size={22} />
                  计分规则
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-600">正确配药</span>
                    <span className="text-green-600 font-bold">+100分</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-600">每项核对正确</span>
                    <span className="text-green-600 font-bold">+20分</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-600">提前完成奖励</span>
                    <span className="text-green-600 font-bold">+5分/秒</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-600">剂量错误</span>
                    <span className="text-red-600 font-bold">-15~20分</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-600">禁忌未拦截</span>
                    <span className="text-red-600 font-bold">-30分</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-600">批号过期</span>
                    <span className="text-red-600 font-bold">-30分</span>
                  </div>
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => navigate('/history')}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold rounded-2xl shadow-lg hover:from-purple-600 hover:to-purple-700 transition-all hover:shadow-xl"
              >
                <History size={20} />
                <span>历史记录</span>
                <ChevronRight size={20} />
              </motion.button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm text-gray-500"
          >
            <p>💡 提示：注意区分毫克(mg)和克(g)，检查有效期，关注患者过敏史</p>
          </motion.div>
        </div>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">游戏说明</h2>
            </div>
            <div className="p-6 space-y-6">
              <section>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">1</div>
                  游戏目标
                </h3>
                <p className="text-gray-600 text-sm">
                  在限定时间内，完成多张处方的配药校验工作。通过正确核对药品剂量、配伍禁忌和批号效期，获取尽可能高的分数。
                </p>
              </section>
              
              <section>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">2</div>
                  核心核对项
                </h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">剂量核对：</span>
                    <span>检查处方剂量单位和数值是否与药品规格匹配，注意mg和g的区别</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-600">禁忌核对：</span>
                    <span>检查患者过敏史、诊断是否与药品禁忌冲突，以及多种药物间的相互作用</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-yellow-600">批号核对：</span>
                    <span>检查药品批号和有效期，确保药品在有效期内</span>
                  </li>
                </ul>
              </section>
              
              <section>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">3</div>
                  操作说明
                </h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• 阅读处方阶段：仔细查看患者信息、诊断、过敏史和用药明细</li>
                  <li>• 拖拽药品：从左侧药品架拖拽药品到配药台</li>
                  <li>• 核对操作：点击剂量、禁忌、批号按钮进行核对</li>
                  <li>• 确认配药：所有药品全部核对正确后，点击确认配药进入下一张处方</li>
                </ul>
              </section>
              
              <section>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">4</div>
                  常见错误
                </h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>⚠️ 剂量单位混淆（mg/g）</li>
                  <li>⚠️ 未注意患者过敏史</li>
                  <li>⚠️ 忽略药物相互作用</li>
                  <li>⚠️ 未检查药品有效期</li>
                  <li>⚠️ 选错药品</li>
                  <li>⚠️ 未完成核对就确认</li>
                </ul>
              </section>
            </div>
            <div className="p-6 border-t border-gray-100">
              <button
                onClick={() => setShowGuide(false)}
                className="w-full px-6 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors"
              >
                我知道了
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Home;
