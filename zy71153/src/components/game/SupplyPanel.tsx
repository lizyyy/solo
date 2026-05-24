import { useGameStore } from '../../store/useGameStore';
import { SUPPLY_CONFIGS, SupplyType } from '../../types';
import { Plus, Minus } from 'lucide-react';

export const SupplyPanel = () => {
  const {
    warehouseSupplies,
    selectedVehicle,
    vehicles,
    nodes,
    loadSupply,
    unloadVehicle,
  } = useGameStore();

  const vehicle = vehicles.find((v) => v.id === selectedVehicle);
  const warehouseNode = nodes.find((n) => n.type === 'warehouse');
  const isAtWarehouse = warehouseNode && vehicle?.currentNode === warehouseNode.id;
  const canLoad = vehicle?.status === 'idle' && isAtWarehouse;

  const handleLoad = (type: SupplyType, amount: number) => {
    if (!canLoad) return;
    loadSupply(type, amount);
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">📦 物资管理</h3>
      
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-400 mb-2">仓库库存</h4>
        <div className="space-y-2">
          {SUPPLY_CONFIGS.map((supply) => (
            <div key={supply.type} className="flex items-center justify-between bg-slate-700/50 rounded px-3 py-2">
              <span className="text-white">
                {supply.emoji} {supply.name}
              </span>
              <span className="text-white font-bold">{warehouseSupplies[supply.type]}</span>
            </div>
          ))}
        </div>
      </div>

      {vehicle && (
        <div className="border-t border-slate-700 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-400">
              当前车辆: {vehicle.name}
            </h4>
            <span className={`text-xs px-2 py-1 rounded ${
              vehicle.currentWeight > vehicle.maxCapacity 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-green-500/20 text-green-400'
            }`}>
              {vehicle.currentWeight.toFixed(1)} / {vehicle.maxCapacity}
            </span>
          </div>
          
          <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
            <div 
              className={`h-2 rounded-full transition-all ${
                vehicle.currentWeight > vehicle.maxCapacity ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, (vehicle.currentWeight / vehicle.maxCapacity) * 100)}%` }}
            />
          </div>

          {canLoad ? (
            <div className="space-y-2">
              {SUPPLY_CONFIGS.map((supply) => (
                <div key={supply.type} className="flex items-center justify-between bg-slate-700/50 rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{supply.emoji}</span>
                    <span className="text-white text-sm">{supply.name}</span>
                    <span className="text-slate-400 text-xs">
                      (已装: {vehicle.currentLoad[supply.type]})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleLoad(supply.type, -1)}
                      disabled={vehicle.currentLoad[supply.type] === 0}
                      className="w-7 h-7 flex items-center justify-center bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
                    >
                      <Minus size={14} />
                    </button>
                    <button
                      onClick={() => handleLoad(supply.type, 1)}
                      disabled={warehouseSupplies[supply.type] === 0}
                      className="w-7 h-7 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
              
              <button
                onClick={unloadVehicle}
                disabled={vehicle.currentWeight === 0}
                className="w-full mt-2 px-3 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white text-sm"
              >
                卸载全部物资
              </button>
            </div>
          ) : (
            <div className="text-slate-400 text-sm text-center py-4">
              {vehicle.status !== 'idle' 
                ? '车辆行驶中，无法装载' 
                : !isAtWarehouse 
                  ? '车辆不在仓库' 
                  : '请先选择车辆'}
            </div>
          )}
        </div>
      )}

      {!selectedVehicle && (
        <div className="text-slate-400 text-sm text-center py-4">
          请在右侧选择一辆空闲车辆
        </div>
      )}
    </div>
  );
};
