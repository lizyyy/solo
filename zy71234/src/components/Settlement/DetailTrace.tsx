import { motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import type { SplitDetail } from '../../types';
import { formatCurrency } from '../../utils/settlementEngine';

interface DetailTraceProps {
  split: SplitDetail | null;
  onClose: () => void;
}

export function DetailTrace({ split, onClose }: DetailTraceProps) {
  if (!split) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-music-card rounded-2xl p-6 max-w-lg w-full border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-music-gold font-serif text-xl">
            🔍 {split.partyName} - 分成明细溯源
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-music-darker rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-2">📄 基础分成（原始信息）</div>
            <div className="text-2xl font-bold text-white">
              {split.baseSplit.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400 mt-1">
              对应金额: {formatCurrency(split.amount * split.baseSplit / split.finalSplit)}
            </div>
          </div>

          {split.modifiers.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-2">🔄 卡牌效果调整</div>
              <div className="space-y-2">
                {split.modifiers.map((mod, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3 bg-music-darker rounded-lg p-3"
                  >
                    <ArrowRight className="w-4 h-4 text-music-gold" />
                    <div className="flex-1">
                      <div className="text-sm">{mod.cardName}</div>
                      <div className={`text-sm font-bold ${
                        mod.value > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {mod.value > 0 ? '+' : ''}{mod.value}%
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">最终分成</span>
              <span className="text-2xl font-bold text-music-gold">
                {split.finalSplit.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-400">最终金额</span>
              <span className="text-xl font-bold text-white">
                {formatCurrency(split.amount)}
              </span>
            </div>
          </div>

          <div className="bg-music-gold/10 rounded-lg p-3 border border-music-gold/30">
            <div className="text-xs text-music-gold mb-1">💡 计算说明</div>
            <div className="text-sm text-gray-300">
              基础分成 {split.baseSplit}%
              {split.modifiers.map(m => ` ${m.value > 0 ? '+' : ''}${m.value}%`).join('')}
              {' = '}{split.finalSplit}%
              <br />
              分成金额 = 可分配收入 × {split.finalSplit}%
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
