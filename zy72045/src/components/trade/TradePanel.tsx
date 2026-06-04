import { useState, useEffect, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { NewsConfig, TradeAction } from '../../types/game';
import { useGameLogic } from '../../hooks/useGameLogic';
import { formatCurrency } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';

interface TradePanelProps {
  selectedNews: NewsConfig | null;
  onClose: () => void;
}

export function TradePanel({ selectedNews, onClose }: TradePanelProps) {
  const {
    availableStocks,
    canTrade,
    handleTrade,
    getCurrentPrice,
    getMaxBuyQuantity,
    getMaxSellQuantity,
  } = useGameLogic();

  const [symbol, setSymbol] = useState('');
  const [action, setAction] = useState<TradeAction>('hold');
  const [quantity, setQuantity] = useState(0);
  const [positionPercent, setPositionPercent] = useState(0);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (selectedNews && availableStocks.length > 0) {
      setSymbol(availableStocks[0].symbol);
      setAction('hold');
      setQuantity(0);
      setPositionPercent(0);
      setReason('');
    }
  }, [selectedNews, availableStocks]);

  const currentPrice = getCurrentPrice(symbol);
  const maxBuy = getMaxBuyQuantity(symbol);
  const maxSell = getMaxSellQuantity(symbol);
  const totalCost = quantity * currentPrice;

  const calcQuantity = useCallback((act: TradeAction, pct: number): number => {
    if (act === 'buy') {
      return Math.floor((maxBuy * pct) / 100 / 100) * 100;
    } else if (act === 'sell') {
      return Math.floor((maxSell * pct) / 100 / 100) * 100;
    }
    return 0;
  }, [maxBuy, maxSell]);

  const handleActionChange = (newAction: TradeAction) => {
    setAction(newAction);
    if (newAction === 'hold') {
      setQuantity(0);
      setPositionPercent(0);
    } else if (newAction === 'sell' && maxSell > 0) {
      setPositionPercent(100);
      setQuantity(maxSell);
    } else {
      setQuantity(0);
      setPositionPercent(0);
    }
  };

  const handleQuickPosition = (percent: number) => {
    const currentAction = action === 'hold' ? 'buy' : action;
    if (action === 'hold') {
      setAction('buy');
    }
    setPositionPercent(percent);
    setQuantity(calcQuantity(currentAction, percent));
  };

  const handleQuantityChange = (raw: string) => {
    const num = Number(raw);
    if (isNaN(num) || num < 0) {
      setQuantity(0);
      setPositionPercent(0);
      return;
    }
    const rounded = Math.floor(num / 100) * 100;
    setQuantity(rounded);
    const max = action === 'buy' ? maxBuy : maxSell;
    setPositionPercent(max > 0 ? Math.min(100, Math.round((rounded / max) * 100)) : 0);
  };

  const handleSubmit = () => {
    if (!selectedNews || !canTrade) return;

    handleTrade({
      newsEventId: selectedNews.id,
      symbol,
      action,
      quantity,
      price: currentPrice,
      position: positionPercent / 100,
      reason,
    });

    onClose();
    setAction('hold');
    setQuantity(0);
    setPositionPercent(0);
    setReason('');
  };

  if (!selectedNews) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-xl max-w-lg w-full mx-4 shadow-2xl overflow-hidden">
        <div className="bg-primary-500 text-white p-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">交易操作</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={selectedNews.confidence} type="confidence" />
            <span className="text-xs text-neutral-500">{selectedNews.sourceName}</span>
          </div>
          <p className="font-serif font-medium text-sm">{selectedNews.title}</p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-600 mb-2">
              选择标的
            </label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="input"
              disabled={!canTrade}
            >
              {availableStocks.map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.name} ({stock.symbol}) - {formatCurrency(getCurrentPrice(stock.symbol))}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-600 mb-2">
              操作方向
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleActionChange('buy')}
                className={`py-2 px-4 rounded font-medium text-sm transition-all ${
                  action === 'buy'
                    ? 'bg-danger-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
                disabled={!canTrade}
              >
                <TrendingUp size={16} className="inline mr-1" />
                买入
              </button>
              <button
                onClick={() => handleActionChange('sell')}
                className={`py-2 px-4 rounded font-medium text-sm transition-all ${
                  action === 'sell'
                    ? 'bg-success-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
                disabled={!canTrade || maxSell === 0}
              >
                <TrendingDown size={16} className="inline mr-1" />
                卖出
              </button>
              <button
                onClick={() => handleActionChange('hold')}
                className={`py-2 px-4 rounded font-medium text-sm transition-all ${
                  action === 'hold'
                    ? 'bg-neutral-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
                disabled={!canTrade}
              >
                <Minus size={16} className="inline mr-1" />
                观望
              </button>
            </div>
          </div>

          {action !== 'hold' && (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-2">
                  仓位比例
                </label>
                <div className="flex gap-2 mb-2">
                  {[25, 50, 75, 100].map((percent) => (
                    <button
                      key={percent}
                      onClick={() => handleQuickPosition(percent)}
                      className={`flex-1 py-1 px-2 text-xs rounded font-medium transition-all ${
                        positionPercent === percent
                          ? 'bg-primary-500 text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                      disabled={!canTrade}
                    >
                      {percent}%
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={positionPercent}
                  onChange={(e) => handleQuickPosition(Number(e.target.value))}
                  className="slider"
                  disabled={!canTrade}
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                  <span>0%</span>
                  <span>{positionPercent}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-2">
                  数量（股）
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="input flex-1"
                    min="0"
                    step="100"
                    max={action === 'buy' ? maxBuy : maxSell}
                    disabled={!canTrade}
                  />
                  <button
                    onClick={() => handleQuickPosition(100)}
                    className="btn-secondary"
                    disabled={!canTrade}
                  >
                    全部
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  {action === 'buy'
                    ? `最多可买 ${maxBuy.toLocaleString()} 股`
                    : `最多可卖 ${maxSell.toLocaleString()} 股`}
                </p>
              </div>

              {quantity > 0 && (
                <div className="p-3 bg-neutral-50 rounded text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-neutral-500">当前价格</span>
                    <span className="font-mono">{formatCurrency(currentPrice)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-neutral-500">预计{action === 'buy' ? '花费' : '收入'}</span>
                    <span className="font-mono text-primary-600">{formatCurrency(totalCost)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-600 mb-2">
              决策理由（选填）
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input resize-none h-20"
              placeholder="记录一下这次决策的原因..."
              disabled={!canTrade}
            />
          </div>
        </div>

        <div className="p-4 bg-neutral-50 flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary flex-1"
            disabled={!canTrade || (action !== 'hold' && quantity <= 0)}
          >
            确认{action === 'buy' ? '买入' : action === 'sell' ? '卖出' : '观望'}
          </button>
        </div>
      </div>
    </div>
  );
}
