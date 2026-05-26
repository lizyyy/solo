import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { Trophy, Clock, AlertCircle, XCircle } from 'lucide-react';
import { getViolationTypeLabel } from '../../engine/scoring';
import { cn } from '../../lib/utils';

export const ScorePanel: React.FC = () => {
  const score = useGameStore(state => state.score);
  const timeRemaining = useGameStore(state => state.timeRemaining);
  const violations = useGameStore(state => state.violations);
  const operationHistory = useGameStore(state => state.operationHistory);

  const [displayScore, setDisplayScore] = useState(score);
  const [lastDelta, setLastDelta] = useState<number | null>(null);

  useEffect(() => {
    if (operationHistory.length > 0) {
      const lastOp = operationHistory[operationHistory.length - 1];
      if (lastOp.scoreDelta !== 0) {
        setLastDelta(lastOp.scoreDelta);
        setTimeout(() => setLastDelta(null), 1500);
      }
    }
  }, [operationHistory.length]);

  useEffect(() => {
    const startValue = displayScore;
    const endValue = score;
    const duration = 300;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(startValue + (endValue - startValue) * ease));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    if (score !== displayScore) {
      requestAnimationFrame(animate);
    }
  }, [score, displayScore]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timeColor = timeRemaining <= 30 ? 'text-red-400' : timeRemaining <= 60 ? 'text-yellow-400' : 'text-green-400';

  const recentViolations = violations.slice(-5).reverse();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-slate-900/50 rounded-xl border border-slate-700"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-300">游戏状态</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-slate-400">得分</span>
          </div>
          <div className="relative">
            <motion.span
              key={displayScore}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold font-mono text-slate-100"
            >
              {displayScore}
            </motion.span>
            <AnimatePresence>
              {lastDelta !== null && (
                <motion.span
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -20 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    'absolute -top-2 right-0 text-sm font-bold',
                    lastDelta > 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {lastDelta > 0 ? `+${lastDelta}` : lastDelta}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className={cn('w-4 h-4', timeColor)} />
            <span className="text-xs text-slate-400">剩余时间</span>
          </div>
          <motion.span
            key={timeRemaining}
            animate={timeRemaining <= 30 ? { scale: [1, 1.1, 1] } : {}}
            transition={timeRemaining <= 30 ? { repeat: Infinity, duration: 1 } : {}}
            className={cn('text-2xl font-bold font-mono', timeColor)}
          >
            {formatTime(timeRemaining)}
          </motion.span>
        </div>
      </div>

      {recentViolations.length > 0 && (
        <div className="border-t border-slate-700 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-3 h-3 text-red-400" />
            <span className="text-xs font-medium text-slate-400">违规记录</span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {recentViolations.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 text-[10px]"
              >
                <AlertCircle className="w-3 h-3 text-red-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-red-300">{v.description}</div>
                  <div className="text-slate-500">
                    {getViolationTypeLabel(v.type)} · {v.penalty > 0 ? `-${v.penalty}` : '严重'}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
