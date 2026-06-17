import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, Lightbulb, ArrowRight, Pause, Play, ArrowLeft, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { GameEngine } from '../utils/GameEngine';
import { ConfigValidator } from '../utils/ConfigValidator';
import { ResourceBar } from '../components/ResourceBar';
import type { GameEvent } from '../types';

export function GamePage() {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const { 
    currentGame, 
    currentMaterial,
    selectMaterial, 
    startGame, 
    processDecision,
    endGame,
    pauseGame,
    resumeGame,
    restorePlayingGame,
    initMaterials
  } = useGameStore();

  const [remainingTime, setRemainingTime] = useState(0);
  const [eventStartTime, setEventStartTime] = useState(Date.now());
  const [feedback, setFeedback] = useState<{ text: string; isCorrect: boolean } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    initMaterials();
  }, [initMaterials]);

  useEffect(() => {
    if (materialId) {
      selectMaterial(materialId);
    }
  }, [materialId, selectMaterial]);

  useEffect(() => {
    if (!currentMaterial) return;

    if (currentGame) {
      if (currentGame.pausedAt) {
        setIsPaused(true);
        setRemainingTime(GameEngine.getRemainingSeconds(currentGame));
      }
      return;
    }

    const restored = restorePlayingGame(materialId!);
    if (restored) {
      return;
    }

    const validation = ConfigValidator.validate(currentMaterial);
    if (!validation.isValid) {
      setConfigError(ConfigValidator.formatErrors(validation.errors));
      return;
    }

    try {
      startGame();
    } catch (e) {
      setConfigError((e as Error).message);
    }
  }, [currentMaterial, currentGame, startGame, materialId, restorePlayingGame]);

  useEffect(() => {
    if (currentGame && !currentGame.pausedAt && currentGame.status === 'playing' && !isPaused) {
      const computed = GameEngine.getRemainingSeconds(currentGame);
      setRemainingTime(computed);
    }
  }, [currentGame, isPaused]);

  useEffect(() => {
    if (isPaused || currentGame?.status !== 'playing' || currentGame?.pausedAt) {
      return;
    }

    timerRef.current = window.setInterval(() => {
      setRemainingTime(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPaused, currentGame?.status, currentGame?.pausedAt]);

  const handleGameEnd = useCallback((failureType?: 'timeout' | 'rule_misunderstanding') => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    endGame(failureType);
    setTimeout(() => {
      navigate(`/result/${currentGame?.id}`);
    }, 500);
  }, [endGame, navigate, currentGame?.id]);

  useEffect(() => {
    if (remainingTime === 0 && currentGame && currentMaterial && currentGame.status === 'playing' && !isPaused) {
      handleGameEnd('timeout');
    }
  }, [remainingTime, currentGame, currentMaterial, isPaused, handleGameEnd]);

  const handlePause = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    pauseGame();
    setIsPaused(true);
  };

  const handleResume = () => {
    resumeGame();
    setIsPaused(false);
    setEventStartTime(Date.now());
  };

  const handleSelectOption = (optionId: string) => {
    if (!currentGame || !currentMaterial || isTransitioning || isPaused) return;

    const timeTaken = Math.round((Date.now() - eventStartTime) / 1000);
    const result = processDecision(optionId, timeTaken);

    if (result) {
      setFeedback({ text: result.feedback, isCorrect: result.isCorrect });
      setIsTransitioning(true);

      setTimeout(() => {
        setFeedback(null);
        setIsTransitioning(false);
        setEventStartTime(Date.now());

        const newState = useGameStore.getState().currentGame;
        if (newState) {
          const checkResult = GameEngine.checkGameEnd(
            newState,
            currentMaterial.events.length,
            remainingTime
          );

          if (checkResult.shouldEnd) {
            handleGameEnd(checkResult.failureType);
          }
        }
      }, 1500);
    }
  };

  if (!currentMaterial) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-slate-600">加载中...</div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-3">材料包配置有误</h2>
          <p className="text-slate-600 mb-4">
            无法启动游戏，该材料包存在以下配置问题：
          </p>
          <div className="text-left p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <pre className="whitespace-pre-wrap text-sm text-red-700 font-sans">{configError}</pre>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            请联系课程助教修复配置，或选择其他材料包。
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors mx-auto"
          >
            <ArrowLeft className="w-5 h-5" />
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!currentGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-slate-600">加载中...</div>
      </div>
    );
  }

  const currentEvent = currentMaterial.events[currentGame.currentEventIndex];
  const progress = currentGame.currentEventIndex / currentMaterial.events.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <h2 className="font-bold text-slate-700">{currentMaterial.name}</h2>
              <span className="text-sm text-slate-500">
                事件 {currentGame.currentEventIndex + 1} / {currentMaterial.events.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 font-mono font-bold text-lg ${
                remainingTime <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-700'
              }`}>
                <Clock className="w-5 h-5" />
                {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
              </div>
              {!isPaused ? (
                <button
                  onClick={handlePause}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  title="暂停"
                >
                  <Pause className="w-5 h-5 text-slate-500" />
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  className="p-2 rounded-lg hover:bg-green-100 transition-colors"
                  title="继续"
                >
                  <Play className="w-5 h-5 text-green-600" />
                </button>
              )}
            </div>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      <div className="sticky top-[73px] z-10 bg-white/60 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <ResourceBar resources={currentGame.resources} />
        </div>
      </div>

      {isPaused && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-amber-700 font-medium flex items-center gap-2">
              <Pause className="w-4 h-4" />
              游戏已暂停 — 您的选择和进度已保存
            </span>
            <button
              onClick={handleResume}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              继续游戏
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {currentEvent && !isPaused && (
            <motion.div
              key={currentEvent.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <EventCard
                event={currentEvent}
                onSelectOption={handleSelectOption}
                disabled={isTransitioning}
                feedback={feedback}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {isPaused && currentEvent && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <Pause className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">游戏暂停中</h3>
            <p className="text-slate-600 mb-2">
              当前事件：{currentEvent.title}
            </p>
            <p className="text-sm text-slate-500">
              已完成 {currentGame.decisions.length} 个决策，剩余时间 {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
            </p>
            <button
              onClick={handleResume}
              className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors mx-auto"
            >
              <Play className="w-5 h-5" />
              继续游戏
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-xl shadow-2xl max-w-md ${
              feedback.isCorrect 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.isCorrect 
                ? <CheckCircle className="w-6 h-6" />
                : <XCircle className="w-6 h-6" />
              }
              <span className="font-medium">{feedback.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface EventCardProps {
  event: GameEvent;
  onSelectOption: (optionId: string) => void;
  disabled: boolean;
  feedback: { text: string; isCorrect: boolean } | null;
}

function EventCard({ event, onSelectOption, disabled, feedback }: EventCardProps) {
  const typeConfig = {
    normal: { label: '普通事件', bg: 'bg-blue-100 text-blue-700' },
    emergency: { label: '紧急事件', bg: 'bg-red-100 text-red-700' },
    rework: { label: '返工事件', bg: 'bg-amber-100 text-amber-700' }
  };

  const config = typeConfig[event.type];

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.bg}`}>
            {config.label}
          </span>
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-3">{event.title}</h3>
        <p className="text-slate-600 leading-relaxed">{event.description}</p>
        
        {event.ruleHint && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-amber-700">{event.ruleHint}</span>
          </div>
        )}
      </div>

      <div className="p-6">
        <h4 className="text-sm font-semibold text-slate-500 mb-4">请选择调度方案：</h4>
        <div className="space-y-3">
          {event.options.map((option, index) => (
            <motion.button
              key={option.id}
              onClick={() => onSelectOption(option.id)}
              disabled={disabled}
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              className={`
                w-full p-4 rounded-xl text-left transition-all flex items-center gap-4
                ${disabled 
                  ? 'bg-slate-50 text-slate-400 cursor-not-allowed' 
                  : 'bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border-2 border-transparent'
                }
                ${feedback && option.isCorrect ? 'ring-2 ring-green-500' : ''}
                ${feedback && !option.isCorrect && feedback.isCorrect === false ? 'opacity-50' : ''}
              `}
            >
              <span className="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center font-bold text-slate-600">
                {String.fromCharCode(65 + index)}
              </span>
              <div className="flex-1">
                <p className="font-medium text-slate-700">{option.text}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {option.resourceCost.buses && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded">
                      -{option.resourceCost.buses} 公交
                    </span>
                  )}
                  {option.resourceCost.drivers && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded">
                      -{option.resourceCost.drivers} 司机
                    </span>
                  )}
                  {option.resourceCost.budget && (
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-600 rounded">
                      -{option.resourceCost.budget} 预算
                    </span>
                  )}
                  {option.resourceCost.reputation && (
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded">
                      -{option.resourceCost.reputation} 声誉
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
