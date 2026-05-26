import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Trophy, AlertTriangle, CheckCircle, Clock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreBoardProps {
  score: number;
  maxScore: number;
  timeRemaining: number;
  prescriptionTimeRemaining: number;
  currentPrescription: number;
  totalPrescriptions: number;
  errorsCount: number;
  status: 'idle' | 'reading' | 'playing' | 'paused' | 'finished';
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const ScoreBoard = memo(function ScoreBoard({
  score,
  maxScore,
  timeRemaining,
  prescriptionTimeRemaining,
  currentPrescription,
  totalPrescriptions,
  errorsCount,
  status
}: ScoreBoardProps) {
  const timePercentage = (timeRemaining / maxScore) * 100;
  const isTimeLow = timeRemaining < 60;
  const isPrescriptionTimeLow = prescriptionTimeRemaining < 20;

  const scorePercentage = Math.min(100, Math.max(0, (score / maxScore) * 100));
  
  const getStarCount = () => {
    if (scorePercentage >= 90) return 3;
    if (scorePercentage >= 75) return 2;
    if (scorePercentage >= 60) return 1;
    return 0;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4"
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Trophy className="text-white" size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">当前得分</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900 font-mono">{score}</span>
                <span className="text-sm text-gray-400">/ {maxScore}</span>
              </div>
            </div>
          </div>
          
          <div className="h-10 w-px bg-gray-200" />
          
          <div className="flex items-center gap-1">
            {[1, 2, 3].map(i => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: i <= getStarCount() ? 1 : 0.5 }}
                transition={{ delay: i * 0.1 }}
              >
                <Star
                  size={20}
                  className={cn(
                    i <= getStarCount() 
                      ? 'text-yellow-500 fill-yellow-500' 
                      : 'text-gray-300'
                  )}
                />
              </motion.div>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium mb-1 flex items-center justify-center gap-1">
              <Clock size={12} />
              处方进度
            </p>
            <p className="text-xl font-bold text-blue-600">
              {currentPrescription} / {totalPrescriptions}
            </p>
          </div>
          
          <div className="h-10 w-px bg-gray-200" />
          
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium mb-1 flex items-center justify-center gap-1">
              <AlertTriangle size={12} className={errorsCount > 0 ? 'text-red-500' : ''} />
              错误次数
            </p>
            <p className={cn(
              'text-xl font-bold',
              errorsCount > 0 ? 'text-red-600' : 'text-green-600'
            )}>
              {errorsCount}
            </p>
          </div>
          
          <div className="h-10 w-px bg-gray-200" />
          
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium mb-1 flex items-center justify-center gap-1">
              <Timer size={12} className={isPrescriptionTimeLow ? 'text-orange-500 animate-pulse' : ''} />
              处方计时
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={prescriptionTimeRemaining}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'text-xl font-bold font-mono',
                  isPrescriptionTimeLow ? 'text-orange-600 animate-pulse' : 'text-gray-900'
                )}
              >
                {formatTime(prescriptionTimeRemaining)}
              </motion.p>
            </AnimatePresence>
          </div>
          
          <div className="h-10 w-px bg-gray-200" />
          
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium mb-1 flex items-center justify-center gap-1">
              <Timer size={12} className={isTimeLow ? 'text-red-500 animate-pulse' : ''} />
              总计时
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={timeRemaining}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'text-xl font-bold font-mono',
                  isTimeLow ? 'text-red-600 animate-pulse' : 'text-blue-600'
                )}
              >
                {formatTime(timeRemaining)}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        
        <div className="h-10 w-px bg-gray-200" />
        
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-700">
            {status === 'playing' ? '配药中' : 
             status === 'paused' ? '已暂停' : 
             status === 'reading' ? '阅读处方' :
             status === 'finished' ? '已完成' : '准备中'}
          </span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-16">得分进度</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${scorePercentage}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
            />
          </div>
          <span className="text-xs font-bold text-blue-600 w-12 text-right">
            {Math.round(scorePercentage)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
});
