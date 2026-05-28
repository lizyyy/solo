import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Shield, Scale, Zap, DollarSign, TrendingUp, TrendingDown, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RiskEvent, DisposalOption, RiskOptionLevel } from '@/types/tour';

interface RiskEventCardProps {
  event: RiskEvent;
  options: DisposalOption[];
  onOptionSelect?: (option: DisposalOption) => void;
  onClose?: () => void;
}

function getRiskTypeLabel(type: RiskEvent['type']) {
  const labels: Record<RiskEvent['type'], string> = {
    box_office: '票房风险',
    inventory: '库存风险',
    route: '路线风险',
    cashflow: '现金流风险',
  };
  return labels[type] || '未知风险';
}

function getRiskSeverityLabel(severity: RiskEvent['severity']) {
  return severity === 'critical' ? '严重' : '警告';
}

function getRiskLevelLabel(level: RiskEvent['level']) {
  const labels: Record<RiskEvent['level'], string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return labels[level] || '未知';
}

function getOptionLevelLabel(level: RiskOptionLevel) {
  const labels: Record<RiskOptionLevel, string> = {
    conservative: '保守',
    balanced: '平衡',
    aggressive: '激进',
  };
  return labels[level] || '未知';
}

function getOptionLevelIcon(level: RiskOptionLevel) {
  switch (level) {
    case 'conservative':
      return Shield;
    case 'balanced':
      return Scale;
    case 'aggressive':
      return Zap;
    default:
      return Shield;
  }
}

function getOptionLevelColor(level: RiskOptionLevel) {
  switch (level) {
    case 'conservative':
      return {
        text: 'text-success-green',
        bg: 'bg-success-green',
        border: 'border-success-green',
        shadow: 'shadow-neon-cyan',
      };
    case 'balanced':
      return {
        text: 'text-neon-cyan',
        bg: 'bg-neon-cyan',
        border: 'border-neon-cyan',
        shadow: 'shadow-neon-cyan',
      };
    case 'aggressive':
      return {
        text: 'text-warning-orange',
        bg: 'bg-warning-orange',
        border: 'border-warning-orange',
        shadow: 'shadow-neon-orange',
      };
    default:
      return {
        text: 'text-rock-light',
        bg: 'bg-rock-light',
        border: 'border-rock-light',
        shadow: '',
      };
  }
}

