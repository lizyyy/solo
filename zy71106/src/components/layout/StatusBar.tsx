import { Calendar, Clock, Sun, CloudRain, Activity, Timer } from 'lucide-react';
import { useTimeStore } from '../../store/useTimeStore';
import { useSceneStore } from '../../store/useSceneStore';
import { calculateSolarPosition, getDaylightHours } from '../../utils/solarMath';

const monthNames = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

export function StatusBar() {
  const { month, day, hour, isPlaying } = useTimeStore();
  const {
    components,
    trees,
    filter,
    getFilteredComponents,
    realTimeShadows,
    getAverageAccumulatedShadowHours,
    getComponentShadowRate,
  } = useSceneStore();

  const solarPos = calculateSolarPosition(month, day, hour);
  const daylightHours = getDaylightHours(month, day);
  const filteredComponents = getFilteredComponents();
  const avgAccumulatedHours = getAverageAccumulatedShadowHours();

  const formatTime = (h: number) => {
    const hours = Math.floor(h);
    const minutes = Math.floor((h % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const avgShadowRate = filteredComponents.length > 0
    ? filteredComponents.reduce((sum, c) => sum + getComponentShadowRate(c.id), 0) / filteredComponents.length
    : 0;

  return (
    <div className="h-8 bg-gray-900/95 backdrop-blur-md border-t border-gray-700 flex items-center px-4 gap-6 text-xs">
      <div className="flex items-center gap-2 text-gray-400">
        <Calendar className="w-3.5 h-3.5" />
        <span>{monthNames[month - 1]} {day}日</span>
      </div>

      <div className="flex items-center gap-2 text-gray-400">
        <Clock className="w-3.5 h-3.5" />
        <span>{formatTime(hour)}</span>
      </div>

      <div className="flex items-center gap-2 text-gray-400">
        <Sun className="w-3.5 h-3.5 text-yellow-400" />
        <span>
          高度角: {solarPos.altitude > 0 ? `${solarPos.altitude.toFixed(1)}°` : '—'}
        </span>
        <span className="text-gray-600">|</span>
        <span>
          方位角: {solarPos.altitude > 0 ? `${solarPos.azimuth.toFixed(1)}°` : '—'}
        </span>
      </div>

      <div className="flex items-center gap-2 text-gray-400">
        <CloudRain className="w-3.5 h-3.5" />
        <span>日照时长: {daylightHours.toFixed(1)}h</span>
      </div>

      <div className="flex items-center gap-2">
        <Activity className={`w-3.5 h-3.5 ${isPlaying ? 'text-green-400 animate-pulse' : 'text-gray-500'}`} />
        <span className="text-gray-400">
          实时: {realTimeShadows.length > 0 ? '计算中' : '等待'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Timer className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-gray-400">累计遮挡:</span>
        <span className="text-orange-400 font-mono">{avgAccumulatedHours.toFixed(2)}h</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4 text-gray-400">
        <span>组件: {filteredComponents.length}/{components.length}</span>
        <span>树木: {trees.length}</span>
        {filter.groups.length > 0 && (
          <span className="text-teal-400">
            筛选: {filter.groups.join(', ')}
          </span>
        )}
      </div>

      <div className="h-4 w-px bg-gray-700" />

      <div className="flex items-center gap-2">
        <span className="text-gray-400">实时遮挡率:</span>
        <span
          className={`font-mono font-medium ${
            avgShadowRate < 10
              ? 'text-green-400'
              : avgShadowRate < 25
              ? 'text-yellow-400'
              : avgShadowRate < 50
              ? 'text-orange-400'
              : 'text-red-400'
          }`}
        >
          {avgShadowRate.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
