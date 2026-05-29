import { useEffect, useState, useMemo } from 'react';
import { Zap, Waves, TrendingUp, Calendar, Gauge, Activity } from 'lucide-react';
import { useEstimationStore } from '@/store/useEstimationStore';
import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  decimals?: number;
  delay?: number;
}

function AnimatedNumber({ value, suffix = '', decimals = 2, delay = 0 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setDisplayValue(0);
      
      const duration = 1500;
      const startTime = performance.now();
      const startValue = 0;
      const endValue = value;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = startValue + (endValue - startValue) * easeOut;
        
        setDisplayValue(current);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [value, delay]);

  const formatValue = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(decimals + 1);
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(decimals);
    }
    return num.toFixed(decimals);
  };

  const getUnit = () => {
    if (value >= 1000000) return 'M';
    if (value >= 1000) return 'k';
    return '';
  };

  return (
    <span className="font-mono tabular-nums">
      {formatValue(displayValue)}
      <span className="text-tech-400 text-lg ml-0.5">{getUnit()}{suffix}</span>
    </span>
  );
}

interface EnergyCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  suffix: string;
  color: string;
  delay: number;
  highlight?: boolean;
  decimals?: number;
}

function EnergyCard({ icon: Icon, label, value, suffix, color, delay, highlight, decimals = 2 }: EnergyCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-5 border animate-slide-up',
        highlight
          ? 'bg-gradient-to-br from-ocean-600/80 to-ocean-800/80 border-tech-500/50'
          : 'bg-ocean-700/50 border-ocean-600/50'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-r from-tech-500/10 to-transparent pointer-events-none" />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div
            className={cn(
              'p-2 rounded-lg',
              highlight ? 'bg-tech-500/20' : 'bg-ocean-600/50'
            )}
          >
            <Icon className={cn('w-5 h-5', color)} />
          </div>
          {highlight && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-tech-500/20 text-tech-400">
              核心指标
            </span>
          )}
        </div>
        <p className="text-xs text-ocean-300 mb-1">{label}</p>
        <p className={cn('text-2xl font-bold', highlight ? 'text-white' : 'text-ocean-100')}>
          <AnimatedNumber value={value} suffix={suffix} decimals={decimals} delay={delay + 200} />
        </p>
      </div>
    </div>
  );
}

export function EnergyDisplay() {
  const { result, isCalculating } = useEstimationStore();

  const metrics = useMemo(() => {
    if (!result) return [];
    return [
      { icon: Waves, label: '势能 (Ep)', value: result.potentialEnergy, suffix: 'Wh', color: 'text-tech-400', delay: 0 },
      { icon: Activity, label: '动能 (Ek)', value: result.kineticEnergy, suffix: 'Wh', color: 'text-ocean-300', delay: 100 },
      { icon: Zap, label: '总能量', value: result.totalEnergy, suffix: 'Wh', color: 'text-white', delay: 200, highlight: true },
      { icon: TrendingUp, label: '日发电量', value: result.dailyGeneration, suffix: 'Wh', color: 'text-success-500', delay: 300 },
      { icon: Calendar, label: '年发电量', value: result.annualGeneration, suffix: 'Wh', color: 'text-success-500', delay: 400 },
      { icon: Gauge, label: '容量系数', value: result.capacityFactor * 100, suffix: '%', color: 'text-tech-400', delay: 500, decimals: 1 },
    ];
  }, [result]);

  if (!result && !isCalculating) {
    return (
      <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-8 animate-fade-in">
        <div className="text-center py-8">
          <Zap className="w-12 h-12 text-ocean-500 mx-auto mb-4 opacity-50" />
          <p className="text-ocean-300 text-sm">暂无计算结果</p>
          <p className="text-ocean-500 text-xs mt-1">完成参数配置后点击计算按钮</p>
        </div>
      </div>
    );
  }

  if (isCalculating) {
    return (
      <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-8 animate-fade-in">
        <div className="text-center py-8">
          <div className="w-12 h-12 border-2 border-tech-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ocean-200 text-sm">正在计算能量结果...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-tech-400" />
          能量估算结果
        </h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
          <span className="text-xs text-ocean-300">实时计算</span>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <EnergyCard
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            suffix={metric.suffix}
            color={metric.color}
            delay={metric.delay}
            highlight={metric.highlight}
          />
        ))}
      </div>
    </div>
  );
}
