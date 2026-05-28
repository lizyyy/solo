import { useState } from 'react';
import { AlertTriangle, Search, CheckCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { DataGap } from '../../types';

export function DataGapIndicator() {
  const { dataGaps, remainingTime, detectGap } = useGameStore();
  const [expandedGap, setExpandedGap] = useState<string | null>(null);

  if (dataGaps.length === 0) return null;

  const unresolvedCount = dataGaps.filter(g => !g.resolved).length;

  const handleDetect = (gap: DataGap) => {
    if (remainingTime >= gap.detectCost) {
      detectGap(gap.id, gap.detectCost);
      setExpandedGap(null);
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-serif font-bold text-museum-paper mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-museum-ochre rounded-full" />
        信息缺口
        {unresolvedCount > 0 && (
          <span className="ml-auto px-2 py-0.5 bg-museum-ochre/20 text-museum-ochre text-xs rounded-full">
            {unresolvedCount} 项待确认
          </span>
        )}
      </h3>

      <div className="space-y-2">
        {dataGaps.map((gap) => (
          <motion.div
            key={gap.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="border border-museum-bronze/30 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedGap(expandedGap === gap.id ? null : gap.id)}
              className="w-full p-3 flex items-center gap-3 text-left hover:bg-museum-bronze/10 transition-colors"
            >
              {gap.resolved ? (
                <CheckCircle size={18} className="text-museum-patina flex-shrink-0" />
              ) : (
                <AlertTriangle size={18} className="text-museum-ochre flex-shrink-0 animate-pulse" />
              )}
              <span className={`flex-1 font-medium ${gap.resolved ? 'text-museum-paper/60' : 'text-museum-paper'}`}>
                {gap.displayName}
              </span>
              {gap.resolved ? (
                <span className="text-xs text-museum-patina">已确认</span>
              ) : (
                <span className="text-xs text-museum-ochre flex items-center gap-1">
                  <HelpCircle size={14} />
                  未知
                </span>
              )}
            </button>

            <AnimatePresence>
              {expandedGap === gap.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-museum-bronze/30"
                >
                  <div className="p-3 bg-museum-bg/50">
                    <p className="text-sm text-museum-paper/70 mb-3">
                      {gap.resolved ? gap.actualValue : gap.hint}
                    </p>
                    {!gap.resolved && (
                      <button
                        onClick={() => handleDetect(gap)}
                        disabled={remainingTime < gap.detectCost}
                        className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2"
                      >
                        <Search size={16} />
                        检测确认（消耗 {gap.detectCost} 时间）
                      </button>
                    )}
                    {!gap.resolved && remainingTime < gap.detectCost && (
                      <p className="text-xs text-red-400 mt-2 text-center">
                        时间不足，无法进行检测
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {unresolvedCount > 0 && (
        <div className="mt-3 p-2 bg-museum-ochre/10 border border-museum-ochre/30 rounded text-xs text-museum-ochre">
          <p>⚠ 未确认的信息可能增加修复操作的风险</p>
        </div>
      )}
    </div>
  );
}
