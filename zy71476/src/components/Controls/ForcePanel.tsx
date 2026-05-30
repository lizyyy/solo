import React from 'react';
import { useExperimentStore } from '../../store/useExperimentStore';
import { FORCE_INFO } from '../../types';
import { Activity, ArrowDown, ArrowUp, MoveHorizontal } from 'lucide-react';

const ForcePanel: React.FC = () => {
  const { forces, params } = useExperimentStore();
  const willSlide = forces.parallelForce > forces.maxStaticFriction;

  const forceItems = [
    {
      key: 'gravity',
      value: forces.gravity,
      icon: ArrowDown,
      formula: 'G = mg',
      calculation: `${params.mass} × 9.8`,
    },
    {
      key: 'normalForce',
      value: forces.normalForce,
      icon: ArrowUp,
      formula: 'N = mg·cosθ',
      calculation: `${params.mass} × 9.8 × cos(${params.angle}°)`,
    },
    {
      key: 'parallelForce',
      value: forces.parallelForce,
      icon: MoveHorizontal,
      formula: 'G₁ = mg·sinθ',
      calculation: `${params.mass} × 9.8 × sin(${params.angle}°)`,
    },
    {
      key: 'frictionForce',
      value: forces.frictionForce,
      icon: Activity,
      formula: 'f = μ·N',
      calculation: `${params.frictionCoefficient} × ${forces.normalForce.toFixed(2)}`,
    },
    {
      key: 'maxStaticFriction',
      value: forces.maxStaticFriction,
      icon: Activity,
      formula: 'f_max = μ·mg·cosθ',
      calculation: `${params.frictionCoefficient} × ${forces.normalForce.toFixed(2)}`,
    },
  ];

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <h3 className="title-font text-lg font-semibold text-primary-400 flex items-center gap-2">
        <Activity size={20} />
        受力分析
      </h3>

      <div className="space-y-3">
        {forceItems.map((item) => {
          const info = FORCE_INFO[item.key as keyof typeof FORCE_INFO];
          const Icon = item.icon;
          const isParallel = item.key === 'parallelForce';
          const isMaxFriction = item.key === 'maxStaticFriction';

          return (
            <div
              key={item.key}
              className={`p-3 rounded-lg transition-all ${
                isMaxFriction && willSlide
                  ? 'bg-red-500/20 border border-red-500/30'
                  : isParallel && willSlide
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-dark-800/50 border border-dark-700/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: info.color }}
                  />
                  <span className="text-dark-200 text-sm font-medium">
                    {info.symbol} - {info.name}
                  </span>
                </div>
                <span
                  className="value-display font-bold text-lg"
                  style={{ color: info.color }}
                >
                  {item.value.toFixed(2)} {info.unit}
                </span>
              </div>
              <div className="text-xs text-dark-400 pl-5 space-y-0.5">
                <div className="font-mono">{item.formula}</div>
                <div className="text-dark-500">= {item.calculation}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-dark-800/50 border border-primary-500/30">
        <div className="text-xs text-dark-400 mb-1">力的比较</div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-force-parallel font-mono">G₁ = {forces.parallelForce.toFixed(2)}N</span>
          <span className={willSlide ? 'text-red-400' : 'text-green-400'}>
            {willSlide ? '>' : '<'}
          </span>
          <span className="text-force-gravity font-mono">f_max = {forces.maxStaticFriction.toFixed(2)}N</span>
        </div>
        <div className={`text-xs mt-1 ${willSlide ? 'text-red-400' : 'text-green-400'}`}>
          {willSlide
            ? '沿斜面分力 > 最大静摩擦力 → 物块滑动'
            : '沿斜面分力 ≤ 最大静摩擦力 → 物块静止'}
        </div>
      </div>
    </div>
  );
};

export default ForcePanel;
