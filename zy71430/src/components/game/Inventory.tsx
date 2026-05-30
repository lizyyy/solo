
import React from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { getMineralById } from '../../data/minerals';

export const Inventory: React.FC = () => {
  const { inventory, inventoryCapacity, currentInventory } = useGameStore();

  const totalValue = inventory.reduce((total, item) => {
    const multiplier = item.isMixed ? 0.5 : 1;
    return total + item.quantity * item.unitValue * multiplier;
  }, 0);

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 shadow-xl">
      <h3 className="text-slate-200 font-semibold mb-3 flex items-center gap-2">
        <Package className="w-4 h-4 text-green-400" />
        矿石库存
      </h3>

      {inventory.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-8">
          库存为空
        </div>
      ) : (
        <div className="space-y-2">
          {inventory.map((item, index) => {
            const mineral = getMineralById(item.mineralId);
            return (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  item.isMixed
                    ? 'border-yellow-600 bg-yellow-900/30'
                    : 'border-slate-600 bg-slate-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: mineral?.color || '#666' }}
                    />
                    <span className="text-slate-200 text-sm">{item.mineralName}</span>
                    {item.isMixed && (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                  <span className="text-slate-300 text-sm font-mono">
                    {item.quantity} 单位
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>单价: {item.unitValue}/单位</span>
                  <span className={item.isMixed ? 'text-yellow-500' : 'text-green-400'}>
                    价值: {Math.floor(item.quantity * item.unitValue * (item.isMixed ? 0.5 : 1))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">总价值</span>
          <span className="text-amber-400 font-mono font-bold">
            {totalValue}
          </span>
        </div>
      </div>
    </div>
  );
};
