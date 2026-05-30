import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Pause, SkipForward, SkipBack, Home, FileText, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { NewsBanner } from '@/components/common/NewsBanner';
import { PortfolioStats } from '@/components/common/PortfolioStats';
import { BondHoldingsTable } from '@/components/common/BondHoldingsTable';
import { AnomalyAlert } from '@/components/common/AnomalyAlert';
import { RatingBadge } from '@/components/ui/RatingBadge';
import { SAMPLE_FLOW } from '@/data/sampleFlow';
import type { Game, Round } from '@/types';

const SampleFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const { saveGame } = useGameStore();

  const [game, setGame] = useState<Game | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTip, setShowTip] = useState(true);

  useEffect(() => {
    setGame(SAMPLE_FLOW.game);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && game) {
      timer = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= SAMPLE_FLOW.steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, SAMPLE_FLOW.autoPlayInterval);
    }
    return () => clearInterval(timer);
  }, [isPlaying, game]);

  const currentStepData = SAMPLE_FLOW.steps[currentStep];

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
    setIsPlaying(false);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(SAMPLE_FLOW.steps.length - 1, prev + 1));
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSaveAsDemo = useCallback(() => {
    if (game) {
      const demoGame = { ...game, id: `demo-${Date.now()}` };
      saveGame(demoGame);
      alert('样例流程已保存为游戏记录，可在复盘回放中查看');
    }
  }, [game, saveGame]);

  const handleGoToReport = useCallback(() => {
    if (game) {
      navigate(`/report/${game.id}`);
    }
  }, [game, navigate]);

  if (!game) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  const currentRound = currentStepData.highlightedRound !== undefined
    ? (game.rounds[currentStepData.highlightedRound] as Round)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">新人交接样例</h1>
                <div className="text-xs text-gray-400">
                  自动演示完整流程 · 共 {SAMPLE_FLOW.steps.length} 个步骤
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveAsDemo}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">保存样例</span>
              </button>
              <button
                onClick={handleGoToReport}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white text-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">查看报告</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <AnimatePresence>
          {showTip && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3"
            >
              <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-amber-400 font-semibold mb-1">新人交接指南</h4>
                <p className="text-gray-300 text-sm">
                  本样例将自动演示从游戏开始到报告导出的完整流程。每个步骤都有详细说明，
                  帮助新人快速理解系统的核心功能和操作流程。
                </p>
              </div>
              <button
                onClick={() => setShowTip(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-400">
              步骤 {currentStep + 1} / {SAMPLE_FLOW.steps.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={handleNext}
                disabled={currentStep >= SAMPLE_FLOW.steps.length - 1}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / SAMPLE_FLOW.steps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-gradient-to-r from-amber-900/30 via-slate-800/50 to-orange-900/30 rounded-xl border border-amber-500/30 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">{currentStepData.icon}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2">
                {currentStepData.title}
              </h3>
              <p className="text-gray-300 mb-4">
                {currentStepData.description}
              </p>
              {currentStepData.keyPoints && currentStepData.keyPoints.length > 0 && (
                <div className="space-y-2">
                  {currentStepData.keyPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{point}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {currentRound?.news && currentStepData.showGameContent && (
          <NewsBanner 
            news={currentRound.news} 
            roundNumber={(currentStepData.highlightedRound || 0) + 1}
            totalRounds={game.rounds.length}
          />
        )}

        {currentStepData.showGameContent && (
          <>
            <PortfolioStats game={game} />

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <BondHoldingsTable
                  holdings={currentRound?.holdingsAfter || game.holdings}
                  affectedBondCodes={currentRound?.affectedBondCodes || []}
                  onSelectBond={() => {}}
                  onSubmitRating={() => {}}
                  isPlaying={false}
                  newsDirection={currentRound?.news?.direction}
                />
              </div>

              <div className="space-y-6">
                {currentRound?.action && (
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                    <h4 className="text-white font-semibold mb-4">本回合操作</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">操作债券</span>
                        <span className="text-white font-medium">
                          {currentRound.action.bondCode}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">原评级</span>
                        <RatingBadge rating={currentRound.action.oldRating} size="sm" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">新评级</span>
                        <RatingBadge rating={currentRound.action.newRating} size="sm" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">正确评级</span>
                        <RatingBadge rating={currentRound.correctRating || '-'} size="sm" />
                      </div>
                      <div className="pt-3 border-t border-slate-700">
                        <div className="text-gray-400 text-sm mb-1">调整理由</div>
                        <div className="text-gray-300 text-sm">
                          {currentRound.action.reason || '未填写'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentRound?.anomalies && currentRound.anomalies.length > 0 && (
                  <AnomalyAlert anomalies={currentRound.anomalies} />
                )}
              </div>
            </div>
          </>
        )}

        {currentStepData.showExportDemo && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              报告导出功能演示
            </h3>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { label: 'PDF报告', desc: '完整的可打印报告', color: 'bg-red-500' },
                { label: 'Excel表格', desc: '结构化数据导出', color: 'bg-emerald-500' },
                { label: 'JSON数据', desc: '原始数据格式', color: 'bg-blue-500' },
                { label: '审计日志', desc: '完整操作痕迹', color: 'bg-purple-500' },
              ].map((item) => (
                <div key={item.label} className="bg-slate-700/50 rounded-lg p-4 text-center">
                  <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center mx-auto mb-3`}>
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-white font-medium mb-1">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStepData.showSummary && (
          <div className="bg-emerald-900/20 rounded-xl border border-emerald-500/30 p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              样例流程总结
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-emerald-400 font-medium mb-3">📋 完整流程回顾</h4>
                <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                  <li>选择游戏模式（标准/新手/样例）</li>
                  <li>接收突发新闻，分析影响方向</li>
                  <li>选择受影响债券，调整评级</li>
                  <li>填写调整理由，提交评级</li>
                  <li>查看即时反馈和净值变化</li>
                  <li>异常诊断系统自动检测问题</li>
                  <li>完成所有回合后生成复盘报告</li>
                  <li>导出多种格式的报告文件</li>
                </ol>
              </div>
              <div>
                <h4 className="text-amber-400 font-medium mb-3">🎯 核心规则说明</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    <span><strong>评级档位：</strong>AAA &gt; AA &gt; A &gt; BBB &gt; BB &gt; B &gt; CCC</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    <span><strong>净值计算：</strong>Σ(债券市值 × 风险权重) + 现金</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    <span><strong>异常分类：</strong>🔴数据 / 🟠规则 / 🟡材料</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    <span><strong>评分标准：</strong>方向正确+20，档位匹配+10，方向错误-15</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {currentStep >= SAMPLE_FLOW.steps.length - 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 rounded-2xl border border-emerald-500/30 p-8 text-center"
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              恭喜完成样例学习！
            </h2>
            <p className="text-gray-300 mb-6">
              你已经了解了"债券评级急救室"的完整操作流程。现在可以开始实际操作，
              或查看详细的复盘报告。
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => navigate('/game/standard')}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-semibold transition-colors"
              >
                开始标准模式
              </button>
              <button
                onClick={handleGoToReport}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-semibold transition-colors"
              >
                查看样例报告
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-semibold transition-colors"
              >
                返回首页
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SampleFlowPage;
