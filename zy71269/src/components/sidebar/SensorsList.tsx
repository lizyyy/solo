import { useMemo } from 'react';
import { useThermalStore } from '@/store/useThermalStore';
import { useView3DStore } from '@/store/useView3DStore';
import { Thermometer, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { getTemperatureColor } from '@/utils/colorMapping';

export const SensorsList = () => {
  const chipPackage = useThermalStore((state) => state.chipPackage);
  const filterConditions = useThermalStore((state) => state.filterConditions);
  const selectedItem = useThermalStore((state) => state.selectedItem);
  const setSelectedItem = useThermalStore((state) => state.setSelectedItem);
  const { colorScale, focusItem } = useView3DStore();
  
  const sensors = useMemo(() => {
    return chipPackage.tempSensors.filter(s => {
      if (s.isMissing) return true;
      const tempInRange = s.temperature >= filterConditions.tempRange[0] && 
                         s.temperature <= filterConditions.tempRange[1];
      const anomalyFilter = !filterConditions.showOnlyAnomalies || s.isMissing;
      return tempInRange && anomalyFilter;
    });
  }, [chipPackage.tempSensors, filterConditions]);

  const handleClick = (sensor: any) => {
    if (!sensor.isMissing) {
      setSelectedItem(sensor.id, 'sensor');
      focusItem(sensor.position);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700/50">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Thermometer className="w-4 h-4 text-cyan-400" />
        温度采样点 ({sensors.length})
      </h3>
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {sensors.map((sensor) => (
          <div
            key={sensor.id}
            onClick={() => handleClick(sensor)}
            className={`p-3 rounded-lg transition-all ${
              sensor.isMissing
                ? 'bg-red-500/10 border border-red-500/30 cursor-not-allowed'
                : selectedItem === sensor.id
                ? 'bg-cyan-500/20 border border-cyan-500/50 cursor-pointer'
                : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {sensor.isMissing ? (
                  <XCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                )}
                <span className="text-sm font-medium text-slate-200">{sensor.name}</span>
              </div>
              <span className="text-xs text-slate-400">{sensor.expectedLocation}</span>
            </div>
            
            {sensor.isMissing ? (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                <span>采样点缺失 - 数据不可用</span>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">温度:</span>
                  <span 
                    className="font-medium"
                    style={{ color: getTemperatureColor(sensor.temperature, colorScale.min, colorScale.max) }}
                  >
                    {sensor.temperature}°C
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">校准:</span>
                  <span className="text-slate-300">{sensor.lastCalibration}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
