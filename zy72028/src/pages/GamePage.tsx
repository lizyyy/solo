import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, AlertCircle, CheckCircle, XCircle, Lightbulb, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { GameEngine } from '../utils/GameEngine';
import { ResourceBar } from '../components/ResourceBar';
import type { GameEvent } from '../types';

export function GamePage() {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const { 
    materials, 
    currentGame, 
    currentMaterial,
    selectMaterial, 
    startGame, 
    processDecision,
    endGame,
    initMaterials
  } = useGameStore();

  const [remainingTime, setRemainingTime] = useState(0);
  const [eventStartTime, setEventStartTime] = useState(Date.now());
  const [feedback, setFeedback] = useState<{ text: string; isCorrect: boolean } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
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
    if (currentMaterial && !currentGame) {
      try {
        startGame();
      } catch (e) {
        alert((e as Error).message);
        navigate('/');
      }
    }
  }, [currentMaterial, currentGame, startGame, navigate]);

  useEffect(() => {
    if (currentGame && currentMaterial && currentGame.status === 'playing') {
      setRemainingTime(currentMaterial.gameDuration);
    }
  }, [currentGame, currentMaterial]);

  useEffect(() => {
    if (remainingTime > 0 && currentGame?.status === 'playing') {
      timerRef.current = window.setInterval(() => {
        setRemainingTime(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [remainingTime, currentGame?.status]);

  useEffect(() => {
    if (remainingTime === 0 && currentGame && currentMaterial && currentGame.status === 'playing') {
      handleGameEnd('timeout');
    }
  }, [remainingTime, currentGame, currentMaterial]);

  const handleGameEnd = useCallback((failureType?: 'timeout' | 'rule_misunderstanding') => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    endGame(failureType);
    setTimeout(() => {
      navigate(`/result/${currentGame?.id}`);
    }, 500);
  }, [endGame, navigate, currentGame?.id]);

  const handleSelectOption = (optionId: string) => {
    if (!currentGame || !currentMaterial || isTransitioning) return;

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

  if (!currentMaterial || !currentGame) {
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
            <div className={`flex items-center gap-2 font-mono font-bold text-lg ${
              remainingTime <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-700'
            }`}>
              <Clock className="w-5 h-5" />
              {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
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

      <div className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {currentEvent && (
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
