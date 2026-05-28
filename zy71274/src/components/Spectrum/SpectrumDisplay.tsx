import { useAppStore } from '@/store/appStore';
import { getWavelengthRange, wavelengthToColor } from '@/utils/physics';
import { Info } from 'lucide-react';

export function SpectrumDisplay() {
  const { spectrumLines, transitions, energyLevels, activeTransition } = useAppStore();

  const visibleLines = spectrumLines.filter(l => l.wavelength_nm >= 380 && l.wavelength_nm <= 750);

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Info size={16} className="text-cyan-400" />
        氢原子光谱
      </h3>

      <div className="relative h-16 rounded-lg overflow-hidden mb-4 bg-slate-900">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #8b5cf6 0%, #3b82f6 15%, #06b6d4 30%, #22c55e 45%, #eab308 60%, #f97316 75%, #ef4444 100%)'
          }}
        />
        
        {visibleLines.map((line) => {
          const position = ((line.wavelength_nm - 380) / (750 - 380)) * 100;
          const isActive = transitions.find(t => t.id === line.transition_id)?.id === activeTransition;
          
          return (
            <div
              key={line.id}
              className={`absolute top-0 bottom-0 w-0.5 transition-all duration-300 ${
                isActive ? 'bg-white shadow-lg z-10' : 'bg-black/30'
              }`}
              style={{
                left: `${position}%`,
                boxShadow: isActive ? `0 0 10px 2px ${line.color_hex}` : 'none',
                transform: isActive ? 'scaleX(2)' : 'scaleX(1)'
              }}
              title={`${line.series}: ${line.wavelength_nm}nm`}
            />
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-slate-500 mb-4">
        <span>380nm 紫</span>
        <span>500nm 蓝绿</span>
        <span>620nm 橙红</span>
        <span>750nm 红</span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {spectrumLines.map((line) => {
          const transition = transitions.find(t => t.id === line.transition_id);
          const fromLevel = energyLevels.find(l => l.id === transition?.from_level);
          const toLevel = energyLevels.find(l => l.id === transition?.to_level);
          const isActive = activeTransition === line.transition_id;
          const expectedColor = wavelengthToColor(line.wavelength_nm);
          const isUV = line.wavelength_nm < 380;
          const isIR = line.wavelength_nm > 750;

          return (
            <div
              key={line.id}
              className={`p-2 rounded-lg border transition-all ${
                isActive
                  ? 'border-cyan-400 bg-cyan-950/30'
                  : 'border-slate-700 bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded ${isUV || isIR ? 'opacity-50' : ''}`}
                    style={{
                      backgroundColor: isUV ? '#6b21a8' : isIR ? '#7f1d1d' : line.color_hex
                    }}
                  />
                  <div>
                    <div className="text-sm font-medium">{line.series}</div>
                    <div className="text-xs text-slate-400">
                      n={fromLevel?.n} → n={toLevel?.n}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono">{line.wavelength_nm}nm</div>
                  <div className="text-xs text-slate-500">
                    {isUV ? '紫外线' : isIR ? '红外线' : getWavelengthRange(line.wavelength_nm)}
                  </div>
                </div>
              </div>
              {(isUV || isIR) && (
                <div className="mt-1 text-xs text-amber-400">
                  ⚠️ 不可见光，理论颜色: {expectedColor}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
