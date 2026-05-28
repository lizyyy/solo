import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, ChevronLeft, ChevronRight, Image as ImageIcon, Info } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import CluePanel from '../components/CluePanel';
import DynastyGuess from '../components/DynastyGuess';
import RiskRating from '../components/RiskRating';
import { GameStep } from '../types';

export default function Game() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const { 
    currentLevel, 
    currentSession, 
    currentStep,
    loadLevel, 
    startNewGame, 
    setCurrentStep,
    submitConclusion,
    isReplayMode
  } = useGameStore();

  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (levelId) {
      if (!isReplayMode) {
        startNewGame(levelId);
      } else {
        loadLevel(levelId);
      }
    }
  }, [levelId, startNewGame, loadLevel, isReplayMode]);

  const handleStartClues = () => {
    setShowIntro(false);
    setCurrentStep('clues');
  };

  const handleGoToDynasty = () => {
    setCurrentStep('dynasty');
  };

  const handleGoToRisk = () => {
    setCurrentStep('risk');
  };

  const handleGoToClues = () => {
    setCurrentStep('clues');
  };

  const handleSubmit = () => {
    submitConclusion();
    navigate(`/game/${levelId}/conclusion`);
  };

  const steps: { id: GameStep; label: string }[] = [
    { id: 'clues', label: '线索分析' },
    { id: 'dynasty', label: '年代推断' },
    { id: 'risk', label: '风险评级' },
  ];

  if (!currentLevel) {
    return (
      <div className="min-h-screen bg-paper-100 flex items-center justify-center">
        <div className="text-ink-200 font-kai">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-100 bg-paper-texture">
      <div className="h-16 bg-gradient-to-r from-paper-200 via-paper-100 to-paper-200 border-b-2 border-paper-300 flex items-center px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-ink-200 hover:text-ink-300 transition-colors"
        >
          <Home className="w-5 h-5" />
          <span className="font-kai">返回首页</span>
        </button>

        <div className="flex-1 flex justify-center">
          <h1 className="font-kai text-xl text-ink-300">{currentLevel.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-200 font-song">
            难度：{currentLevel.difficulty === 1 ? '入门' : currentLevel.difficulty === 2 ? '进阶' : '专家'}
          </span>
        </div>
      </div>

      {!showIntro && (
        <div className="h-12 bg-paper-50 border-b border-paper-200 flex items-center justify-center gap-8">
          {steps.map((step, index) => {
            const currentIndex = steps.findIndex(s => s.id === currentStep);
            const isActive = step.id === currentStep;
            const isPast = index < currentIndex;

            return (
              <div key={step.id} className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  disabled={index > currentIndex}
                  className={`flex items-center gap-2 font-kai transition-all ${
                    isActive
                      ? 'text-seal-300'
                      : isPast
                      ? 'text-bronze-300'
                      : 'text-paper-400 cursor-not-allowed'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                    isActive
                      ? 'bg-seal-300 text-white'
                      : isPast
                      ? 'bg-bronze-300 text-white'
                      : 'bg-paper-300 text-paper-100'
                  }`}>
                    {index + 1}
                  </span>
                  {step.label}
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 ${
                    isPast ? 'bg-bronze-300' : 'bg-paper-300'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        {showIntro && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center p-8"
          >
            <div className="max-w-4xl w-full bg-paper-50 rounded-lg shadow-scroll border-2 border-paper-300 overflow-hidden">
              <div className="aspect-video bg-paper-200 relative overflow-hidden">
                <img
                  src={currentLevel.paintingImage}
                  alt={currentLevel.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-400/50 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h2 className="text-3xl font-kai text-white mb-2 text-shadow-ink">
                    {currentLevel.title}
                  </h2>
                  <p className="text-white/90 font-song">
                    {currentLevel.description}
                  </p>
                </div>
              </div>

              <div className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-10 h-10 bg-lapis-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Info className="w-5 h-5 text-lapis-300" />
                  </div>
                  <div>
                    <h3 className="font-kai text-lg text-ink-300 mb-2">鉴定任务说明</h3>
                    <p className="text-ink-200 font-song leading-relaxed">
                      此画据传为宋代山水名家范宽的真迹，近期从民间征集所得。
                      作为鉴定专家，您需要通过分析纸张、印章、题跋、修复痕迹等线索，
                      结合科学检测报告，判断此画的真伪和真实年代。
                    </p>
                  </div>
                </div>

                <div className="bg-paper-100 rounded-lg p-6 mb-6">
                  <h4 className="font-kai text-ink-300 mb-4">鉴定流程</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-2">
                        <ImageIcon className="w-6 h-6 text-amber-600" />
                      </div>
                      <p className="font-kai text-ink-300">线索分析</p>
                      <p className="text-xs text-ink-200 font-song">发现并标记疑点</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-2">
                        <span className="text-xl">📅</span>
                      </div>
                      <p className="font-kai text-ink-300">年代推断</p>
                      <p className="text-xs text-ink-200 font-song">判断创作年代</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-2">
                        <span className="text-xl">⚖️</span>
                      </div>
                      <p className="font-kai text-ink-300">风险评级</p>
                      <p className="text-xs text-ink-200 font-song">评估疑点等级</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleStartClues}
                  className="w-full py-4 bg-gradient-to-r from-seal-300 to-seal-200 text-white rounded-lg font-kai text-lg hover:from-seal-200 hover:to-seal-100 transition-all shadow-seal"
                >
                  开始鉴定
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {currentStep === 'clues' && !showIntro && (
          <motion.div
            key="clues"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-[calc(100vh-112px)] flex"
          >
            <div className="flex-1 p-6 flex flex-col">
              <div className="flex-1 bg-paper-50 rounded-lg border-2 border-paper-300 shadow-painting overflow-hidden relative">
                <img
                  src={currentLevel.paintingImage}
                  alt={currentLevel.title}
                  className="w-full h-full object-cover"
                />
                
                {currentLevel.clues.filter(c => c.position).map((clue) => {
                  const isMarked = currentSession?.playerChoices.find(
                    c => c.clueId === clue.id && c.markedAsAnomaly
                  );
                  
                  return (
                    <div
                      key={clue.id}
                      className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                      style={{ left: `${clue.position?.x}%`, top: `${clue.position?.y}%` }}
                    >
                      <motion.div
                        animate={{ scale: isMarked ? [1, 1.2, 1] : 1 }}
                        transition={{ duration: 0.3 }}
                        className={`w-full h-full rounded-full border-2 flex items-center justify-center ${
                          isMarked
                            ? 'bg-seal-300 border-seal-400 text-white animate-pulse'
                            : 'bg-white/80 border-paper-400 text-ink-300 hover:bg-lapis-100 hover:border-lapis-300'
                        }`}
                      >
                        {isMarked ? '!' : '?'}
                      </motion.div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex justify-between">
                <div className="text-ink-200 font-song text-sm">
                  已发现疑点：{currentSession?.playerChoices.filter(c => c.markedAsAnomaly).length || 0} / {currentLevel.clues.filter(c => c.isAnomaly).length}
                </div>
                <button
                  onClick={handleGoToDynasty}
                  className="flex items-center gap-2 px-6 py-2 bg-lapis-300 text-white rounded-lg font-kai hover:bg-lapis-200 transition-colors"
                >
                  下一步：年代推断
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="w-96 relative">
              <CluePanel clues={currentLevel.clues} />
            </div>
          </motion.div>
        )}

        {currentStep === 'dynasty' && !showIntro && (
          <motion.div
            key="dynasty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-[calc(100vh-112px)] overflow-y-auto"
          >
            <DynastyGuess onNext={handleGoToRisk} onBack={handleGoToClues} />
          </motion.div>
        )}

        {currentStep === 'risk' && !showIntro && (
          <motion.div
            key="risk"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-[calc(100vh-112px)] overflow-y-auto"
          >
            <RiskRating onSubmit={handleSubmit} onBack={handleGoToDynasty} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
