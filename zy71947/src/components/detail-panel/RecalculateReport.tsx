import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSequenceStore } from '../../store/useSequenceStore';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  X,
  FileText,
} from 'lucide-react';

export const RecalculateReport: React.FC = () => {
  const { recalculateResult, showRecalculateReport, closeRecalculateReport } =
    useSequenceStore();

  if (!recalculateResult || !showRecalculateReport) return null;

  const direction =
    recalculateResult.timeOffset > 0
      ? '延后'
      : recalculateResult.timeOffset < 0
      ? '提前'
      : '无变化';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-space-900/80 flex items-center justify-center z-50 p-4"
        onClick={closeRecalculateReport}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="max-w-lg w-full glass-panel p-6 rounded-lg"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyber-cyan/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-cyber-cyan" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">重算完成</h3>
                <p className="text-xs text-gray-400">序列已重新计算</p>
              </div>
            </div>
            <button
              onClick={closeRecalculateReport}
              className="p-1 hover:bg-space-700 rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-space-800/50 rounded">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>受影响指令</span>
                </div>
                <div className="text-2xl font-bold text-cyber-purple font-mono">
                  {recalculateResult.affectedCommands.length}
                </div>
                <div className="text-[10px] text-gray-500">条</div>
              </div>
              <div className="p-3 bg-space-800/50 rounded">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Clock className="w-3 h-3" />
                  <span>整体时间</span>
                </div>
                <div className="text-2xl font-bold text-cyber-cyan font-mono">
                  {Math.abs(recalculateResult.timeOffset) > 0
                    ? direction
                    : '无变化'}
                </div>
                <div className="text-[10px] text-gray-500">
                  {Math.abs(recalculateResult.timeOffset) > 0
                    ? `${Math.abs(recalculateResult.timeOffset)} 秒`
                    : ''}
                </div>
              </div>
            </div>

            <div className="p-4 bg-space-800/50 rounded">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                <ArrowRight className="w-3 h-3" />
                <span>受影响指令ID</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recalculateResult.affectedCommands.slice(0, 8).map(id => (
                  <span
                    key={id}
                    className="px-2 py-0.5 bg-cyber-purple/20 text-cyber-purple text-[10px] font-mono rounded"
                  >
                    {id}
                  </span>
                ))}
                {recalculateResult.affectedCommands.length > 8 && (
                  <span className="px-2 py-0.5 bg-space-700 text-gray-400 text-[10px] font-mono rounded">
                    +{recalculateResult.affectedCommands.length - 8} 更多
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded">
              <div className="flex items-center gap-2 text-cyber-cyan text-xs mb-2">
                <FileText className="w-3 h-3" />
                <span>重算报告</span>
              </div>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {recalculateResult.report}
              </pre>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={closeRecalculateReport}
              className="btn-primary"
            >
              确认
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
