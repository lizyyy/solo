import React from 'react';
import { Pill, Bandage, Wrench, Trash2, Plus } from 'lucide-react';
import { useGameStore } from '../game/state';
import { ItemType } from '../game/types';

export const InventoryPanel: React.FC = () => {
  const { inventory, discardItem, currentLevel, currentNode, supplyItem, turn } = useGameStore();

  const currentNodeData = currentLevel?.nodes.find(n => n.id === currentNode);
  const isAtSupply = currentNodeData?.type === 'supply';

  const getItemIcon = (type: ItemType) => {
    switch (type) {
      case 'medicine': return <Pill className="w-4 h-4" />;
      case 'bandage': return <Bandage className="w-4 h-4" />;
      case 'tool': return <Wrench className="w-4 h-4" />;
    }
  };

  const getItemTypeColor = (type: ItemType) => {
    switch (type) {
      case 'medicine': return 'bg-rose-100 text-rose-600 border-rose-200';
      case 'bandage': return 'bg-sky-100 text-sky-600 border-sky-200';
      case 'tool': return 'bg-amber-100 text-amber-600 border-amber-200';
    }
  };

  return (
    <div className="game-card p-4">
      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="text-xl">🎒</span> 急救包
      </h3>

      {inventory.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">急救包为空</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {inventory.map((item, index) => {
            const expiryRemaining = item.expiryTurn ? item.expiryTurn - turn : null;
            const isExpiringSoon = expiryRemaining !== null && expiryRemaining <= 3;

            return (
              <div
                key={`${item.id}-${index}`}
                className={`p-3 rounded-lg border-2 ${item.isExpired ? 'bg-gray-100 border-gray-300 opacity-60' : getItemTypeColor(item.type)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getItemIcon(item.type)}
                    <div>
                      <span className="font-medium text-sm">
                        {item.name}
                        {item.quantity > 1 && <span className="ml-1">x{item.quantity}</span>}
                      </span>
                      {item.isExpired && (
                        <span className="ml-2 text-xs text-red-500 font-bold">(已过期!)</span>
                      )}
                      {!item.isExpired && isExpiringSoon && (
                        <span className="ml-2 text-xs text-orange-500">
                          (剩余 {expiryRemaining} 回合)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {(item.weight * item.quantity).toFixed(1)}kg
                    </span>
                    <button
                      onClick={() => discardItem(item.id, 1)}
                      className="p-1 hover:bg-white/50 rounded transition-colors"
                      title="丢弃"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
                    </button>
                  </div>
                </div>
                <p className="text-xs mt-1 opacity-70">{item.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {isAtSupply && currentNodeData?.supplyItems && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="font-bold text-gray-700 mb-2 text-sm flex items-center gap-2">
            <span>🏪</span> 补给站物资
          </h4>
          <div className="space-y-2">
            {currentNodeData.supplyItems.map((item, index) => (
              <div
                key={`supply-${item.id}-${index}`}
                className={`p-2 rounded-lg border ${getItemTypeColor(item.type)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getItemIcon(item.type)}
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs opacity-70">({item.weight}kg)</span>
                  </div>
                  <button
                    onClick={() => supplyItem(item.id)}
                    className="p-1 bg-white/70 hover:bg-white rounded transition-colors"
                    title="补给"
                  >
                    <Plus className="w-4 h-4 text-green-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
