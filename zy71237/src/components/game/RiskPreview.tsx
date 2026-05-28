import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, TrendingDown, TrendingUp, Clock, X } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { RiskBadge } from '../common/RiskBadge';
import { RestorationAction } from '../../types';

interface RiskPreviewProps {
  action: RestorationAction;
  onClose: () => void;
  onConfirm: () => void;
}

export function RiskPreview({ action, onClose, onConfirm }: RiskPreviewProps) {
  const { dataGaps } = useGameStore();
  const unresolvedGaps = dataGaps.filter(g => !g.resolved);
  const riskMultiplier = 1 + unresolvedGaps.length * 0.2;

  const formatDelta = (value?: number, inverse = false) => {
    if (!value) return null;
    const actual = inverse ? -value : value;
    if (actual > 0) {
      return <span className="text-museum-patina">+{actual}</span>;
    }
    return <span className="text-museum-cinnabar">{actual}</span>;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="card max-w-lg w-full"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-serif font-bold text-museum-paper mb-1">
                {action.name}
              </h3>
              <p className="text-sm text-museum-paper/70">{action.description}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-museum-bronze/20 rounded-lg transition-colors"
            >
              <X size={20} className="text-museum-paper/60" />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <RiskBadge level={action.riskLevel} />
            <div className="flex items-center gap-1 text-sm text-museum-paper/70">
              <Clock size={14} />
              耗时: {action.timeCost} 单位
            </div>
          </div>

          {unresolvedGaps.length > 0 && (
            <div className="mb-4 p-3 bg-museum-ochre/10 border border-museum-ochre/30 rounded-lg">
              <div className="flex items-center gap-2 text-museum-ochre text-sm mb-1">
                <AlertTriangle size={16} />
                <span className="font-medium">存在未确认信息</span>
              </div>
              <p className="text-xs text-museum-ochre/80">
                当前有 {unresolvedGaps.length} 项信息未确认，操作风险已提升至 {(riskMultiplier * 100 - 100).toFixed(0)}%
              </p>
            </div>
          )}

          <div className="mb-4">
            <h4 className="text-sm font-medium text-museum-paper mb-2">预期效果</h4>
            <div className="grid grid-cols-3 gap-3">
              {action.effects.stainDelta !== undefined && (
                <div className="p-3 bg-museum-bg/50 rounded-lg text-center">
                  <div className="text-xs text-museum-paper/60 mb-1">污渍程度</div>
                  <div className="text-lg font-bold">
                    {formatDelta(action.effects.stainDelta, true)}
                  </div>
                </div>
              )}
              {action.effects.paintLayerDelta !== undefined && (
                <div className="p-3 bg-museum-bg/50 rounded-lg text-center">
                  <div className="text-xs text-museum-paper/60 mb-1">颜料层</div>
                  <div className="text-lg font-bold">
                    {formatDelta(action.effects.paintLayerDelta)}
                  </div>
                </div>
              )}
              {action.effects.structureDelta !== undefined && (
                <div className="p-3 bg-museum-bg/50 rounded-lg text-center">
                  <div className="text-xs text-museum-paper/60 mb-1">结构强度</div>
                  <div className="text-lg font-bold">
                    {formatDelta(action.effects.structureDelta)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {(action.risks.overCleaningChance || action.risks.paintDamageChance || action.risks.structureDamageChance) && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-museum-paper mb-2">潜在风险</h4>
              <div className="space-y-2">
                {action.risks.overCleaningChance && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingDown size={14} className="text-museum-cinnabar" />
                    <span className="text-museum-paper/70">过度清洁风险:</span>
                    <span className="text-museum-cinnabar font-medium">
                      {(action.risks.overCleaningChance * riskMultiplier * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {action.risks.paintDamageChance && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingDown size={14} className="text-museum-cinnabar" />
                    <span className="text-museum-paper/70">颜料损伤风险:</span>
                    <span className="text-museum-cinnabar font-medium">
                      {(action.risks.paintDamageChance * riskMultiplier * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {action.risks.structureDamageChance && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingDown size={14} className="text-museum-cinnabar" />
                    <span className="text-museum-paper/70">结构损伤风险:</span>
                    <span className="text-museum-cinnabar font-medium">
                      {(action.risks.structureDamageChance * riskMultiplier * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {action.risks.materialIncompatibility && action.risks.materialIncompatibility.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={14} className="text-museum-ochre mt-0.5" />
                    <span className="text-museum-paper/70">
                      不兼容材料: {action.risks.materialIncompatibility.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h4 className="text-sm font-medium text-museum-paper mb-2">所需材料</h4>
            <div className="flex flex-wrap gap-2">
              {action.materialRequirements.map((material, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-museum-bronze/20 text-museum-bronzeLight text-xs rounded-full"
                >
                  {material}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 btn-secondary">
              取消
            </button>
            <button onClick={onConfirm} className="flex-1 btn-primary">
              确认执行
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
