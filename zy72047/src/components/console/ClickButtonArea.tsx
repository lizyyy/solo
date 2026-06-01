import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Wrench,
  Flame,
  Shield,
  Dice6,
  Sparkles,
  MousePointer,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useClickOperation } from '@/hooks/useClickOperation';
import type { ClickButtonConfig } from '@/hooks/useClickOperation';

const getButtonIcon = (buttonId: string) => {
  const icons: Record<string, React.ReactNode> = {
    'btn-boost': <Zap className="w-6 h-6" />,
    'btn-repair': <Wrench className="w-6 h-6" />,
    'btn-risk': <Flame className="w-6 h-6" />,
    'btn-safe': <Shield className="w-6 h-6" />,
    'btn-gamble': <Dice6 className="w-6 h-6" />,
    'btn-easter': <Sparkles className="w-6 h-6" />,
  };
  return icons[buttonId] || <MousePointer className="w-6 h-6" />;
};

interface OperationButtonProps {
  config: ClickButtonConfig;
  disabled: boolean;
  isLastClicked: boolean;
  onClick: () => void;
}

const OperationButton = ({ config, disabled, isLastClicked, onClick }: OperationButtonProps) => {
  const { getVariantClasses, getButtonTooltip } = useClickOperation();
  const [showTooltip, setShowTooltip] = useState(false);

  const variantClasses = getVariantClasses(config.variant || 'primary', disabled);
  const tooltip = getButtonTooltip(config);

  return (
    <motion.div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <motion.button
        onClick={onClick}
        disabled={disabled}
        whileHover={disabled ? {} : { y: -2 }}
        whileTap={disabled ? {} : { scale: 0.95 }}
        animate={isLastClicked ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.3 }}
        className={variantClasses}
      >
        {getButtonIcon(config.id)}
        <span className="text-sm font-medium">{config.label}</span>
        <div className="flex gap-1 text-xs opacity-75">
          {config.effect.resource !== 0 && (
            <span className={config.effect.resource > 0 ? 'text-green-300' : 'text-red-300'}>
              {config.effect.resource > 0 ? '+' : ''}{config.effect.resource}
            </span>
          )}
          {config.effect.score !== 0 && (
            <span className={config.effect.score > 0 ? 'text-blue-300' : 'text-red-300'}>
              {config.effect.score > 0 ? '+' : ''}{config.effect.score}
            </span>
          )}
          {config.effect.risk !== 0 && (
            <span className={config.effect.risk > 0 ? 'text-orange-300' : 'text-green-300'}>
              {config.effect.risk > 0 ? '+' : ''}{config.effect.risk}
            </span>
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute -top-20 left-1/2 -translate-x-1/2 z-50 px-3 py-2 bg-vinyl-900 border border-vinyl-600 rounded-lg shadow-xl whitespace-nowrap"
          >
            <div className="text-xs font-medium text-vinyl-100 mb-1">{tooltip}</div>
            {config.description && (
              <div className="text-xs text-vinyl-400">{config.description}</div>
            )}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-vinyl-900 border-r border-b border-vinyl-600 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const ClickButtonArea = () => {
  const {
    handleClick,
    canClick,
    getAvailableButtons,
    getButtonTooltip,
    lastClicked,
    isPaused,
    currentRound,
    error,
    clearError,
  } = useClickOperation();

  const buttons = getAvailableButtons();

  const handleButtonClick = (config: ClickButtonConfig) => {
    if (!canClick(config.id)) return;
    handleClick(config.id, config.label);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-vinyl-900/90 backdrop-blur-sm rounded-2xl p-6 shadow-vinyl border border-vinyl-700 h-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MousePointer className="w-5 h-5 text-gold-500" />
          <h3 className="text-lg font-bold text-vinyl-100">点击按钮区</h3>
        </div>
        {!currentRound && (
          <span className="text-xs text-vinyl-500 px-2 py-1 bg-vinyl-800 rounded">
            等待比赛开始
          </span>
        )}
        {isPaused && currentRound && (
          <span className="text-xs text-yellow-500 px-2 py-1 bg-yellow-500/20 rounded">
            已暂停
          </span>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 p-2 bg-red-900/50 border border-red-500 rounded-lg flex items-center gap-2 text-red-300 text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {buttons.map((config) => (
          <OperationButton
            key={config.id}
            config={config}
            disabled={!canClick(config.id)}
            isLastClicked={lastClicked === config.id}
            onClick={() => handleButtonClick(config)}
          />
        ))}
      </div>

      {buttons.length === 0 && (
        <div className="text-center py-8 text-vinyl-500">
          <MousePointer className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>当前关卡没有可点击的按钮</p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-vinyl-500">
          <Info className="w-4 h-4" />
          <span>点击按钮执行对应操作</span>
        </div>
        <div className="text-vinyl-500">
          可用按钮: <span className="text-vinyl-300 font-mono">{buttons.length}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-vinyl-700">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-gold-500 to-gold-600" />
            <span className="text-vinyl-400">主要操作</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-vinyl-600 to-vinyl-700" />
            <span className="text-vinyl-400">次要操作</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-red-600 to-red-700" />
            <span className="text-vinyl-400">高风险操作</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-green-600 to-green-700" />
            <span className="text-vinyl-400">安全操作</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-yellow-500 to-yellow-600" />
            <span className="text-vinyl-400">警告操作</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-vinyl-700">
        <h4 className="text-sm font-medium text-vinyl-300 mb-2">效果图例</h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-green-400 font-mono">+N</span>
            <span className="text-vinyl-400">正向收益</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-red-400 font-mono">-N</span>
            <span className="text-vinyl-400">负向扣除</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-blue-400 font-mono">+N</span>
            <span className="text-vinyl-400">分数增加</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-orange-400 font-mono">+N</span>
            <span className="text-vinyl-400">风险增加</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-400 font-mono">-N</span>
            <span className="text-vinyl-400">风险降低</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
