import React, { useState, useEffect } from 'react';
import { ShoppingCart, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';

interface TradePanelProps {
  cash: number;
  selectedStock: {
    code: string;
    name: string;
    price: number;
    isSuspended: boolean;
    currentHolding: number;
  } | null;
  onBuy: (code: string, quantity: number) => void;
  onSell: (code: string, quantity: number) => void;
}

export const TradePanel: React.FC<TradePanelProps> = ({
  cash,
  selectedStock,
  onBuy,
  onSell,
}) => {
  const [quantity, setQuantity] = useState<number>(100);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');

  useEffect(() => {
    setQuantity(100);
  }, [selectedStock]);

  const maxBuyQuantity = selectedStock 
    ? Math.floor(cash / selectedStock.price / 100) * 100
    : 0;

  const estimatedCost = selectedStock 
    ? quantity * selectedStock.price
    : 0;

  const handleTrade = () => {
    if (!selectedStock) return;
    
    if (tradeType === 'buy') {
      if (estimatedCost <= cash) {
        onBuy(selectedStock.code, quantity);
      }
    } else {
      if (quantity <= selectedStock.currentHolding) {
        onSell(selectedStock.code, quantity);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">交易面板</h3>
      
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <div className="flex items-center gap-2 text-gray-600">
          <DollarSign size={18} />
          <span>可用现金:</span>
          <span className="font-mono font-semibold text-slate-800">
            {formatCurrency(cash)}
          </span>
        </div>
      </div>

      {selectedStock ? (
        <div className="space-y-4">
          <div className="p-3 border border-gray-200 rounded">
            <div className="text-sm text-gray-500">选中股票</div>
            <div className="font-semibold text-slate-800">
              {selectedStock.name} ({selectedStock.code})
            </div>
            <div className="font-mono text-sm text-slate-600">
              价格: {formatCurrency(selectedStock.price)}
            </div>
            <div className="font-mono text-sm text-slate-600">
              当前持仓: {selectedStock.currentHolding} 股
            </div>
            {selectedStock.isSuspended && (
              <div className="mt-2 text-xs text-red-500 font-medium">
                ⚠️ 该股票已停牌，无法交易
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTradeType('buy')}
              className={`flex-1 py-2 rounded font-medium transition-colors ${
                tradeType === 'buy'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              买入
            </button>
            <button
              onClick={() => setTradeType('sell')}
              className={`flex-1 py-2 rounded font-medium transition-colors ${
                tradeType === 'sell'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              卖出
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">数量 (股)</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-gray-300 rounded font-mono"
              step={100}
              disabled={selectedStock.isSuspended}
            />
            <div className="flex gap-2 mt-2">
              {[100, 500, 1000, tradeType === 'buy' ? maxBuyQuantity : selectedStock.currentHolding].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuantity(q)}
                  className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">预估金额:</span>
              <span className="font-mono font-semibold">
                {formatCurrency(estimatedCost)}
              </span>
            </div>
            {tradeType === 'buy' && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">最大可买:</span>
                <span className="font-mono text-green-600">{maxBuyQuantity} 股</span>
              </div>
            )}
          </div>

          <button
            onClick={handleTrade}
            disabled={
              selectedStock.isSuspended ||
              quantity <= 0 ||
              (tradeType === 'buy' && estimatedCost > cash) ||
              (tradeType === 'sell' && quantity > selectedStock.currentHolding)
            }
            className={`w-full py-3 rounded font-medium flex items-center justify-center gap-2 transition-colors ${
              tradeType === 'buy'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            } disabled:bg-gray-300 disabled:cursor-not-allowed`}
          >
            <ShoppingCart size={18} />
            {tradeType === 'buy' ? '确认买入' : '确认卖出'}
          </button>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          请在左侧表格中选择股票进行交易
        </div>
      )}
    </div>
  );
};
