import { useAppStore } from '../../store/useAppStore';
import { MapPin, Flag } from 'lucide-react';

export const PointSelector = () => {
  const {
    campusData,
    selectedStartPoint,
    selectedEndPoint,
    setSelectedStartPoint,
    setSelectedEndPoint,
  } = useAppStore();

  if (!campusData) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          起点位置
        </label>
        <select
          value={selectedStartPoint || ''}
          onChange={(e) => setSelectedStartPoint(e.target.value || null)}
          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
        >
          <option value="">选择起点...</option>
          {campusData.startPoints.map((point) => (
            <option key={point.id} value={point.id}>
              {point.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          终点位置
        </label>
        <select
          value={selectedEndPoint || ''}
          onChange={(e) => setSelectedEndPoint(e.target.value || null)}
          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
        >
          <option value="">选择终点...</option>
          {campusData.endPoints.map((point) => (
            <option key={point.id} value={point.id}>
              {point.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <MapPin className="w-3 h-3" />
        <span>或直接点击3D场景中的标记点进行选择</span>
      </div>
    </div>
  );
};
