import React from 'react';
import { useGame } from '../context/GameContext';
import type { PriceAdjustment } from '../types/game';

interface InventoryPanelProps {
  priceAdjustments: PriceAdjustment[];
  onPriceChange: (adjustments: PriceAdjustment[]) => void;
  onShowDetail: (type: string, item: any) => void;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  priceAdjustments,
  onPriceChange,
  onShowDetail
}) => {
  const { state } = useGame();

  const getAdjustedPrice = (recordId: string) => {
    return priceAdjustments.find(a => a.recordId === recordId)?.newPrice;
  };

  const updatePrice = (recordId: string, newPrice: number) => {
    const existing = priceAdjustments.find(a => a.recordId === recordId);
    const currentItem = state.inventory.find(i => i.recordId === recordId);
    const basePrice = currentItem?.currentPrice || 0;

    if (Math.abs(newPrice - basePrice) < 1) {
      onPriceChange(priceAdjustments.filter(a => a.recordId !== recordId));
    } else if (existing) {
      onPriceChange(priceAdjustments.map(a =>
        a.recordId === recordId ? { ...a, newPrice } : a
      ));
    } else {
      onPriceChange([...priceAdjustments, { recordId, newPrice }]);
    }
  };

  const totalValue = state.inventory.reduce((sum, item) => {
    const adjusted = getAdjustedPrice(item.recordId);
    return sum + (adjusted || item.currentPrice) * item.quantity;
  }, 0);

  const totalCost = state.inventory.reduce((sum, item) => 
    sum + item.purchasePrice * item.quantity, 0);

  if (state.inventory.length === 0 || state.inventory.every(i => i.quantity === 0)) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4">🏪 当前库存</h2>
        <div className="text-center py-8 text-gray-500">
          <p className="text-4xl mb-2">📭</p>
          <p>库存为空</p>
          <p className="text-sm">从进货目录选择唱片开始经营吧！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">🏪 当前库存</h2>
        <div className="text-right text-sm">
          <p className="text-gray-600">成本: <span className="font-medium">¥{totalCost}</span></p>
          <p className="text-green-600">市值: <span className="font-bold">¥{totalValue}</span></p>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {state.inventory.filter(item => item.quantity > 0).map(item => {
          const record = state.vinylCatalog.find(r => r.id === item.recordId);
          if (!record) return null;

          const adjustedPrice = getAdjustedPrice(item.recordId);
          const displayPrice = adjustedPrice ?? item.currentPrice;
          const profit = displayPrice - item.purchasePrice;
          const profitMargin = item.purchasePrice > 0 ? (profit / item.purchasePrice * 100).toFixed(0) : 0;
          const isStagnant = item.daysInStock >= 7;

          return (
            <div
              key={item.recordId}
              className={`p-3 border rounded-lg transition-all ${
                isStagnant ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
              }`}
            >
              <div className="flex gap-3">
                <img
                  src={record.imageUrl}
                  alt={record.title}
                  className="w-14 h-14 object-cover rounded-lg cursor-pointer hover:opacity-80"
                  onClick={() => onShowDetail('record', record)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800 truncate">{record.title}</h3>
                      <p className="text-xs text-gray-500">{record.artist} · {record.genre}</p>
                    </div>
                    <span className="text-sm font-medium text-gray-700">x{item.quantity}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-gray-600">成本: ¥{item.purchasePrice}</span>
                    <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      利润: ¥{profit} ({profitMargin}%)
                    </span>
                    {isStagnant && (
                      <span className="text-orange-600" title="滞销警告">
                        ⚠️ {item.daysInStock}天
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">售价:</span>
                    <input
                      type="number"
                      value={displayPrice}
                      onChange={(e) => updatePrice(item.recordId, parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => onShowDetail('inventory', { item, record })}
                      className="ml-auto text-xs text-blue-600 hover:underline"
                    >
                      详情 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
