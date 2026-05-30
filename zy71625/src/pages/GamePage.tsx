import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { STEPS, Scratch, ScratchSeverity } from '../types';
import { VinylDisc } from '../components/game/VinylDisc';
import { NoiseAnalyzer } from '../components/game/NoiseAnalyzer';
import { ToolShelf } from '../components/game/ToolShelf';
import { Dashboard } from '../components/game/Dashboard';
import { ChevronLeft, ChevronRight, Pause, Play, Home, BarChart3, Clock, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const GamePage = () => {
  const navigate = useNavigate();
  const {
    currentRecord,
    currentStepIndex,
    status,
    nextStep,
    prevStep,
    endGame,
    pauseGame,
    resumeGame,
    judgeScratch,
    manualNotes,
    setManualNotes,
  } = useGameStore();

  const [showScratchModal, setShowScratchModal] = useState(false);
  const [selectedScratch, setSelectedScratch] = useState<Scratch | null>(null);
  const [judgment, setJudgment] = useState<{ isScratch: boolean; severity: ScratchSeverity }>({
    isScratch: true,
    severity: 'medium',
  });
  const [showFeedback, setShowFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const currentStep = STEPS[currentStepIndex];

  useEffect(() => {
    if (!currentRecord) {
      navigate('/');
    }
  }, [currentRecord, navigate]);

  const handleScratchClick = (scratch: Scratch) => {
    if (currentStepIndex !== 1) return;
    setSelectedScratch(scratch);
    setJudgment({
      isScratch: !scratch.isFalsePositive,
      severity: scratch.severity,
    });
    setShowScratchModal(true);
  };

  const handleJudgeSubmit = () => {
    if (!selectedScratch) return;
    judgeScratch(selectedScratch.id, judgment.isScratch, judgment.severity);
    setShowScratchModal(false);

    const actualIsScratch = !selectedScratch.isFalsePositive;
    if (judgment.isScratch === actualIsScratch && judgment.severity === selectedScratch.severity) {
      setShowFeedback({ type: 'success', message: '划痕判断正确！+10分' });
    } else {
      setShowFeedback({ type: 'error', message: judgment.isScratch !== actualIsScratch ? '划痕判断错误！' : '严重程度判断有误！' });
    }

    setTimeout(() => setShowFeedback(null), 2000);
  };

  const handleStepComplete = () => {
    if (currentStepIndex === STEPS.length - 1) {
      endGame();
      navigate('/report');
    } else {
      nextStep();
    }
  };

  if (!currentRecord) return null;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors"
            >
              <Home size={20} />
            </Link>
            <div>
              <h1 className="text-2xl text-[#D4A574] font-serif">黑胶修复工坊赛</h1>
              <p className="text-white/50 text-sm">
                {currentRecord.title} - {currentRecord.artist}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/analysis"
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              <BarChart3 size={18} />
              错因分析
            </Link>
            <Link
              to="/timeline"
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              <Clock size={18} />
              时间轴
            </Link>
            <Link
              to="/report"
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              <FileText size={18} />
              报告
            </Link>
            <button
              onClick={status === 'paused' ? resumeGame : pauseGame}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              {status === 'paused' ? <Play size={18} /> : <Pause size={18} />}
              {status === 'paused' ? '继续' : '暂停'}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/60 font-serif">修复流程</p>
            <p className="text-[#D4A574] font-serif">
              步骤 {currentStepIndex + 1} / {STEPS.length}
            </p>
          </div>
          <div className="flex gap-2">
            {STEPS.map((step, index) => (
              <div
                key={step.type}
                className={`flex-1 h-2 rounded-full transition-all ${
                  index < currentStepIndex
                    ? 'bg-green-500'
                    : index === currentStepIndex
                      ? 'bg-[#D4A574]'
                      : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((step, index) => (
              <span
                key={step.type}
                className={`text-xs ${
                  index <= currentStepIndex ? 'text-[#D4A574]' : 'text-white/30'
                }`}
              >
                {step.name}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-6">
            <Dashboard />
          </div>

          <div className="col-span-5 space-y-6">
            <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[#D4A574] font-serif text-lg">{currentStep.name}</h2>
                <span className="text-xs text-white/50">{currentStep.description}</span>
              </div>

              <div className="flex justify-center mb-6">
                <VinylDisc
                  onScratchClick={handleScratchClick}
                  isInteractive={currentStepIndex === 1}
                />
              </div>

              {currentStepIndex === 1 && (
                <div className="mt-4 p-4 bg-black/30 rounded-lg">
                  <p className="text-sm text-white/60 mb-2">
                    提示：点击黑胶盘上的划痕进行判断。黄色标记为疑似误判点。
                  </p>
                  <div className="flex gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-yellow-500" /> 轻微划痕
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-orange-500" /> 中等划痕
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-red-500" /> 深度划痕
                    </span>
                  </div>
                </div>
              )}

              {currentStepIndex === 4 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">人工备注</label>
                    <textarea
                      value={manualNotes}
                      onChange={e => setManualNotes(e.target.value)}
                      className="w-full h-32 p-3 rounded-lg bg-black/50 border border-[#D4A574]/30 text-white text-sm resize-none focus:outline-none focus:border-[#D4A574]"
                      placeholder="输入修复备注信息..."
                    />
                    <p className="text-[10px] text-orange-400/70 mt-1">
                      * 备注内容将标记为人工数据源
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D4A574]/30 text-[#D4A574] hover:bg-[#D4A574]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
                上一步
              </button>

              <button
                onClick={handleStepComplete}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#D4A574] text-[#2C1810] hover:bg-[#E5B685] transition-colors font-serif"
              >
                {currentStepIndex === STEPS.length - 1 ? '完成修复' : '下一步'}
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="col-span-4 space-y-6">
            {currentStepIndex === 0 && <NoiseAnalyzer />}
            {(currentStepIndex === 2 || currentStepIndex === 3) && (
              <ToolShelf currentStep={currentStepIndex} />
            )}
            {currentStepIndex === 1 && (
              <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
                <h3 className="text-[#D4A574] font-serif text-lg mb-4">划痕检测指南</h3>
                <div className="space-y-4 text-sm">
                  <div className="p-3 bg-black/30 rounded-lg">
                    <p className="text-white/80 mb-1">检测方法</p>
                    <p className="text-white/50 text-xs">
                      仔细观察黑胶盘表面，点击发光的划痕标记进行判断。注意区分真实划痕和误判标记（⚠）。
                    </p>
                  </div>
                  <div className="p-3 bg-black/30 rounded-lg">
                    <p className="text-white/80 mb-1">严重程度判断</p>
                    <ul className="text-white/50 text-xs space-y-1">
                      <li>• 轻微：细小发丝状，不影响播放</li>
                      <li>• 中等：可见线状，轻微影响音质</li>
                      <li>• 深度：明显凹槽，严重影响音质</li>
                    </ul>
                  </div>
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-orange-400 mb-1 flex items-center gap-2">
                      <AlertTriangle size={14} />
                      注意
                    </p>
                    <p className="text-orange-400/70 text-xs">
                      划痕误判会导致音质评分下降和顾客耐心流失，请仔细判断！
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentStepIndex === 4 && (
              <div className="bg-[#1a1a1a] rounded-xl border border-[#D4A574]/30 p-6">
                <h3 className="text-[#D4A574] font-serif text-lg mb-4">修复总结</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-white/60">修复划痕数</span>
                    <span className="text-white/80 font-serif">
                      {currentRecord.scratches.filter(s => s.repaired).length} / {currentRecord.scratches.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-white/60">已分析噪声</span>
                    <span className="text-white/80 font-serif">
                      {currentRecord.noises.filter(n => n.analyzed).length} / {currentRecord.noises.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-white/60">操作步骤</span>
                    <span className="text-white/80 font-serif">{useGameStore.getState().repairSteps.length} 步</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-white/60">数据来源</span>
                    <div className="flex gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                        系统数据
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-400">
                        人工备注
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showScratchModal && selectedScratch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={() => setShowScratchModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1a1a1a] rounded-2xl border border-[#D4A574]/30 p-8 max-w-md w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl text-[#D4A574] font-serif mb-6">划痕判断</h3>

              <div className="space-y-6">
                <div className="p-4 bg-black/30 rounded-lg">
                  <p className="text-sm text-white/60 mb-2">划痕信息</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-white/40">位置:</span>
                      <span className="text-white/80 ml-2">{selectedScratch.position}% 半径</span>
                    </div>
                    <div>
                      <span className="text-white/40">长度:</span>
                      <span className="text-white/80 ml-2">{selectedScratch.length}</span>
                    </div>
                    <div>
                      <span className="text-white/40">角度:</span>
                      <span className="text-white/80 ml-2">{selectedScratch.angle}°</span>
                    </div>
                    {selectedScratch.isFalsePositive && (
                      <div className="col-span-2">
                        <span className="text-orange-400 text-xs flex items-center gap-1">
                          <AlertTriangle size={12} />
                          疑似误判点
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-3">这是真实划痕吗？</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setJudgment({ ...judgment, isScratch: true })}
                      className={`flex-1 py-3 rounded-lg border-2 transition-all ${
                        judgment.isScratch
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-white/10 text-white/60 hover:border-white/30'
                      }`}
                    >
                      <CheckCircle2 size={20} className="mx-auto mb-1" />
                      是
                    </button>
                    <button
                      onClick={() => setJudgment({ ...judgment, isScratch: false })}
                      className={`flex-1 py-3 rounded-lg border-2 transition-all ${
                        !judgment.isScratch
                          ? 'border-red-500 bg-red-500/10 text-red-400'
                          : 'border-white/10 text-white/60 hover:border-white/30'
                      }`}
                    >
                      ✕
                      <p className="text-xs mt-1">否 (误判)</p>
                    </button>
                  </div>
                </div>

                {judgment.isScratch && (
                  <div>
                    <label className="block text-sm text-white/60 mb-3">严重程度</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['light', 'medium', 'deep'] as ScratchSeverity[]).map((severity) => (
                        <button
                          key={severity}
                          onClick={() => setJudgment({ ...judgment, severity })}
                          className={`py-2 rounded-lg border-2 transition-all text-sm ${
                            judgment.severity === severity
                              ? 'border-[#D4A574] bg-[#D4A574]/10 text-[#D4A574]'
                              : 'border-white/10 text-white/60 hover:border-white/30'
                          }`}
                        >
                          {severity === 'light' ? '轻微' : severity === 'medium' ? '中等' : '深度'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowScratchModal(false)}
                    className="flex-1 py-3 rounded-lg border border-white/20 text-white/60 hover:bg-white/5 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleJudgeSubmit}
                    className="flex-1 py-3 rounded-lg bg-[#D4A574] text-[#2C1810] font-serif hover:bg-[#E5B685] transition-colors"
                  >
                    确认判断
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl flex items-center gap-2 z-50 ${
              showFeedback.type === 'success'
                ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                : 'bg-red-500/20 border border-red-500/50 text-red-400'
            }`}
          >
            {showFeedback.type === 'success' ? (
              <CheckCircle2 size={20} />
            ) : (
              <AlertTriangle size={20} />
            )}
            <span className="font-serif">{showFeedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
