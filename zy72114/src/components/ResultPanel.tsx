import { cn } from '@/lib/utils';
import type { CalculationResult, SafetyLevel } from '../types';

interface ResultPanelProps {
  result: CalculationResult | null;
  isCalculating: boolean;
}

const safetyLevelConfig: Record<SafetyLevel, {
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  dotColor: string;
  description: string;
  icon: string;
}> = {
  low: {
    label: '安全',
    bgColor: 'bg-safe-50',
    borderColor: 'border-safe-400',
    textColor: 'text-safe-700',
    dotColor: 'bg-safe-500',
    description: '数据处于安全范围内，放心使用',
    icon: '✅',
  },
  medium: {
    label: '注意',
    bgColor: 'bg-warning-50',
    borderColor: 'border-warning-400',
    textColor: 'text-warning-700',
    dotColor: 'bg-warning-500',
    description: '部分指标接近警戒线，建议关注',
    icon: '⚠️',
  },
  high: {
    label: '警告',
    bgColor: 'bg-danger-50',
    borderColor: 'border-danger-400',
    textColor: 'text-danger-700',
    dotColor: 'bg-danger-500',
    description: '数据超出安全范围，需要处理',
    icon: '🚨',
  },
  danger: {
    label: '危险',
    bgColor: 'bg-red-900',
    borderColor: 'border-red-600',
    textColor: 'text-red-100',
    dotColor: 'bg-red-500',
    description: '严重超标！必须立即采取措施',
    icon: '💀',
  },
};

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  icon: string;
  delay: number;
}

function MetricCard({ label, value, unit, icon, delay }: MetricCardProps) {
  const displayValue = Number.isInteger(value) ? value : value.toFixed(2);

  return (
    <div
      className="eng-card p-4 opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm text-ink-600">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold text-ink-900 animate-roll-number">
          {displayValue}
        </span>
        <span className="text-sm text-ink-500">{unit}</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="eng-card p-8">
      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 border-4 border-blueprint-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blueprint-600 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-2 border-4 border-blueprint-400 rounded-full border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        </div>
        <h3 className="text-xl font-bold text-ink-800 mb-2">
          正在计算中...
        </h3>
        <p className="text-sm text-ink-500 text-center max-w-xs">
          正在使用物理模型进行弹道计算，请稍候片刻
        </p>
        <div className="mt-6 flex items-center gap-2">
          <div className="w-2 h-2 bg-blueprint-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-blueprint-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-blueprint-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="eng-card p-8">
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="w-20 h-20 rounded-full bg-ink-100 flex items-center justify-center mb-6">
          <span className="text-4xl">📊</span>
        </div>
        <h3 className="text-xl font-bold text-ink-800 mb-2">
          还没有计算结果
        </h3>
        <p className="text-sm text-ink-500 max-w-xs">
          导入数据并完成校验后，点击计算按钮即可查看弹道分析结果
        </p>
      </div>
    </div>
  );
}

export default function ResultPanel({ result, isCalculating }: ResultPanelProps) {
  if (isCalculating) {
    return <LoadingState />;
  }

  if (!result) {
    return <EmptyState />;
  }

  const safetyConfig = safetyLevelConfig[result.safetyLevel];

  const metrics = [
    {
      label: '射程',
      value: result.range,
      unit: result.rangeUnit,
      icon: '🎯',
      delay: 0.1,
    },
    {
      label: '冲击能量',
      value: result.impactEnergy,
      unit: result.impactEnergyUnit,
      icon: '💥',
      delay: 0.2,
    },
    {
      label: '最大高度',
      value: result.maxHeight,
      unit: result.maxHeightUnit,
      icon: '⬆️',
      delay: 0.3,
    },
    {
      label: '飞行时间',
      value: result.flightTime,
      unit: result.flightTimeUnit,
      icon: '⏱️',
      delay: 0.4,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="eng-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="eng-section-title mb-0 border-b-0 pb-0">
              <span>📊</span>
              计算结果
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <span>计算时间:</span>
            <span className="font-mono">
              {new Date(result.calculatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'eng-card p-5 border-2 opacity-0 animate-fade-in-up',
          safetyConfig.bgColor,
          safetyConfig.borderColor
        )}
        style={{ animationDelay: '0.05s' }}
      >
        <div className="flex items-center gap-4">
          <div className="text-4xl">{safetyConfig.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className={cn('text-lg font-bold', safetyConfig.textColor)}>
                安全等级: {safetyConfig.label}
              </span>
              <div className={cn('status-dot', safetyConfig.dotColor)}></div>
            </div>
            <p className="text-sm text-ink-600">
              {safetyConfig.description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div
        className="eng-card p-5 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '0.5s' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blueprint-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">💡</span>
          </div>
          <div>
            <h4 className="font-bold text-ink-800 mb-2">处理建议</h4>
            <p className="text-ink-600 leading-relaxed">
              {result.processingSuggestion ||
                '数据看起来不错，建议记录下来并继续下一步操作。如有疑问，可以复查一下原始数据哦~'}
            </p>
          </div>
        </div>
      </div>

      <div
        className="eng-card p-4 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '0.6s' }}
      >
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-ink-500">
            <span>🔬</span>
            <span>物理模型:</span>
            <span className="font-mono text-ink-700">{result.physicsModel}</span>
          </div>
          <div className="flex items-center gap-2 text-ink-500">
            <span>📐</span>
            <span>单位系统:</span>
            <span className="font-mono text-ink-700">
              {result.unitSystem === 'metric' ? '公制' : '英制'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
