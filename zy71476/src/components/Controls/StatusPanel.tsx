import React from 'react';
import { useExperimentStore } from '../../store/useExperimentStore';
import { STATUS_TEXT, STATUS_COLOR } from '../../types';
import { Gauge, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

const StatusPanel: React.FC = () => {
  const { threshold, params } = useExperimentStore();
  const { status, criticalAngle, reason } = threshold;

  const statusConfig = {
    static: {
      icon: CheckCircle2,
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      textColor: 'text-green-400',
      label: '静止状态',
    },
    sliding: {
      icon: Zap,
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      textColor: 'text-red-400',
      label: '滑动状态',
    },
    critical: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      textColor: 'text-yellow-400',
      label: '临界状态',
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const angleDiff = params.angle - criticalAngle;

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <h3 className="title-font text-lg font-semibold text-primary-400 flex items-center gap-2">
        <Gauge size={20} />
        阈值判定
      </h3>

      <div className={`p-4 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`status-dot ${status} w-4 h-4`}
            style={{ backgroundColor: STATUS_COLOR[status] }}
          />
          <span className={`font-bold text-xl ${config.textColor}`}>
            {STATUS_TEXT[status]}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-dark-400">当前角度</span>
            <span className="value-display font-semibold text-primary-400">
              {params.angle.toFixed(1)}°
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-dark-400">临界角度</span>
            <span className="value-display font-semibold text-yellow-400">
              {criticalAngle.toFixed(2)}°
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-dark-400">角度差值</span>
            <span
              className={`value-display font-semibold ${
                angleDiff > 0 ? 'text-red-400' : angleDiff < 0 ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {angleDiff > 0 ? '+' : ''}{angleDiff.toFixed(2)}°
            </span>
          </div>
        </div>

        <div className="mt-4 h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (params.angle / 90) * 100)}%`,
              backgroundColor: STATUS_COLOR[status],
              boxShadow: `0 0 10px ${STATUS_COLOR[status]}80`,
            }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-white/50"
            style={{
              left: `${(criticalAngle / 90) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-dark-500 mt-1">
          <span>0°</span>
          <span className="text-yellow-400">临界: {criticalAngle}°</span>
          <span>90°</span>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-dark-800/50 border border-dark-700/50">
        <div className="flex items-start gap-2">
          <StatusIcon size={18} className={config.textColor} style={{ marginTop: 2 }} />
          <div>
            <div className="text-dark-300 text-sm font-medium mb-1">判定理由</div>
            <p className="text-dark-400 text-sm leading-relaxed">
              {reason}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-dark-800/50">
          <div className="text-xs text-dark-500 mb-1">tan⁻¹(μ)</div>
          <div className="value-display text-sm text-primary-400 font-semibold">
            {criticalAngle.toFixed(1)}°
          </div>
        </div>
        <div className="p-2 rounded-lg bg-dark-800/50">
          <div className="text-xs text-dark-500 mb-1">μ</div>
          <div className="value-display text-sm text-purple-400 font-semibold">
            {params.frictionCoefficient.toFixed(2)}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-dark-800/50">
          <div className="text-xs text-dark-500 mb-1">tan(θ)</div>
          <div className="value-display text-sm text-blue-400 font-semibold">
            {Math.tan(params.angle * Math.PI / 180).toFixed(3)}
          </div>
        </div>
      </div>

      <div className="text-xs text-dark-500 p-3 rounded-lg bg-dark-900/50">
        <div className="font-medium text-dark-400 mb-1">💡 关键公式</div>
        <div className="font-mono">θ_critical = arctan(μ)</div>
        <div className="mt-1">当 θ {'>'} θ_critical 时，物块开始滑动</div>
        <div className="mt-1 text-dark-600">
          注意：临界角度与质量无关，仅由摩擦系数决定
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;
