import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Activity, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CashFlowPanelProps {
  currentBalance: number;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  riskIndex?: number;
}

function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const startValue = displayValue;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (value - startValue) * easeProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  const formattedValue = useMemo(() => {
    return displayValue.toLocaleString('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }, [displayValue, decimals]);

  return (
    <span>
      {prefix}{formattedValue}{suffix}
    </span>
  );
}

function CashGauge({ value, maxValue }: { value: number; maxValue: number }) {
  const percentage = Math.max(0, Math.min(100, (value / maxValue) * 100));
  const angle = (percentage / 100) * 180;

  const getColor = () => {
    if (percentage >= 70) return '#4ade80';
    if (percentage >= 40) return '#ff9a3c';
    return '#ef4444';
  };

  const getStatusText = () => {
    if (percentage >= 70) return '健康';
    if (percentage >= 40) return '警告';
    return '危险';
  };

  const circumference = 180;
  const strokeDashoffset = circumference - (angle / 180) * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg className="w-32 h-32" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#ff9a3c" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#2d2d44"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <motion.path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            filter="url(#gaugeGlow)"
          />
          <motion.g
            animate={{ rotate: angle }}
            style={{ transformOrigin: '50px 50px' }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          >
            <circle cx="50" cy="50" r="4" fill={getColor()} filter="url(#gaugeGlow)" />
            <line x1="50" y1="50" x2="50" y2="18" stroke={getColor()} strokeWidth="3" strokeLinecap="round" />
          </motion.g>
        </svg>
      </div>
      <div className="mt-2 text-center">
        <div className="text-xs text-rock-light">现金流健康度</div>
        <motion.div
          className="text-sm font-bold"
          style={{ color: getColor() }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {getStatusText()}
        </motion.div>
      </div>
    </div>
  );
}

export default function CashFlowPanel({
  currentBalance,
  totalRevenue,
  totalExpense,
  netProfit,
  riskIndex = 0,
}: CashFlowPanelProps) {
  const maxBalance = useMemo(() => {
    const max = Math.max(Math.abs(currentBalance), Math.abs(totalRevenue), Math.abs(totalExpense), 1000);
    return Math.ceil(max * 1.5);
  }, [currentBalance, totalRevenue, totalExpense]);

  const stats = [
    {
      label: '当前余额',
      value: currentBalance,
      icon: Wallet,
      color: 'text-neon-cyan',
      bgColor: 'bg-neon-cyan',
      showSign: false,
    },
    {
      label: '总收入',
      value: totalRevenue,
      icon: TrendingUp,
      color: 'text-success-green',
      bgColor: 'bg-success-green',
      showSign: true,
    },
    {
      label: '总支出',
      value: totalExpense,
      icon: TrendingDown,
      color: 'text-danger-red',
      bgColor: 'bg-danger-red',
      showSign: false,
    },
    {
      label: '净利润',
      value: netProfit,
      icon: DollarSign,
      color: netProfit >= 0 ? 'text-success-green' : 'text-danger-red',
      bgColor: netProfit >= 0 ? 'bg-success-green' : 'bg-danger-red',
      showSign: true,
    },
  ];

  return (
    <div className="w-full p-6 bg-rock-dark/80 backdrop-blur-sm border border-rock-light rounded-xl">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-5 h-5 text-neon-pink" />
        <h2 className="text-xl font-rock text-white tracking-wider">现金流面板</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            className="relative p-4 bg-rock-darker/50 border border-rock-light rounded-lg overflow-hidden group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className={cn(
              'absolute top-0 left-0 w-1 h-full transition-all duration-300',
              stat.bgColor,
              'group-hover:w-1.5'
            )} />

            <div className="flex items-start justify-between mb-3">
              <div className={cn('p-2 rounded-lg bg-opacity-20', stat.bgColor)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              {stat.value !== 0 && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={stat.value > 0 ? 'up' : 'down'}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={cn('text-xs font-bold', stat.color)}
                  >
                    {stat.value > 0 ? '↑' : '↓'}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            <div className="text-xs text-rock-light mb-1">{stat.label}</div>
            <motion.div
              className={cn('text-xl font-bold font-mono', stat.color)}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
            >
              {stat.showSign && stat.value > 0 ? '+' : ''}
              <AnimatedNumber value={stat.value} prefix="¥" />
            </motion.div>

            <div className="mt-3 h-1 bg-rock-gray rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', stat.bgColor)}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (Math.abs(stat.value) / maxBalance) * 100)}%` }}
                transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
              />
            </div>
          </motion.div>
        ))}

        <motion.div
          className="p-4 bg-rock-darker/50 border border-rock-light rounded-lg flex flex-col items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <CashGauge value={currentBalance} maxValue={maxBalance} />

          {riskIndex > 0 && (
            <div className="mt-4 w-full">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-rock-light">风险指数</span>
                <span className={cn(
                  'font-bold',
                  riskIndex >= 70 ? 'text-danger-red' :
                  riskIndex >= 40 ? 'text-warning-orange' : 'text-success-green'
                )}>
                  {riskIndex}%
                </span>
              </div>
              <div className="h-1.5 bg-rock-gray rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    riskIndex >= 70 ? 'bg-danger-red' :
                    riskIndex >= 40 ? 'bg-warning-orange' : 'bg-success-green'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${riskIndex}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <div className="mt-6 flex items-center gap-4 p-3 bg-rock-darker/30 rounded-lg border border-rock-light/50">
        <Gauge className="w-4 h-4 text-neon-cyan" />
        <div className="flex-1 text-xs text-rock-light">
          <span className="text-white font-medium">现金流预测：</span>
          {netProfit >= 0
            ? '当前盈利趋势良好，建议预留30%资金作为应急储备。'
            : '当前处于亏损状态，需严格控制成本并增加收入来源。'}
        </div>
      </div>
    </div>
  );
}
