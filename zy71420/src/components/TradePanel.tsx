import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ShoppingCart, TrendingUp, TrendingDown, Plus, Minus } from 'lucide-react';

export function TradePanel() {
  const { bonds, positions, cash, selectedBondId, selectBond, buyBond, sellBond, status } = useGameStore();
  const [quantity, setQuantity] = useState(1);

  const selectedBond = bonds.find(b => b.id === selectedBondId);
  const position = positions.find(p => p.bondId === selectedBondId);

  const maxBuyQuantity = selectedBond ? Math.floor(cash / selectedBond.currentPrice) : 0;
  const maxSellQuantity = position?.quantity || 0;

  const handleBuy = () => {
    if (selectedBondId && quantity > 0 && quantity <= maxBuyQuantity) {
      buyBond(selectedBondId, quantity);
    }
  };

  const handleSell = () => {
    if (selectedBondId && quantity > 0 && quantity <= maxSellQuantity) {
      sellBond(selectedBondId, quantity);
    }
  };

  const adjustQuantity = (delta: number) => {
    const newQuantity = Math.max(1, quantity + delta);
    setQuantity(newQuantity);
  };

  if (status !== 'playing') {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
          <ShoppingCart className="text-gray-500" size={20} />
          交易面板
        </h2>
        <div className="text-center text-gray-500 py-8">
          🎮 点击「开始游戏」进行交易
        </div>
      </div>
    );
  }

  if (!selectedBond) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
          <ShoppingCart className="text-gray-500" size={20} />
          交易面板
        </h2>
        <div className="text-center text-gray-500 py-8">
          👆 点击上方债券卡片进行选择
        </div>
      </div>
    );
  }

  const totalCost = selectedBond.currentPrice * quantity;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-amber-200">
      <h2 className="text-lg font-bold text-amber-800 mb-4 flex items-center gap-2">
        <ShoppingCart className="text-amber-500" size={20} />
        交易面板
      </h2>

      <div className="bg-amber-50 rounded-xl p-4 mb-4">
        <div className="font-bold text-amber-900 text-lg">{selectedBond.name}</div>
        <div className="text-sm text-amber-700">当前价格: ¥{selectedBond.currentPrice.toFixed(2)}</div>
        <div className="text-sm text-amber-600">票息率: {selectedBond.couponRate}%</div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">交易数量</label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => adjustQuantity(-10)}
            className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700"
          >
            -10
          </button>
          <button
            onClick={() => adjustQuantity(-1)}
            className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700"
          >
            <Minus size={16} />
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="flex-1 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={() => adjustQuantity(1)}
            className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => adjustQuantity(10)}
            className="w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700"
          >
            +10
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-green-600">可买数量</div>
          <div className="text-xl font-bold text-green-700">{maxBuyQuantity} 张</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-red-600">可卖数量</div>
          <div className="text-xl font-bold text-red-700">{maxSellQuantity} 张</div>
        </div>
      </div>

      <div className="bg-gray-100 rounded-lg p-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">交易金额</span>
          <span className="text-xl font-bold text-gray-800">¥{totalCost.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleBuy}
          disabled={quantity > maxBuyQuantity || maxBuyQuantity === 0}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
        >
          <TrendingUp size={18} />
          买入
        </button>
        <button
          onClick={handleSell}
          disabled={quantity > maxSellQuantity || maxSellQuantity === 0}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
        >
          <TrendingDown size={18} />
          卖出
        </button>
      </div>
    </div>
  );
}
