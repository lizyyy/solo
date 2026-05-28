import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import type { VinylRecord, PurchaseDecision } from '../types/game';

interface PurchasePanelProps {
  selectedPurchases: PurchaseDecision[];
  onPurchaseChange: (purchases: PurchaseDecision[]) => void;
  onShowDetail: (type: string, item: any) => void;
}

export const PurchasePanel: React.FC<PurchasePanelProps> = ({
  selectedPurchases,
  onPurchaseChange,
  onShowDetail
}) => {
  const { state } = useGame();
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [filterRarity, setFilterRarity] = useState<string>('all');

  const genres = ['all', ...new Set(state.vinylCatalog.map(r => r.genre))];
  const rarities = ['all', 'common', 'uncommon', 'rare', 'legendary'];

  const filteredRecords = state.vinylCatalog.filter(record => {
    const genreMatch = filterGenre === 'all' || record.genre === filterGenre;
    const rarityMatch = filterRarity === 'all' || record.rarity === filterRarity;
    return genreMatch && rarityMatch;
  });

  const getQuantity = (recordId: string) => {
    return selectedPurchases.find(p => p.recordId === recordId)?.quantity || 0;
  };

  const updateQuantity = (recordId: string, quantity: number) => {
    const existing = selectedPurchases.find(p => p.recordId === recordId);
    if (quantity <= 0) {
      onPurchaseChange(selectedPurchases.filter(p => p.recordId !== recordId));
    } else if (existing) {
      onPurchaseChange(selectedPurchases.map(p =>
        p.recordId === recordId ? { ...p, quantity } : p
      ));
    } else {
      onPurchaseChange([...selectedPurchases, { recordId, quantity }]);
    }
  };

  const totalCost = selectedPurchases.reduce((sum, p) => {
    const record = state.vinylCatalog.find(r => r.id === p.recordId);
    return sum + (record?.purchasePrice || 0) * p.quantity;
  }, 0);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-200 text-gray-700';
      case 'uncommon': return 'bg-green-200 text-green-700';
      case 'rare': return 'bg-blue-200 text-blue-700';
      case 'legendary': return 'bg-yellow-200 text-yellow-700';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getRarityLabel = (rarity: string) => {
    switch (rarity) {
      case 'common': return '普通';
      case 'uncommon': return '少见';
      case 'rare': return '稀有';
      case 'legendary': return '传奇';
      default: return rarity;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">📦 进货目录</h2>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          totalCost > state.cash ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          总计: ¥{totalCost}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <select
          value={filterGenre}
          onChange={(e) => setFilterGenre(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          {genres.map(g => (
            <option key={g} value={g}>{g === 'all' ? '全部类型' : g}</option>
          ))}
        </select>
        <select
          value={filterRarity}
          onChange={(e) => setFilterRarity(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          {rarities.map(r => (
            <option key={r} value={r}>{r === 'all' ? '全部稀有度' : getRarityLabel(r)}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredRecords.map((record: VinylRecord) => {
          const qty = getQuantity(record.id);
          const existingInventory = state.inventory.find(i => i.recordId === record.id);
          
          return (
            <div
              key={record.id}
              className={`p-3 border rounded-lg transition-all ${
                qty > 0 ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex gap-3">
                <img
                  src={record.imageUrl}
                  alt={record.title}
                  className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80"
                  onClick={() => onShowDetail('record', record)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800 truncate">{record.title}</h3>
                      <p className="text-sm text-gray-500">{record.artist}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRarityColor(record.rarity)}`}>
                      {getRarityLabel(record.rarity)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <span className="text-gray-600">进价: <span className="font-medium">¥{record.purchasePrice}</span></span>
                    <span className="text-gray-600">建议售价: <span className="text-green-600 font-medium">¥{record.suggestedPrice}</span></span>
                  </div>
                  
                  {existingInventory && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ 库存已有 {existingInventory.quantity} 张
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(record.id, Math.max(0, qty - 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-medium">{qty}</span>
                    <button
                      onClick={() => updateQuantity(record.id, qty + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
                    >
                      +
                    </button>
                    <button
                      onClick={() => onShowDetail('record', record)}
                      className="ml-auto text-xs text-blue-600 hover:underline"
                    >
                      查看详情 →
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
