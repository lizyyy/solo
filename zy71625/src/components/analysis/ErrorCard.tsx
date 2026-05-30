import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorEntry, ERROR_TYPE_INFO } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { formatTime } from '../../utils/exportUtils';
import { ChevronDown, AlertTriangle, Play } from 'lucide-react';

interface ErrorCardProps {
  error: ErrorEntry;
  onReplay?: (error: ErrorEntry) => void;
}

export const ErrorCard = ({ error, onReplay }: ErrorCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { repairSteps } = useGameStore();
  const info = ERROR_TYPE_INFO[error.type];
  const step = repairSteps.find(s => s.id === error.stepId);

  return (
    <motion.div
      layout
      className="bg-[#1a1a1a] border rounded-lg overflow-hidden"
      style={{ borderColor: `${info.color}30` }}
      whileHover={{ scale: 1.01 }}
    >
      <div
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${info.color}20` }}
          >
            <AlertTriangle size={18} style={{ color: info.color }} />
          </div>
          <div>
            <h4 className="text-sm font-serif" style={{ color: info.color }}>
              {info.name}
            </h4>
            <p className="text-xs text-white/50">{formatTime(error.timestamp)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onReplay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReplay(error);
              }}
              className="p-2 rounded-full hover:bg-white/5 transition-colors"
              style={{ color: info.color }}
              title="回放操作"
            >
              <Play size={14} />
            </button>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-white/50"
          >
            <ChevronDown size={18} />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-3 border-t border-white/5">
              <div className="pt-3">
                <p className="text-xs text-white/50 mb-1">错误描述</p>
                <p className="text-sm text-white/80">{error.description}</p>
              </div>

              {step && (
                <div>
                  <p className="text-xs text-white/50 mb-1">当时状态</p>
                  <div className="bg-black/30 rounded-lg p-3 text-xs space-y-1">
                    {step.snapshot.qualityScore !== undefined && (
                      <p className="text-white/70">
                        音质评分: <span className="text-[#D4A574]">{step.snapshot.qualityScore.toFixed(1)}</span>
                      </p>
                    )}
                    {step.snapshot.customerPatience !== undefined && (
                      <p className="text-white/70">
                        顾客耐心: <span className="text-[#D4A574]">{step.snapshot.customerPatience.toFixed(1)}</span>
                      </p>
                    )}
                    {step.params.result && (
                      <p className="text-white/70">
                        分数变化: <span className={step.params.result.scoreDelta > 0 ? 'text-green-400' : 'text-red-400'}>
                          {step.params.result.scoreDelta > 0 ? '+' : ''}{step.params.result.scoreDelta}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {Object.keys(error.params).length > 0 && (
                <div>
                  <p className="text-xs text-white/50 mb-1">操作参数</p>
                  <div className="bg-black/30 rounded-lg p-3">
                    <pre className="text-[10px] text-white/60 overflow-x-auto">
                      {JSON.stringify(error.params, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
