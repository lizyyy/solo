import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import RatingBadge from '@/components/ui/RatingBadge';
import { formatCurrency, formatNumber } from '@/utils/format';
import type { BondHolding, RatingAction, RatingLevel, NewsDirection } from '@/types';
import { RATING_LEVELS } from '@/data/constants';
import { RatingEngine } from '@/engine/ratingEngine';

interface BondHoldingsTableProps {
  holdings: BondHolding[];
  affectedBondCodes: string[];
  onSelectBond: (bondCode: string | null) => void;
  onSubmitRating: (action: RatingAction) => void;
  isPlaying: boolean;
  newsDirection?: NewsDirection;
}

export const BondHoldingsTable: React.FC<BondHoldingsTableProps> = ({
  holdings,
  affectedBondCodes,
  onSelectBond,
  onSubmitRating,
  isPlaying,
  newsDirection,
}) => {
  const [selectedBondCode, setSelectedBondCode] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState<RatingLevel | null>(null);
  const [reason, setReason] = useState('');

  const isAffected = (bondCode: string) => {
    return affectedBondCodes.includes(bondCode);
  };

  const handleSelectBond = (bondCode: string) => {
    if (!isPlaying) return;
    if (selectedBondCode === bondCode) {
      setSelectedBondCode(null);
      setPendingRating(null);
      setReason('');
      onSelectBond(null);
    } else {
      setSelectedBondCode(bondCode);
      setPendingRating(null);
      setReason('');
      onSelectBond(bondCode);
    }
  };

  const handleSubmit = () => {
    if (!selectedBondCode || !pendingRating || !reason.trim()) return;

    const holding = holdings.find(h => h.bondCode === selectedBondCode);
    if (!holding) return;

    const navImpact = RatingEngine.calculateNavImpact(holding, pendingRating);

    const action: RatingAction = {
      id: `action-${Date.now()}`,
      bondCode: selectedBondCode,
      bondName: holding.bondName,
      oldRating: holding.currentRating,
      newRating: pendingRating,
      reason: reason.trim(),
      timeSpent: 0,
      reactionTime: 0,
      navImpact,
      scoreImpact: 0,
      isCorrect: false,
      hasAnomaly: false,
      timestamp: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    };

    onSubmitRating(action);
    setSelectedBondCode(null);
    setPendingRating(null);
    setReason('');
  };

  const selectedHolding = selectedBondCode
    ? holdings.find(h => h.bondCode === selectedBondCode)
    : null;

  const expectedNavImpact = selectedHolding && pendingRating
    ? RatingEngine.calculateNavImpact(selectedHolding, pendingRating)
    : 0;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white">债券持仓</h3>
        <p className="text-sm text-gray-400">
          点击债券进行评级调整，
          <span className="text-amber-400">受新闻影响的债券已高亮显示</span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                债券代码
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                债券名称
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                当前评级
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                市值
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                仓位
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                风险权重
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                调整后价值
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            <AnimatePresence>
              {holdings.map((holding, index) => (
                <motion.tr
                  key={holding.bondCode}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    cursor-pointer transition-all duration-200
                    ${isAffected(holding.bondCode) ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-700/30'}
                    ${selectedBondCode === holding.bondCode ? 'bg-slate-700/50 ring-2 ring-inset ring-emerald-500/50' : ''}
                  `}
                  onClick={() => handleSelectBond(holding.bondCode)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isAffected(holding.bondCode) && (
                        <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                      )}
                      <span className="font-mono text-sm text-white">
                        {holding.bondCode}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-300 max-w-[200px] truncate block">
                      {holding.bondName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RatingBadge rating={holding.currentRating} size="md" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-300">
                      {formatCurrency(holding.marketValue)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-300">
                      {formatNumber(holding.position / 10000, 0)}万
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-300">
                      {(holding.riskWeight * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(holding.adjustedValue)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        isAffected(holding.bondCode)
                          ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                          : 'bg-slate-600/50 text-gray-400 hover:bg-slate-600'
                      } ${!isPlaying ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!isPlaying}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPlaying) handleSelectBond(holding.bondCode);
                      }}
                    >
                      调整评级
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedHolding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-700 bg-slate-700/30"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h4 className="text-xl font-bold text-white">
                    {selectedHolding.bondCode} - {selectedHolding.bondName}
                  </h4>
                  <p className="text-sm text-gray-400 mt-1">
                    当前市值：{formatCurrency(selectedHolding.marketValue)} · 
                    仓位：{formatNumber(selectedHolding.position / 10000, 0)}万
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedBondCode(null);
                    setPendingRating(null);
                    setReason('');
                    onSelectBond(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors p-2"
                >
                  ✕
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-2">当前评级</div>
                  <RatingBadge rating={selectedHolding.currentRating} size="lg" />
                  <div className="text-xs text-gray-500 mt-2">
                    风险权重：{(selectedHolding.riskWeight * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-2">新闻方向</div>
                  <div className={`text-lg font-bold ${
                    newsDirection === 'upgrade' ? 'text-emerald-400' :
                    newsDirection === 'downgrade' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {newsDirection === 'upgrade' ? '⬆️ 上调评级' :
                     newsDirection === 'downgrade' ? '⬇️ 下调评级' : '➡️ 维持评级'}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    受影响债券
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-2">调整后评级</div>
                  {pendingRating ? (
                    <RatingBadge rating={pendingRating} size="lg" showChange oldRating={selectedHolding.currentRating} />
                  ) : (
                    <span className="text-2xl text-gray-500">--</span>
                  )}
                  {pendingRating && (
                    <div className="text-xs text-gray-500 mt-2">
                      风险权重：{(RATING_LEVELS.find(r => r.level === pendingRating)?.riskWeight * 100 || 0).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <div className="text-sm font-medium text-gray-300 mb-3">选择新评级</div>
                <div className="flex gap-3 flex-wrap">
                  {RATING_LEVELS.map((level) => (
                    <button
                      key={level.level}
                      onClick={() => isPlaying && setPendingRating(level.level)}
                      className={`
                        px-5 py-3 rounded-xl font-bold text-base transition-all btn-press
                        ${pendingRating === level.level
                          ? 'ring-2 ring-offset-2 ring-offset-slate-800 scale-110'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                        }
                        ${!isPlaying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                      style={{
                        backgroundColor: `${level.color}25`,
                        color: level.color,
                        border: `2px solid ${level.color}60`,
                      }}
                      disabled={!isPlaying}
                    >
                      {level.level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">调整理由</span>
                  <span className={`text-xs ${reason.trim().length > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {reason.trim().length > 0 ? '✓ 已填写' : '必填'}
                  </span>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请详细说明本次评级调整的理由，包括新闻分析、信用风险评估、财务指标变化等..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 text-sm resize-none h-24 transition-colors"
                  disabled={!isPlaying}
                />
              </div>

              {pendingRating && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-600"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-400">预期净值影响</span>
                      <div className="flex items-center gap-2 mt-1">
                        {expectedNavImpact >= 0 ? (
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-400" />
                        )}
                        <span className={`text-xl font-bold ${expectedNavImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {expectedNavImpact >= 0 ? '+' : ''}{formatCurrency(expectedNavImpact)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">调整后价值</div>
                      <div className="text-lg font-semibold text-white">
                        {formatCurrency(selectedHolding.marketValue * selectedHolding.position * (RATING_LEVELS.find(r => r.level === pendingRating)?.riskWeight || 0) / 100)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!isPlaying || !pendingRating || !reason.trim()}
                className={`
                  w-full py-4 rounded-xl font-bold text-lg transition-all btn-press
                  ${!isPlaying || !pendingRating || !reason.trim()
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25'
                  }
                `}
              >
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  确认提交评级调整
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BondHoldingsTable;
