import { useMemo } from 'react';
import { useThermalStore } from '@/store/useThermalStore';
import { Thermometer, Zap, AlertTriangle, Target } from 'lucide-react';

export const StatsPanel = () => {
  const chipPackage = useThermalStore((state) => state.chipPackage);
  
  const stats = useMemo(() => {
    const allTemps = [
      ...chipPackage.powerPoints.map(p => p.temperature),
      ...chipPackage.tempSensors.filter(s => !s.isMissing).map(s => s.temperature)
    ];
    const maxTemp = Math.max(...allTemps);
    const minTemp = Math.min(...allTemps);
    const avgTemp = allTemps.reduce((a, b) => a + b, 0) / allTemps.length;
    const hotspotCount = chipPackage.powerPoints.filter(p => p.status === 'critical').length;
    return { maxTemp, minTemp, avgTemp, hotspotCount };
  }, [chipPackage]);

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
