import { Route } from '../../types';
import { MapPin, Clock, TrendingUp, ArrowUpDown } from 'lucide-react';

interface RouteInfoProps {
  route: Route;
}

export const RouteInfo = ({ route }: RouteInfoProps) => {
  const startPoint = route.startPoint.replace('start-', '');
  const endPoint = route.endPoint.replace('end-', '');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<MapPin className="w-4 h-4" />}
          label="总距离"
          value={`${route.totalDistance.toFixed(1)} 米`}
          color="text-blue-400"
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="预计时间"
          value={`${route.estimatedTime} 分钟`}
          color="text-green-400"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="最大坡度"
          value={`${route.validation.maxSlope.toFixed(1)}%`}
          color="text-orange-400"
        />
        <StatCard
          icon={<ArrowUpDown className="w-4 h-4" />}
          label="途经电梯"
          value={`${route.validation.elevatorCount} 个`}
          color="text-purple-400"
        />
      </div>

      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 space-y-2">
        <div className="text-xs text-gray-400">路线概览</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-white truncate">{startPoint}</span>
        </div>
        <div className="ml-1.5 w-0.5 h-4 bg-gray-600" />
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm text-white truncate">{endPoint}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-400">途经节点</div>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {route.waypoints.map((wp, i) => (
            <div
              key={wp.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/50 transition-colors"
            >
              <span className="w-5 h-5 flex items-center justify-center text-xs font-medium text-gray-500">
                {i + 1}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  wp.type === 'ramp'
                    ? 'bg-orange-500'
                    : wp.type === 'elevator'
                    ? 'bg-purple-500'
                    : wp.type === 'entrance'
                    ? 'bg-green-500'
                    : 'bg-gray-500'
                }`}
              />
              <span className="text-xs text-gray-300 flex-1">
                {wp.type === 'ramp'
                  ? '坡道'
                  : wp.type === 'elevator'
                  ? '电梯'
                  : wp.type === 'entrance'
                  ? i === 0
                    ? '起点'
                    : '终点'
                  : '途经点'}
              </span>
              {wp.slope > 0 && (
                <span className="text-xs text-gray-500">
                  {wp.slope.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) => (
  <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
    <div className={`${color} mb-1`}>{icon}</div>
    <div className="text-lg font-semibold text-white">{value}</div>
    <div className="text-xs text-gray-500">{label}</div>
  </div>
);
