import { useState, useEffect } from 'react';
import { useView3DStore } from '@/store/useView3DStore';
import { useAnomalyStore } from '@/store/useAnomalyStore';
import { Thermometer, RotateCcw } from 'lucide-react';
import { createTemperatureGradient } from '@/utils/colorMapping';

export const ColorScaleBar = () => {
  const { colorScale, setColorScale } = useView3DStore();
  const { runDetection } = useAnomalyStore();
  const [minInput, setMinInput] = useState(colorScale.min.toString());
  const [maxInput, setMaxInput] = useState(colorScale.max.toString());

  useEffect(() => {
    setMinInput(colorScale.min.toString());
    setMaxInput(colorScale.max.toString());
  }, [colorScale.min, colorScale.max]);

  const handleApply = () => {
    const newMin = parseFloat(minInput);
    const newMax = parseFloat(maxInput);
    if (!isNaN(newMin) && !isNaN(newMax) && newMin < newMax) {
      setColorScale(newMin, newMax);
      setTimeout(() => runDetection(), 100);
    }
  };

  const handleReset = () => {
    setColorScale(50, 110);
  };

  const gradient = createTemperatureGradient(colorScale.min, colorScale.max);

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-3 border border-slate-700/50 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Thermometer className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-medium text-slate-200">温度色阶</span>
          <button
            onClick={handleReset}
            className="ml-auto p-1 rounded hover:bg-slate-700/50 transition-colors"
            title="重置"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        <div className="flex items-start gap-3">
          <div
            className="w-6 h-48 rounded-lg relative overflow-hidden"
            style={{ background: gradient }}
          >
            {[0, 25, 50, 75, 100].map((percent) => {
              const temp = colorScale.min + (colorScale.max - colorScale.min) * (1 - percent / 100);
              return (
                <div
                  key={percent}
                  className="absolute right-0 w-2 h-px bg-white/30"
                  style={{ top: `${percent}%` }}
                >
                  <span className="absolute -left-10 -top-2 text-[10px] text-slate-400 whitespace-nowrap">
                    {temp.toFixed(0)}°
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">最高 (°C)</label>
              <input
                type="number"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                onBlur={handleApply}
                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                className="w-16 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">最低 (°C)</label>
              <input
                type="number"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                onBlur={handleApply}
                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                className="w-16 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
