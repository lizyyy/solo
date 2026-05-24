import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, MapPin, Clock, Ruler } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { getCollisionSummary } from '../../utils/collision';
import { calculatePathLength } from '../../utils/pathCalculator';

export function InfoPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const { simulation, vehicle, currentSample } = useSimulationStore();

  const collisionSummary = getCollisionSummary(simulation.collisionPoints);
  const pathLength = simulation.currentPath.length > 0
    ? calculatePathLength(simulation.currentPath)
    : 0;

  const getStatusBadge = () => {
    if (simulation.currentPath.length === 0) {
      return {
        icon: Info,
        text: '等待模拟',
        color: 'text-gray-400 bg-gray-700',
      };
    }
    if (simulation.isCollision) {
      return {
        icon: AlertTriangle,
        text: `检测到 ${simulation.collisionPoints.length} 处碰撞`,
        color: 'text-red-400 bg-red-500/20',
      };
    }
    return {
      icon: CheckCircle,
      text: '安全通过',
      color: 'text-green-400 bg-green-500/20',
    };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="absolute right-4 top-20 w-72 bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <statusBadge.icon className={`w-5 h-5 ${statusBadge.color.split(' ')[0]}`} />
          <span className="font-semibold text-white">模拟信息</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          <div className={`px-3 py-2 rounded-lg ${statusBadge.color}`}>
            <div className="flex items-center gap-2">
              <statusBadge.icon className="w-5 h-5" />
              <span className="font-medium">{statusBadge.text}</span>
            </div>
          </div>

          {currentSample && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">当前场景</div>
              <div className="font-medium text-white">{currentSample.name}</div>
              <div className="text-sm text-gray-400 mt-1">{currentSample.description}</div>
              <div className="text-xs text-gray-500 mt-2">预期结果: {currentSample.expectedResult}</div>
            </div>
          )}

          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <Ruler className="w-3 h-3" />
              车辆信息
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">车型:</span>
                <span className="text-white ml-1">{vehicle.name}</span>
              </div>
              <div>
                <span className="text-gray-500">车长:</span>
                <span className="text-white ml-1">{vehicle.length}m</span>
              </div>
              <div>
                <span className="text-gray-500">车宽:</span>
                <span className="text-white ml-1">{vehicle.width}m</span>
              </div>
              <div>
                <span className="text-gray-500">转弯半径:</span>
                <span className="text-white ml-1">{vehicle.turningRadius}m</span>
              </div>
            </div>
          </div>

          {simulation.currentPath.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                路径信息
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">路径长度:</span>
                  <span className="text-white ml-1">{pathLength.toFixed(1)}m</span>
                </div>
                <div>
                  <span className="text-gray-500">关键点:</span>
                  <span className="text-white ml-1">{simulation.currentPath.length}</span>
                </div>
              </div>
            </div>
          )}

          {simulation.collisionPoints.length > 0 && (
            <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
              <div className="text-xs text-red-400 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                碰撞详情
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <span className="text-gray-500">边界越界:</span>
                  <span className="text-red-400 ml-1">{collisionSummary.boundaryCount}</span>
                </div>
                <div>
                  <span className="text-gray-500">障碍物:</span>
                  <span className="text-red-400 ml-1">{collisionSummary.obstacleCount}</span>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {simulation.collisionPoints.slice(0, 5).map((collision) => (
                  <div
                    key={collision.id}
                    className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded"
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    t={(collision.timestamp * 100).toFixed(0)}%: {collision.description}
                  </div>
                ))}
                {simulation.collisionPoints.length > 5 && (
                  <div className="text-xs text-gray-500 text-center">
                    还有 {simulation.collisionPoints.length - 5} 处碰撞...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
