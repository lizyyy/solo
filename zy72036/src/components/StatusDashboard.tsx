import { motion, AnimatePresence } from 'framer-motion';
import type { GameState } from '../types';
import { getStateChangeSummary } from '../utils/gameEngine';
import { useEffect, useState } from 'react';

interface StatusDashboardProps {
  currentState: GameState;
  previousState?: GameState;
}

export function StatusDashboard({ currentState, previousState }: StatusDashboardProps) {
  const [changes, setChanges] = useState<{
    resources: number;
    score: number;
    risk: number;
  } | null>(null);

  useEffect(() => {
    if (previousState) {
      const diff = getStateChangeSummary(previousState, currentState);
      setChanges(diff);
      const timer = setTimeout(() => setChanges(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentState, previousState]);

  const formatChange = (value: number) => {
    if (value === 0) return null;
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}`;
  };

  const getChangeClass = (value: number) => {
    if (value > 0) return 'text-skate-teal';
    if (value < 0) return 'text-skate-red';
    return '';
  };

  const statCards = [
    {
      label: '资源',
      emoji: '📦',
      value: currentState.resources,
      key: 'resources',
      unit: '',
      warning: currentState.resources < 0,
    },
    {
      label: '分数',
      emoji: '🎯',
      value: currentState.score,
      key: 'score',
      unit: '',
      warning: false,
    },
    {
      label: '风险',
      emoji: '⚠️',
      value: currentState.risk,
      key: 'risk',
      unit: '%',
      warning: currentState.risk > 80,
    },
  ];

  return (
    <div className="flex gap-4 mb-6">
      {statCards.map((stat) => (
        <motion.div
          key={stat.key}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex-1 p-4 rounded-lg border-2 transition-all duration-300 ${
            stat.warning
              ? 'negative-warning border-skate-red bg-skate-red/10'
              : 'border-chalk/30 bg-chalkboard-light'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-chalk-muted font-mono text-sm">{stat.label}</span>
            <span className="text-2xl">{stat.emoji}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`stat-value text-4xl font-bold font-mono ${
                stat.warning ? 'text-skate-red animate-pulse' : 'text-chalk'
              }`}
            >
              {stat.value}
              {stat.unit}
            </span>
            <AnimatePresence>
              {changes && changes[stat.key as keyof typeof changes] !== 0 && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`text-lg font-mono ${getChangeClass(
                    changes[stat.key as keyof typeof changes]
                  )}`}
                >
                  {formatChange(changes[stat.key as keyof typeof changes])}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {stat.warning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 text-xs text-skate-red font-mono"
            >
              ⚠️ {stat.key === 'resources' ? '资源已耗尽！' : '风险过高！'}
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
