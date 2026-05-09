import { formatDistance } from '../utils/geometry';

interface StatsBarProps {
  stats: {
    totalDistance: number;
    waypointCount: number;
    segmentCount: number;
    errorCount: number;
    warningCount: number;
  } | null;
}

export const StatsBar = ({ stats }: StatsBarProps) => {
  if (!stats) {
    return (
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span>等待绘制路径...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">总距离:</span>
          <span className="text-blue-400 font-mono font-semibold">
            {formatDistance(stats.totalDistance)}
          </span>
        </div>
        <div className="h-4 w-px bg-gray-600" />
        <div className="flex items-center gap-2">
          <span className="text-gray-400">航点:</span>
          <span className="text-white font-mono">{stats.waypointCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">分段:</span>
          <span className="text-white font-mono">{stats.segmentCount}</span>
        </div>
        <div className="h-4 w-px bg-gray-600" />
        <div className="flex items-center gap-2">
          <span className="text-gray-400">错误:</span>
          <span className={`font-mono font-semibold ${
            stats.errorCount > 0 ? 'text-red-400' : 'text-green-400'
          }`}>
            {stats.errorCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">警告:</span>
          <span className={`font-mono ${
            stats.warningCount > 0 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {stats.warningCount}
          </span>
        </div>
      </div>
    </div>
  );
};
