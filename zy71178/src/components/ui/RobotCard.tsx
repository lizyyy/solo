import { Robot } from '../../types/game';
import { Battery, Zap, Navigation, AlertTriangle } from 'lucide-react';

interface RobotCardProps {
  robot: Robot;
  isSelected: boolean;
  onSelect: () => void;
}

const statusLabels: Record<Robot['status'], string> = {
  idle: '待机',
  moving: '移动中',
  charging: '充电中',
  picking: '拣货中',
  dead: '故障',
};

const statusColors: Record<Robot['status'], string> = {
  idle: 'bg-gray-500',
  moving: 'bg-blue-500',
  charging: 'bg-cyan-500',
  picking: 'bg-green-500',
  dead: 'bg-red-500',
};

export function RobotCard({ robot, isSelected, onSelect }: RobotCardProps) {
  const batteryColor = robot.battery > 60 ? 'text-green-400' : robot.battery > 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-blue-900/50 border-2 border-blue-500 shadow-lg shadow-blue-500/20'
          : 'bg-gray-800/50 border border-gray-700 hover:border-gray-500'
      } ${robot.status === 'dead' ? 'opacity-50' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: robot.color }}
          />
          <span className="font-semibold text-white">{robot.name}</span>
        </div>
        <span className={`px-2 py-0.5 text-xs rounded-full text-white ${statusColors[robot.status]}`}>
          {statusLabels[robot.status]}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Battery className={`w-4 h-4 ${batteryColor}`} />
          <div className="flex-1 bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                robot.battery > 60 ? 'bg-green-500' : robot.battery > 30 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${robot.battery}%` }}
            />
          </div>
          <span className={`text-sm font-mono ${batteryColor}`}>
            {Math.round(robot.battery)}%
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Navigation className="w-3 h-3" />
          <span>
            位置: ({robot.position.x}, {robot.position.y})
          </span>
        </div>

        {robot.status === 'moving' && robot.path.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Zap className="w-3 h-3" />
            <span>
              剩余路径: {robot.path.length - robot.pathIndex} 格
            </span>
          </div>
        )}

        {robot.status === 'dead' && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            <span>机器人已故障</span>
          </div>
        )}
      </div>
    </div>
  );
}
