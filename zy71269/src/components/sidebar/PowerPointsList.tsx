import { useMemo } from 'react';
import { useThermalStore } from '@/store/useThermalStore';
import { useView3DStore } from '@/store/useView3DStore';
import { Zap, Eye } from 'lucide-react';
import { getTemperatureColor } from '@/utils/colorMapping';

export const PowerPointsList = () => {
  const chipPackage = useThermalStore((state) => state.chipPackage);
  const filterConditions = useThermalStore((state) => state.filterConditions);
  const selectedItem = useThermalStore((state) => state.selectedItem);
  const setSelectedItem = useThermalStore((state) => state.setSelectedItem);
  const { colorScale, focusItem } = useView3DStore();
  
  const powerPoints = useMemo(() => {
    return chipPackage.powerPoints.filter(pp => {
      const tempInRange = pp.temperature >= filterConditions.tempRange[0] && 
                         pp.temperature <= filterConditions.tempRange[1];
      const powerInRange = pp.power >= filterConditions.powerRange[0] && 
                          pp.power <= filterConditions.powerRange[1];
      const isAnomaly = pp.status !== 'normal';
      const anomalyFilter = !filterConditions.showOnlyAnomalies || isAnomaly;
      return tempInRange && powerInRange && anomalyFilter;
    });
  }, [chipPackage.powerPoints, filterConditions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'critical': return '严重';
      case 'warning': return '警告';
      default: return '正常';
    }
  };

  const handleClick = (pp: any) => {
    setSelectedItem(pp.id, 'powerPoint');
    focusItem(pp.position);
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700/50">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-yellow-400" />
        功耗点 ({powerPoints.length})
      </h3>
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {powerPoints.map((pp) => (
          <div
          key={pp.id}
          onClick={() => handleClick(pp)}
          className={`p-3 rounded-lg cursor-pointer transition-all ${
            selectedItem === pp.id
              ? 'bg-cyan-500/20 border border-cyan-500/50'
              : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-200">{pp.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(pp.status)} text-white`}>
              {getStatusText(pp.status)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">温度:</span>
              <span 
                className="font-medium" 
                style={{ color: getTemperatureColor(pp.temperature, colorScale.min, colorScale.max) }}>
                {pp.temperature}°C
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">功耗:</span>
              <span className="text-yellow-400 font-medium">{pp.power}W</span>
            </div>
          </div>
        </div>
        ))}
      </div>
    </div>
  );
};
