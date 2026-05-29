import { useMemo } from 'react';
import { Gauge, Wind, Zap, Settings, AlertCircle } from 'lucide-react';
import { useEstimationStore } from '@/store/useEstimationStore';
import type { ConstraintViolation } from '@/types';
import { cn } from '@/lib/utils';

interface GaugeConfig {
  label: string;
  icon: React.ElementType;
  actual: number;
  min: number;
  max: number;
  unit: string;
  color: string;
  violation?: ConstraintViolation;
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function SemiCircleGauge({ actual, min, max, color, violation }: { actual: number; min: number; max: number; color: string; violation?: ConstraintViolation }) {
  const percentage = useMemo(() => {
    const clamped = Math.max(min, Math.min(max, actual));
    return ((clamped - min) / (max - min)) * 100;
  }, [actual, min, max]);

  const isWarning = violation?.severity === 'warning';
  const isError = violation?.severity === 'error';
  const displayColor = isError ? '#ff6b35' : isWarning ? '#eab308' : color;
  const radius = 45;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const needleTip = polarToCartesian(50, 55, 35, percentage * 1.8 - 90);

  return (
    <div className="relative w-full aspect-[2/1]">
      <svg viewBox="0 0 100 60" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={`gauge-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={displayColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={displayColor} stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#1a3a5c" strokeWidth="6" strokeLinecap="round" />
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke={`url(#gauge-${color})`} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        <line x1="50" y1="55" x2={needleTip.x} y2={needleTip.y} stroke={displayColor} strokeWidth="2" strokeLinecap="round" style={{ transition: 'x2 1.2s, y2 1.2s' }} />
        <circle cx="50" cy="55" r="4" fill={displayColor} />
        <circle cx="50" cy="55" r="2" fill="#020910" />
        <text x="10" y="58" fill="#4a6b8c" fontSize="8" textAnchor="middle">{min}</text>
        <text x="90" y="58" fill="#4a6b8c" fontSize="8" textAnchor="middle">{max}</text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pt-2">
        <div className="text-center">
          <p className="text-xl font-bold font-mono" style={{ color: displayColor }}>{actual.toFixed(1)}</p>
          <p className="text-[10px] text-ocean-400 -mt-1">{percentage.toFixed(0)}% 使用率</p>
        </div>
      </div>
    </div>
  );
}

function GaugeCard({ config, delay }: { config: GaugeConfig; delay: number }) {
  const { icon: Icon, label, actual, min, max, unit, color, violation } = config;
  const isWarning = violation?.severity === 'warning';
  const isError = violation?.severity === 'error';

  return (
    <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600/50 p-4 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg', isError ? 'bg-alert-500/20' : isWarning ? 'bg-yellow-500/20' : 'bg-ocean-600/50')}>
            <Icon className={cn('w-4 h-4', isError ? 'text-alert-500' : isWarning ? 'text-yellow-500' : color)} />
          </div>
          <span className="text-sm font-medium text-ocean-200">{label}</span>
        </div>
        {violation && <AlertCircle className={cn('w-4 h-4', isError ? 'text-alert-500' : 'text-yellow-500')} />}
      </div>
      <SemiCircleGauge actual={actual} min={min} max={max} color={color.replace('text-', '')} violation={violation} />
      <div className="flex items-center justify-between mt-1 text-[10px] text-ocean-400">
        <span>阈值范围</span>
        <span className="font-mono">{min} - {max} {unit}</span>
      </div>
      {violation && (
        <div className={cn('mt-2 p-2 rounded-lg text-[11px]', isError ? 'bg-alert-500/10 text-alert-500' : 'bg-yellow-500/10 text-yellow-500')}>
          {violation.message}
        </div>
      )}
    </div>
  );
}

export function DeviceGauge() {
  const { result, params } = useEstimationStore();

  const gaugeConfigs = useMemo((): GaugeConfig[] => {
    const violations = result?.deviceCheck.violations || [];
    const findViolation = (type: string) => violations.find(v => v.type === type);
    return [
      { label: '流速约束', icon: Wind, actual: params.flowVelocity, min: params.deviceConstraints.minFlowVelocity, max: params.deviceConstraints.maxFlowVelocity, unit: 'm/s', color: 'text-tech-400', violation: findViolation('velocity') },
      { label: '效率约束', icon: Settings, actual: params.efficiency, min: 0, max: params.deviceConstraints.maxEfficiency, unit: '', color: 'text-success-500', violation: findViolation('efficiency') },
      { label: '功率约束', icon: Zap, actual: result ? Math.max(...result.periodIntegration.map(s => s.power)) : 0, min: 0, max: params.deviceConstraints.ratedPower, unit: 'kW', color: 'text-ocean-300', violation: findViolation('power') },
    ];
  }, [params, result]);

  const overallStatus = useMemo(() => {
    if (!result?.deviceCheck) return null;
    const errors = result.deviceCheck.violations.filter(v => v.severity === 'error');
    const warnings = result.deviceCheck.violations.filter(v => v.severity === 'warning');
    if (errors.length > 0) return { label: '约束超限', color: 'text-alert-500', bg: 'bg-alert-500/20' };
    if (warnings.length > 0) return { label: '接近阈值', color: 'text-yellow-500', bg: 'bg-yellow-500/20' };
    return { label: '运行正常', color: 'text-success-500', bg: 'bg-success-500/20' };
  }, [result]);

  if (!result) {
    return (
      <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-tech-400" />
          <h3 className="text-base font-semibold text-white">设备约束仪表盘</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-ocean-800/30 rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-tech-400" />
          <h3 className="text-base font-semibold text-white">设备约束仪表盘</h3>
        </div>
        {overallStatus && (
          <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs', overallStatus.bg)}>
            <span className={cn('w-2 h-2 rounded-full animate-pulse', overallStatus.color.replace('text-', 'bg-'))} />
            <span className={overallStatus.color}>{overallStatus.label}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {gaugeConfigs.map((config, index) => <GaugeCard key={config.label} config={config} delay={index * 100} />)}
      </div>
    </div>
  );
}
