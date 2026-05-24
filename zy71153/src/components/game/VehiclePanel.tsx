import { useGameStore } from '../../store/useGameStore';
import { Truck, Send, RotateCcw, X } from 'lucide-react';

export const VehiclePanel = () => {
  const {
    vehicles,
    selectedVehicle,
    selectedRoute,
    nodes,
    selectVehicle,
    clearRoute,
    dispatchVehicle,
    recallVehicle,
  } = useGameStore();

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      idle: '待命',
      loading: '装载中',
      moving: '行驶中',
      delivering: '配送中',
      returning: '返回中',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      idle: 'bg-green-500',
      loading: 'bg-blue-500',
      moving: 'bg-yellow-500',
      delivering: 'bg-purple-500',
      returning: 'bg-orange-500',
    };
    return colorMap[status] || 'bg-gray-500';
  };

  const getNodeName = (nodeId: string) => {
    return nodes.find((n) => n.id === nodeId)?.name || nodeId;
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">🚚 车辆列表</h3>
      
      <div className="space-y-3">
        {vehicles.map((vehicle) => {
          const isSelected = selectedVehicle === vehicle.id;
          const currentNodeName = getNodeName(vehicle.currentNode);
          
          return (
            <div
              key={vehicle.id}
              className={`rounded-lg p-3 cursor-pointer transition-all ${
                isSelected 
                  ? 'bg-blue-600/30 border-2 border-blue-500' 
                  : 'bg-slate-700/50 border border-slate-600 hover:border-slate-500'
              } ${vehicle.status !== 'idle' ? 'opacity-75' : ''}`}
              onClick={() => vehicle.status === 'idle' && selectVehicle(vehicle.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-white" />
                  <span className="text-white font-medium">{vehicle.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(vehicle.status)}`}>
                  {getStatusText(vehicle.status)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>位置: {currentNodeName}</div>
                <div>载重: {vehicle.currentWeight.toFixed(1)}/{vehicle.maxCapacity}</div>
                <div>速度: {vehicle.speed}x</div>
                <div>
                  物资: {vehicle.currentLoad.water + vehicle.currentLoad.medicine + vehicle.currentLoad.tent} 件
                </div>
              </div>

              {vehicle.status === 'moving' && vehicle.targetNodes.length > 0 && (
                <div className="mt-2 text-xs text-slate-400">
                  下一站: {getNodeName(vehicle.targetNodes[0])}
                </div>
              )}

              {isSelected && vehicle.status === 'idle' && (
                <div className="mt-3 pt-3 border-t border-slate-600">
                  {selectedRoute.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-300">
                          路线: {selectedRoute.length} 个站点
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearRoute();
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="text-xs text-slate-400 mb-2 flex flex-wrap gap-1">
                        {selectedRoute.map((nodeId, i) => (
                          <span key={nodeId}>
                            {i > 0 && ' → '}
                            {getNodeName(nodeId)}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatchVehicle();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-white text-sm"
                      >
                        <Send size={14} /> 出发
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 text-center">
                      点击地图上的节点规划路线
                    </div>
                  )}
                </div>
              )}

              {vehicle.status === 'idle' && currentNodeName !== '物资仓库' && currentNodeName !== '主仓库' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    recallVehicle(vehicle.id);
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs"
                >
                  <RotateCcw size={12} /> 返回仓库
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
