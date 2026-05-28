import { useMemo } from 'react';
import { useThermalStore } from '@/store/useThermalStore';
import { Thermometer, Zap, AlertTriangle, Target } from 'lucide-react';

export const StatsPanel = () => {
  const chipPackage = useThermalStore((state) => state.chipPackage);
  const filterConditions = useThermalStore((state) => state.filterConditions);
  
  const stats = useMemo(() => {
    const filteredPowerPoints = chipPackage.powerPoints.filter(pp => {
      const tempInRange = pp.temperature >= filterConditions.tempRange[0] && 
                         pp.temperature <= filterConditions.tempRange[1];
      const powerInRange = pp.power >= filterConditions.powerRange[0] && 
                          pp.power <= filterConditions.powerRange[1];
      const isAnomaly = pp.status !== 'normal';
      const anomalyFilter = !filterConditions.showOnlyAnomalies || isAnomaly;
      return tempInRange && powerInRange && anomalyFilter;
    });

    const filteredSensors = chipPackage.tempSensors.filter(s => {
      if (s.isMissing) return true;
      const tempInRange = s.temperature >= filterConditions.tempRange[0] && 
                         s.temperature <= filterConditions.tempRange[1];
      const anomalyFilter = !filterConditions.showOnlyAnomalies || s.isMissing;
      return tempInRange && anomalyFilter;
    });

    const allTemps = [
      ...filteredPowerPoints.map(p => p.temperature),
      ...filteredSensors.filter(s => !s.isMissing).map(s => s.temperature)
    ];
    
    if (allTemps.length === 0) {
      return { maxTemp: 0, minTemp: 0, avgTemp: 0, hotspotCount: 0 };
    }
    
    const maxTemp = Math.max(...allTemps);
    const minTemp = Math.min(...allTemps);
    const avgTemp = allTemps.reduce((a, b) => a + b, 0) / allTemps.length;
    const hotspotCount = filteredPowerPoints.filter(p => p.status === 'critical').length;
    return { maxTemp, minTemp, avgTemp, hotspotCount };
  }, [chipPackage, filterConditions]);

  const statItems = [
    {
      label: '最高温度',
      value: `${stats.maxTemp.toFixed(1)}°C`,
      icon: Thermometer,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10'
    },
    {
      label: '最低温度',
      value: `${stats.minTemp.toFixed(1)}°C`,
      icon: Thermometer,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: '平均温度',
      value: `${stats.avgTemp.toFixed(1)}°C`,
      icon: Thermometer,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10'
    },
    {
      label: '热点数量',
      value: stats.hotspotCount.toString(),
      icon: AlertTriangle,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10'
    }
  ];

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700/50">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Target className="w-4 h-4 text-cyan-400" />
        实时统计
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {statItems.map((item, index) => (
          <div
            key={index}
            className={`${item.bgColor} rounded-lg p-3 transition-all hover:scale-105`}
          >
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-xs text-slate-400">{item.label}</span>
            </div>
            <div className={`text-lg font-bold ${item.color}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
