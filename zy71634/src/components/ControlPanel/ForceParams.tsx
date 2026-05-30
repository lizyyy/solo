
import { ForceParams } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { Settings2 } from 'lucide-react';

interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const ParamSlider = ({ label, value, min, max, step, onChange }: ParamSliderProps) => (
  <div className="mb-3">
    <div className="flex items-center justify-between mb-1">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="text-slate-300 text-xs font-mono">{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
    />
  </div>
);

export const ForceParamsPanel = () => {
  const forceParams = useAppStore((state) => state.forceParams);
  const setForceParams = useAppStore((state) => state.setForceParams);

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Settings2 size={16} className="text-indigo-400" />
        <span className="text-white text-sm font-semibold">力导向参数</span>
      </div>
      
      <ParamSlider
        label="连线距离"
        value={forceParams.linkDistance}
        min={50}
        max={200}
        step={5}
        onChange={(v) => setForceParams({ linkDistance: v })}
      />
      
      <ParamSlider
        label="连线强度"
        value={forceParams.linkStrength}
        min={0.05}
        max={0.5}
        step={0.01}
        onChange={(v) => setForceParams({ linkStrength: v })}
      />
      
      <ParamSlider
        label="斥力强度"
        value={forceParams.charge}
        min={-300}
        max={-20}
        step={10}
        onChange={(v) => setForceParams({ charge: v })}
      />
      
      <ParamSlider
        label="中心引力"
        value={forceParams.centerStrength}
        min={0.01}
        max={0.2}
        step={0.01}
        onChange={(v) => setForceParams({ centerStrength: v })}
      />
    </div>
  );
};
