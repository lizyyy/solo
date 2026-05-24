import { Sprout, Rows, Grid3X3, ArrowUpDown, CircleDot } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { SliderControl } from './SliderControl';

export function PlantControls() {
  const { plants, setPlants } = useSimulationStore();
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 bg-green-100 rounded-lg">
          <Sprout className="w-5 h-5 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">植株参数</h3>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Rows className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">行距设置</span>
        </div>
        <SliderControl
          label="行间距"
          value={plants.rowSpacing}
          min={60}
          max={300}
          step={5}
          unit="cm"
          onChange={(v) => setPlants({ rowSpacing: v })}
        />
        
        <div className="flex items-center gap-2 mb-2">
          <Grid3X3 className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">株距设置</span>
        </div>
        <SliderControl
          label="株间距"
          value={plants.plantSpacing}
          min={20}
          max={150}
          step={5}
          unit="cm"
          onChange={(v) => setPlants({ plantSpacing: v })}
        />
        
        <div className="flex items-center gap-2 mb-2">
          <ArrowUpDown className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">植株高度</span>
        </div>
        <SliderControl
          label="植株高度"
          value={plants.plantHeight}
          min={20}
          max={400}
          step={10}
          unit="cm"
          onChange={(v) => setPlants({ plantHeight: v })}
        />
        
        <div className="flex items-center gap-2 mb-2">
          <CircleDot className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">冠层大小</span>
        </div>
        <SliderControl
          label="冠层直径"
          value={plants.canopyDiameter}
          min={10}
          max={150}
          step={5}
          unit="cm"
          onChange={(v) => setPlants({ canopyDiameter: v })}
        />
        
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">行数</label>
            <input
              type="number"
              min={2}
              max={20}
              value={plants.rowsCount}
              onChange={(e) => setPlants({ rowsCount: Math.max(2, Math.min(20, parseInt(e.target.value) || 2)) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">每行株数</label>
            <input
              type="number"
              min={5}
              max={100}
              value={plants.plantsPerRow}
              onChange={(e) => setPlants({ plantsPerRow: Math.max(5, Math.min(100, parseInt(e.target.value) || 5)) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-green-50 rounded-lg">
        <div className="text-xs text-green-700">
          <span className="font-semibold">总株数：</span>
          <span className="text-lg font-bold">{plants.rowsCount * plants.plantsPerRow}</span> 株
        </div>
      </div>
    </div>
  );
}
