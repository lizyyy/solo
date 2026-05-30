import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, AlertTriangle, Award, ArrowRight } from 'lucide-react';
import { RatingBadge } from '@/components/ui/RatingBadge';
import { formatCurrency, formatPercent, formatNumber } from '@/utils/format';
import type { Round } from '@/types';

interface RoundResultModalProps {
  round: Round;
  roundNumber: number;
  totalRounds: number;
  isLastRound: boolean;
  onNext: () => void;
}

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  round,
  roundNumber,
  totalRounds,
  isLastRound,
  onNext,
}) => {
  const isCorrect = round.roundScore > 0;
  const navChange = (round.navAfter || 0) - (round.navBefore || 0);
  const navChangePercent = round.navBefore
    ? (((round.navAfter || 0) - round.navBefore) / round.navBefore * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onNext}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl"
      >
        <div className={`h-2 ${isCorrect ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-orange-500'}`} />

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}
            >
              {isCorrect ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">
              第 {roundNumber} 回合结果
            </h2>
            <p className="text-gray-400 text-sm">
              {isCorrect ? '评级判断正确！' : '评级判断需要改进'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">本回合得分</div>
              <motion.div
                key={round.roundScore}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className={`text-3xl font-bold ${
                  round.roundScore >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {round.roundScore >= 0 ? '+' : ''}{round.roundScore}
              </motion.div>
            </div>

            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">组合净值</div>
              <div className="text-xl font-bold text-white">
                {formatCurrency(round.navAfter || 0)}
              </div>
              <div className={`text-xs flex items-center justify-center gap-1 mt-1 ${
                navChange >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {navChange >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {formatPercent(navChangePercent)}
              </div>
            </div>
          </div>

          {round.action && (
            <div className="bg-slate-700/30 rounded-xl p-4 mb-6">
              <div className="text-sm text-gray-400 mb-3">评级对比</div>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">你的评级</div>
                  <RatingBadge rating={round.action.newRating} size="lg" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500" />
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">正确评级</div>
                  <RatingBadge rating={round.correctRating || '-'} size="lg" />
                </div>
              </div>
            </div>
          )}

          {round.feedback && (
            <div className={`rounded-xl p-4 mb-6 ${
              isCorrect
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-amber-500/10 border border-amber-500/30'
            }`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  isCorrect ? 'text-emerald-400' : 'text-amber-400'
                }`} />
                <div>
                  <div className={`text-sm font-semibold mb-1 ${
                    isCorrect ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {isCorrect ? '💡 做得好' : '⚠️ 改进建议'}
                  </div>
                  <p className="text-sm text-gray-300">{round.feedback}</p>
                </div>
              </div>
            </div>
          )}

          {round.anomalies && round.anomalies.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 font-semibold text-sm">
                  检测到 {round.anomalies.length} 项异常
                </span>
              </div>
              <div className="text-xs text-gray-400">
                请在复盘报告中查看详细的异常诊断和修复建议
              </div>
            </div>
          )}

          <button
            onClick={onNext}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
              isLastRound
                ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
            }`}
          >
            {isLastRound ? '查看完整报告' : `下一回合 (${roundNumber + 1}/${totalRounds})`}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default RoundResultModal;
