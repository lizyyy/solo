import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useTimeStore } from '../../store/useTimeStore';
import { calculateSolarPosition, getSunriseSunset } from '../../utils/solarMath';

const monthNames = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

export function LeftPanel() {
  const {
    month,
    day,
    hour,
    isPlaying,
    playSpeed,
    setMonth,
    setDay,
    setHour,
    togglePlay,
    setPlaySpeed,
  } = useTimeStore();

  const solarPos = calculateSolarPosition(month, day, hour);
  const { sunrise, sunset } = getSunriseSunset(month, day);

  const formatTime = (h: number) => {
    const hours = Math.floor(h);
    const minutes = Math.floor((h % 1) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-72 bg-gray-900/90 backdrop-blur-md border-r border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-white font-semibold mb-4">时间控制</h3>

        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-2">
            月份: {monthNames[month - 1]}
          </label>
          <input
            type="range"
            min="1"
            max="12"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1月</span>
            <span>12月</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-2">
            日期: {day}日
          </label>
          <input
            type="range"
            min="1"
            max="31"
            value={day}
            onChange={(e) => setDay(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
        </div>
      </div>

      <div className="p-4 border-b border-gray-700">
        <label className="block text-gray-400 text-sm mb-2">
          时间: {formatTime(hour)}
        </label>
        <input
          type="range"
          min="6"
          max="18"
          step="0.1"
          value={hour}
          onChange={(e) => setHour(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setHour(6)}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            title="日出"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            className="p-3 bg-teal-600 hover:bg-teal-500 text-white rounded-full transition-colors"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setHour(18)}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            title="日落"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Gauge className="w-4 h-4" />
            <span>播放速度: {playSpeed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={playSpeed}
            onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
        </div>
      </div>

      <div className="p-4 flex-1">
        <h4 className="text-white font-medium mb-3">太阳参数</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">高度角</span>
            <span className="text-white font-mono">
              {solarPos.altitude > 0 ? `${solarPos.altitude.toFixed(1)}°` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">方位角</span>
            <span className="text-white font-mono">
              {solarPos.altitude > 0 ? `${solarPos.azimuth.toFixed(1)}°` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">日出</span>
            <span className="text-orange-400 font-mono">{formatTime(sunrise)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">日落</span>
            <span className="text-orange-400 font-mono">{formatTime(sunset)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">日照时长</span>
            <span className="text-teal-400 font-mono">
              {(sunset - sunrise).toFixed(1)}h
            </span>
          </div>
        </div>

        <div className="mt-6 p-3 bg-gray-800 rounded-lg">
          <div className="text-gray-400 text-xs mb-2">太阳位置指示</div>
          <div className="h-20 relative bg-gray-700 rounded overflow-hidden">
            <div
              className="absolute w-4 h-4 bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/50 transition-all duration-300"
              style={{
                left: `${Math.max(5, Math.min(95, ((hour - 6) / 12) * 100))}%`,
                top: `${Math.max(10, Math.min(80, 90 - solarPos.altitude * 1.5))}%`,
                transform: 'translate(-50%, -50%)',
                opacity: solarPos.altitude > 0 ? 1 : 0.3,
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