export default function RiskEventCard({
  event,
  options,
  onOptionSelect,
  onClose,
}: RiskEventCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const severityColor = event.severity === 'critical' ? 'danger-red' : 'warning-orange';
  const selectedOptionData = options.find(o => o.id === selectedOption);

  const handleOptionClick = (option: DisposalOption) => {
    if (isConfirmed) return;
    setSelectedOption(option.id);
  };

  const handleConfirm = () => {
    if (!selectedOptionData) return;
    setIsConfirming(true);

    setTimeout(() => {
      setIsConfirming(false);
      setIsConfirmed(true);
      onOptionSelect?.(selectedOptionData);
    }, 1500);
  };

  const formatImpact = (value: number) => {
    if (value === 0) return '无影响';
    return `${value > 0 ? '+' : ''}¥${value.toLocaleString('zh-CN')}`;
  };

  return (
    <motion.div
      className="relative w-full max-w-2xl bg-rock-dark/95 backdrop-blur-md border border-rock-light rounded-2xl overflow-hidden"
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <div className={cn(
        'absolute top-0 left-0 right-0 h-1',
        `bg-${severityColor}`
      )} />

      {onClose && !isConfirmed && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-rock-light/30 transition-colors z-10"
        >
          <X className="w-5 h-5 text-rock-light" />
        </button>
      )}

      <AnimatePresence>
        {isConfirming && (
          <motion.div
            className="absolute inset-0 bg-rock-darker/80 backdrop-blur-sm z-20 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center">
              <motion.div
                className="w-16 h-16 border-4 border-neon-cyan border-t-transparent rounded-full mx-auto mb-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="text-neon-cyan font-rock text-lg"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                正在执行决策...
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isConfirmed && (
          <motion.div
            className="absolute inset-0 bg-rock-darker/80 backdrop-blur-sm z-20 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-center">
              <motion.div
                className="w-20 h-20 rounded-full bg-success-green/20 flex items-center justify-center mx-auto mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
              >
                <CheckCircle2 className="w-12 h-12 text-success-green" />
              </motion.div>
              <motion.div
                className="text-success-green font-rock text-xl mb-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                决策已执行
              </motion.div>
              <motion.div
                className="text-rock-light text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {selectedOptionData && `已选择「${selectedOptionData.name}」方案`}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className={cn(
            'p-3 rounded-xl',
            `bg-${severityColor}/20`
          )}>
            <AlertTriangle className={cn('w-8 h-8', `text-${severityColor}`)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-bold',
                `bg-${severityColor}/20 text-${severityColor}`
              )}>
                {getRiskSeverityLabel(event.severity)}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neon-purple/20 text-neon-purple font-bold">
                {getRiskTypeLabel(event.type)}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rock-light/20 text-rock-light font-bold">
                风险等级: {getRiskLevelLabel(event.level)}
              </span>
            </div>
            <h3 className="text-xl font-rock text-white mb-2">{getRiskTypeLabel(event.type)}警报</h3>
            <p className="text-rock-light text-sm">{event.description}</p>
          </div>
        </div>

        <div className="p-4 bg-rock-darker/50 border border-rock-light rounded-xl mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className={cn('w-5 h-5', event.impact >= 0 ? 'text-success-green' : 'text-danger-red')} />
              <span className="text-rock-light text-sm">预计影响金额</span>
            </div>
            <span className={cn(
              'text-xl font-bold font-mono',
              event.impact >= 0 ? 'text-success-green' : 'text-danger-red'
            )}>
              {formatImpact(event.impact)}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-neon-cyan" />
            选择处置方案
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {options.map((option, index) => {
              const colors = getOptionLevelColor(option.riskLevel);
              const Icon = getOptionLevelIcon(option.riskLevel);
              const isSelected = selectedOption === option.id;

              return (
                <motion.button
                  key={option.id}
                  onClick={() => handleOptionClick(option)}
                  disabled={isConfirmed}
                  className={cn(
                    'relative p-4 rounded-xl border-2 transition-all duration-300 text-left',
                    'bg-rock-darker/50',
                    isSelected
                      ? `${colors.border} ${colors.shadow}`
                      : 'border-rock-light hover:border-rock-light/80',
                    isConfirmed && 'opacity-50 cursor-not-allowed'
                  )}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={!isConfirmed ? { scale: 1.02 } : {}}
                  whileTap={!isConfirmed ? { scale: 0.98 } : {}}
                >
                  {isSelected && (
                    <motion.div
                      className="absolute inset-0 rounded-xl opacity-20"
                      style={{ backgroundColor: option.riskLevel === 'conservative' ? '#4ade80' : option.riskLevel === 'balanced' ? '#00d4ff' : '#ff9a3c' }}
                      layoutId="selectedOptionBg"
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    />
                  )}

                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('p-1.5 rounded-lg', `${colors.bg}/20`)}>
                        <Icon className={cn('w-4 h-4', colors.text)} />
                      </div>
                      <span className={cn('font-bold text-sm', colors.text)}>
                        {getOptionLevelLabel(option.riskLevel)}
                      </span>
                    </div>

                    <h5 className="font-bold text-white mb-1">{option.name}</h5>
                    <p className="text-xs text-rock-light mb-3 line-clamp-2">{option.description}</p>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-rock-light">即时现金流</span>
                        <span className={cn(
                          'font-mono font-bold',
                          option.immediateImpact.cashFlow >= 0 ? 'text-success-green' : 'text-danger-red'
                        )}>
                          {formatImpact(option.immediateImpact.cashFlow)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-rock-light">风险指数变化</span>
                        <span className={cn(
                          'font-mono font-bold',
                          option.immediateImpact.riskIndex <= 0 ? 'text-success-green' : 'text-danger-red'
                        )}>
                          {option.immediateImpact.riskIndex > 0 ? '+' : ''}{option.immediateImpact.riskIndex}%
                        </span>
                      </div>

                      <div className="pt-2 border-t border-rock-light/30">
                        <div className="text-rock-light mb-1">预期结果</div>
                        <div className="grid grid-cols-3 gap-1 text-center">
                          <div>
                            <div className="text-success-green font-mono text-xs font-bold">
                              {option.projectedOutcome.bestCase > 0 ? '+' : ''}¥{Math.abs(option.projectedOutcome.bestCase).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-rock-light">最好</div>
                          </div>
                          <div>
                            <div className="text-neon-cyan font-mono text-xs font-bold">
                              {option.projectedOutcome.expectedCase > 0 ? '+' : ''}¥{Math.abs(option.projectedOutcome.expectedCase).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-rock-light">预期</div>
                          </div>
                          <div>
                            <div className="text-danger-red font-mono text-xs font-bold">
                              {option.projectedOutcome.worstCase > 0 ? '+' : ''}¥{Math.abs(option.projectedOutcome.worstCase).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-rock-light">最坏</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-rock-light">
          <div className="text-xs text-rock-light">
            <span className="text-white font-medium">提示：</span>
            保守方案风险低但收益有限，激进方案可能带来高回报但风险较高。
          </div>
          <motion.button
            onClick={handleConfirm}
            disabled={!selectedOption || isConfirmed || isConfirming}
            className={cn(
              'px-6 py-2.5 rounded-xl font-bold transition-all duration-300',
              selectedOption && !isConfirmed && !isConfirming
                ? 'bg-neon-pink text-white shadow-neon-pink hover:shadow-lg hover:scale-105'
                : 'bg-rock-gray text-rock-light cursor-not-allowed'
            )}
            whileHover={selectedOption && !isConfirmed && !isConfirming ? { scale: 1.05 } : {}}
            whileTap={selectedOption && !isConfirmed && !isConfirming ? { scale: 0.95 } : {}}
          >
            确认决策
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
