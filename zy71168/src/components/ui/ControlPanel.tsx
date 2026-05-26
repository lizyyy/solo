import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  RotateCcw,
  Home,
  HelpCircle,
  X,
  BookOpen
} from 'lucide-react';
import { ADJACENCY_RULES } from '../../data/rules';
import { HAZARD_CATEGORY_LABELS, HAZARD_CATEGORY_ICONS } from '../../types';
import { cn } from '../../lib/utils';

export const ControlPanel: React.FC = () => {
  const navigate = useNavigate();
  const isPaused = useGameStore(state => state.isPaused);
  const status = useGameStore(state => state.status);
  const pauseGame = useGameStore(state => state.pauseGame);
  const resumeGame = useGameStore(state => state.resumeGame);
  const restartLevel = useGameStore(state => state.restartLevel);
  const levelId = useGameStore(state => state.levelId);

  const [showRules, setShowRules] = useState(false);

  const isPlaying = status === 'playing';

  const handleHome = () => {
    navigate('/');
  };

  const handleRestart = () => {
    if (confirm('确定要重新开始吗？当前进度将丢失。')) {
      restartLevel();
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeGame();
    } else {
      pauseGame();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-xl border border-slate-700"
      >
        <button
          onClick={handleHome}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
        >
          <Home className="w-4 h-4" />
          主页
        </button>

        <button
          onClick={handlePauseResume}
          disabled={!isPlaying}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            isPlaying
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          )}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {isPaused ? '继续' : '暂停'}
        </button>

        <button
          onClick={handleRestart}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          重开
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setShowRules(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          规则
        </button>
      </motion.div>

      <AnimatePresence>
        {showRules && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={() => setShowRules(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-2xl border border-slate-600 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  游戏规则
                </h2>
                <button
                  onClick={() => setShowRules(false)}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <section>
                  <h3 className="text-lg font-bold text-slate-200 mb-3">游戏目标</h3>
                  <p className="text-slate-400 text-sm">
                    将所有化学品正确摆放到货架上，遵守安全规则，避免违规，争取最高分。
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-slate-200 mb-3">操作说明</h3>
                  <ul className="text-slate-400 text-sm space-y-2">
                    <li>• 从化学品库拖拽化学品卡片到货架格子</li>
                    <li>• 点击已摆放的化学品可以移除</li>
                    <li>• 绿色高亮表示可以安全摆放</li>
                    <li>• 黄色高亮表示有轻微违规</li>
                    <li>• 红色高亮表示严重违规（会导致游戏失败）</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-slate-200 mb-3">禁忌相邻规则</h3>
                  <div className="space-y-2">
                    {ADJACENCY_RULES
                      .filter(r => r.severity !== 'allowed')
                      .map((rule, i) => (
                        <div
                          key={i}
                          className={cn(
                            'p-3 rounded-lg text-sm',
                            rule.severity === 'severe'
                              ? 'bg-red-900/30 border border-red-500/30'
                              : 'bg-yellow-900/30 border border-yellow-500/30'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">
                              {HAZARD_CATEGORY_ICONS[rule.category1 as keyof typeof HAZARD_CATEGORY_ICONS] || '🧪'}
                            </span>
                            <span className="text-slate-300">
                              {HAZARD_CATEGORY_LABELS[rule.category1 as keyof typeof HAZARD_CATEGORY_LABELS] || rule.category1}
                            </span>
                            <span className="text-slate-500">+</span>
                            <span className="text-lg">
                              {HAZARD_CATEGORY_ICONS[rule.category2 as keyof typeof HAZARD_CATEGORY_ICONS] || '🧪'}
                            </span>
                            <span className="text-slate-300">
                              {HAZARD_CATEGORY_LABELS[rule.category2 as keyof typeof HAZARD_CATEGORY_LABELS] || rule.category2}
                            </span>
                            <span className={cn(
                              'ml-auto text-xs font-bold px-2 py-0.5 rounded',
                              rule.severity === 'severe'
                                ? 'bg-red-500 text-white'
                                : 'bg-yellow-500 text-black'
                            )}>
                              {rule.severity === 'severe' ? '严重' : '警告'}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs">{rule.description}</p>
                        </div>
                      ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-slate-200 mb-3">计分规则</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-3 bg-green-900/20 rounded-lg">
                      <div className="text-green-400 font-bold">+50</div>
                      <div className="text-slate-400 text-xs">正确摆放</div>
                    </div>
                    <div className="p-3 bg-green-900/20 rounded-lg">
                      <div className="text-green-400 font-bold">+20</div>
                      <div className="text-slate-400 text-xs">完美隔离</div>
                    </div>
                    <div className="p-3 bg-green-900/20 rounded-lg">
                      <div className="text-green-400 font-bold">+30</div>
                      <div className="text-slate-400 text-xs">温度合规</div>
                    </div>
                    <div className="p-3 bg-green-900/20 rounded-lg">
                      <div className="text-green-400 font-bold">+10/秒</div>
                      <div className="text-slate-400 text-xs">提前完成</div>
                    </div>
                    <div className="p-3 bg-red-900/20 rounded-lg">
                      <div className="text-red-400 font-bold">-100</div>
                      <div className="text-slate-400 text-xs">禁忌相邻</div>
                    </div>
                    <div className="p-3 bg-red-900/20 rounded-lg">
                      <div className="text-red-400 font-bold">-50</div>
                      <div className="text-slate-400 text-xs">温度超限</div>
                    </div>
                    <div className="p-3 bg-red-900/20 rounded-lg">
                      <div className="text-red-400 font-bold">-80</div>
                      <div className="text-slate-400 text-xs">隔离不足</div>
                    </div>
                    <div className="p-3 bg-red-900/20 rounded-lg">
                      <div className="text-red-400 font-bold">-20/秒</div>
                      <div className="text-slate-400 text-xs">超时</div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-slate-200 mb-3">特殊存储区</h3>
                  <ul className="text-slate-400 text-sm space-y-1">
                    <li>• <span className="text-red-400">防爆柜</span>：存放爆炸品</li>
                    <li>• <span className="text-cyan-400">冷藏区</span>：存放需要低温存储的化学品</li>
                    <li>• <span className="text-purple-400">毒害区</span>：存放剧毒化学品</li>
                  </ul>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
