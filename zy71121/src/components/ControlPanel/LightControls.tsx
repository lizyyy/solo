import { Sun, Thermometer, Clock } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { SliderControl } from './SliderControl';

export function LightControls() {
  const { light, setLight, showHeatmap, setShowHeatmap } = useSimulationStore();
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-5 mt-4">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Sun className="w-5 h-5 text-amber-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">光照参数</h3>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Thermometer className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">太阳角度</span>
        </div>
        <SliderControl
          label="太阳高度角"
          value={light.sunAngle}
          min={10}
          max={80}
          step={1}
          unit="°"
          onChange={(v) => setLight({ sunAngle: v })}
        />
        
        <SliderControl
          label="光照强度"
          value={light.sunIntensity * 100}
          min={20}
          max={150}
          step={5}
          unit="%"
          onChange={(v) => setLight({ sunIntensity: v / 100 })}
        />
        
        <div className="flex items-center gap-2 mb-2 mt-4">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">时间设置</span>
        </div>
        <SliderControl
          label="时间轴"
          value={light.timeOfDay}
          min={6}
          max={18}
          step={0.5}
          unit="时"
          onChange={(v) => {
            setLight({ 
              timeOfDay: v,
              sunAngle: 10 + Math.sin((v - 6) / 12 * Math.PI) * 70,
            });
          }}
        />
        
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all ${
              showHeatmap
                ? 'bg-gradient-to-r from-red-500 via-amber-500 to-green-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showHeatmap ? '✓ 热力图已显示' : '显示光照热力图'}
          </button>
        </div>
      </div>
    </div>
  );
}
