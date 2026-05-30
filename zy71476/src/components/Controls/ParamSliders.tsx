import React from 'react';
import { useExperimentStore } from '../../store/useExperimentStore';
import { PHYSICAL_CONSTANTS } from '../../types';
import { Triangle, Box, CircleDot } from 'lucide-react';

const ParamSliders: React.FC = () => {
  const { params, setParams, threshold, isPlaying, setIsPlaying } = useExperimentStore();
  const { MIN_ANGLE, MAX_ANGLE, MIN_MASS, MAX_MASS, MIN_FRICTION, MAX_FRICTION } = PHYSICAL_CONSTANTS;

  const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ angle: value });
  };

  const handleMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ mass: value });
  };

  const handleFrictionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setParams({ frictionCoefficient: value });
  };

  return (
    <div className="glass rounded-xl p-5 space-y-6">
      <h3 className="title-font text-lg font-semibold text-primary-400 flex items-center gap-2">
        <CircleDot size={20} />
        实验参数
      </h3>

      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-dark-200 text-sm font-medium">
              <Triangle size={16} className="text-primary-400" />
              斜面角度
            </label>
            <span className="value-display text-primary-400 font-bold text-lg">
              {params.angle.toFixed(1)}°
            </span>
          </div>
          <input
            type="range"
            min={MIN_ANGLE}
            max={MAX_ANGLE}
            step={0.1}
            value={params.angle}
            onChange={handleAngleChange}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-dark-500">
            <span>{MIN_ANGLE}°</span>
            <span className="text-yellow-400">临界: {threshold.criticalAngle}°</span>
            <span>{MAX_ANGLE}°</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-dark-200 text-sm font-medium">
              <Box size={16} className="text-blue-400" />
              物块质量
            </label>
            <span className="value-display text-blue-400 font-bold text-lg">
              {params.mass.toFixed(1)} kg
            </span>
          </div>
          <input
            type="range"
            min={MIN_MASS}
            max={MAX_MASS}
            step={0.1}
            value={params.mass}
            onChange={handleMassChange}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-dark-500">
            <span>{MIN_MASS} kg</span>
            <span>{MAX_MASS} kg</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-dark-200 text-sm font-medium">
              <CircleDot size={16} className="text-purple-400" />
              摩擦系数
            </label>
            <span className="value-display text-purple-400 font-bold text-lg">
              {params.frictionCoefficient.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={MIN_FRICTION}
            max={MAX_FRICTION}
            step={0.01}
            value={params.frictionCoefficient}
            onChange={handleFrictionChange}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-dark-500">
            <span>{MIN_FRICTION} (光滑)</span>
            <span>{MAX_FRICTION} (粗糙)</span>
          </div>
        </div>
      </div>

      {threshold.status === 'sliding' && (
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`w-full py-3 rounded-lg font-semibold transition-all btn-click ${
            isPlaying
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-primary-500 hover:bg-primary-600 text-white shadow-glow'
          }`}
        >
          {isPlaying ? '⏸ 暂停动画' : '▶ 开始滑动'}
        </button>
      )}
    </div>
  );
};

export default ParamSliders;
