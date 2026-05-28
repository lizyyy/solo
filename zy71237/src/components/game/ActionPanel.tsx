import { useState } from 'react';
import { Sparkles, Droplets, Hammer, Play, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { getActionsByCategory } from '../../data/actions';
import { ActionCategory, RestorationAction } from '../../types';
import { RiskBadge } from '../common/RiskBadge';
import { RiskPreview } from './RiskPreview';

const categories: { id: ActionCategory; name: string; icon: typeof Sparkles }[] = [
  { id: 'cleaning', name: '清洁', icon: Sparkles },
  { id: 'retouching', name: '补色', icon: Droplets },
  { id: 'reinforcing', name: '加固', icon: Hammer },
];

export function ActionPanel() {
  const {
    selectedAction,
    selectAction,
    executeAction,
    finishGame,
    resetGame,
    remainingTime,
  } = useGameStore();
  const [activeCategory, setActiveCategory] = useState<ActionCategory>('cleaning');

  const actions = getActionsByCategory(activeCategory);

  const handleActionClick = (action: RestorationAction) => {
    if (remainingTime >= action.timeCost) {
      selectAction(action);
    }
  };

  const handleConfirmAction = () => {
    if (selectedAction) {
      executeAction(selectedAction);
    }
  };

  const handleClosePreview = () => {
    selectAction(null);
  };

  return (
    <>
      <div className="card">
        <h3 className="text-lg font-serif font-bold text-museum-paper mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-museum-patina rounded-full" />
          修复操作
        </h3>

        <div className="flex gap-2 mb-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-museum-bronze text-museum-paper shadow-vintage-sm'
                    : 'bg-museum-bg text-museum-paper/60 hover:bg-museum-bronze/20'
                }`}
              >
                <Icon size={16} />
                {cat.name}
              </button>
            );
          })}
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
          <AnimatePresence mode="popLayout">
            {actions.map((action, index) => {
              const disabled = remainingTime < action.timeCost;
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <button
                    onClick={() => handleActionClick(action)}
                    disabled={disabled}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      disabled
                        ? 'border-museum-bronze/10 opacity-50 cursor-not-allowed'
                        : 'border-museum-bronze/30 hover:border-museum-bronze hover:bg-museum-bronze/10 cursor-pointer'
                    } ${
                      selectedAction?.id === action.id
                        ? 'border-museum-bronze bg-museum-bronze/20'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-medium text-museum-paper">{action.name}</span>
                      <RiskBadge level={action.riskLevel} showLabel={false} />
                    </div>
                    <p className="text-xs text-museum-paper/60 mb-2 line-clamp-2">
                      {action.description}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-museum-paper/50">
                        耗时: {action.timeCost} 单位
                      </span>
                      {disabled && (
                        <span className="text-red-400">时间不足</span>
                      )}
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="mt-4 pt-4 border-t border-museum-bronze/30 flex gap-2">
          <button
            onClick={finishGame}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2"
          >
            <Play size={16} />
            完成修复
          </button>
          <button
            onClick={resetGame}
            className="px-4 py-2.5 border border-museum-bronze/50 text-museum-bronze rounded-lg hover:bg-museum-bronze/10 transition-colors"
            title="重新开始"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {selectedAction && (
        <RiskPreview
          action={selectedAction}
          onClose={handleClosePreview}
          onConfirm={handleConfirmAction}
        />
      )}
    </>
  );
}
