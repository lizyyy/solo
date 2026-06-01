import React, { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Calculator } from 'lucide-react';
import type { Farm, FarmState, TransactionType } from '../types';
import { useGameStore } from '../store/useGameStore';
import { cn } from '../lib/utils';

interface TradeFormProps {
  farm: Farm;
  farmState: FarmState | undefined;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const TradeForm: React.FC<TradeFormProps> = ({
  farm,
  farmState,
  onSuccess,
  onError,
}) => {
  const { currentRoundState, game, isReplaying, submitTransaction } = useGameStore();
  const [type, setType] = useState<TransactionType>('sell');
  const [amount, setAmount] = useState<string>('');

  const parsedAmount = parseInt(amount) || 0;
  const currentPrice = currentRoundState?.carbonPrice || 0;
  const totalValue = parsedAmount * currentPrice;

  const maxSellAmount = farmState?.carbonQuota || 0;
  const canSubmit =
    parsedAmount > 0 &&
    currentPrice > 0 &&
    game?.status === 'running' &&
    !isReplaying &&
    (type === 'buy' || parsedAmount <= maxSellAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const result = submitTransaction(farm.id, type, parsedAmount, currentPrice);
    if (result.success) {
      onSuccess?.(result.message);
      setAmount('');
    } else {
      onError?.(result.message);
    }
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-5">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Calculator className="w-5 h-5 text-green-600" />
        交易操作 - {farm.name}
      </h3>

      {game?.status !== 'running' || isReplaying ? (
        <div className="text-center py-8 text-gray-500">
          {isReplaying ? '回放模式下无法进行交易' : '请先开始游戏'}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('sell')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 rounded-lg font-medium transition-all',
                type === 'sell'
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              <ArrowUpCircle className="w-5 h-5" />
              卖出碳配额
            </button>
            <button
              type="button"
              onClick={() => setType('buy')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 rounded-lg font-medium transition-all',
                type === 'buy'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              <ArrowDownCircle className="w-5 h-5" />
              买入碳配额
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              交易数量（吨）
              {type === 'sell' && (
                <span className="text-gray-400 ml-2">最多可卖 {maxSellAmount} 吨</span>
              )}
            </label>
            <input
              type="number"
              min="1"
              max={type === 'sell' ? maxSellAmount : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="请输入数量"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-500 text-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">当前碳价</p>
              <p className="text-xl font-bold text-blue-600">¥{currentPrice}/吨</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">
                {type === 'sell' ? '预计收入' : '预计支出'}
              </p>
              <p
                className={cn(
                  'text-xl font-bold',
                  type === 'sell' ? 'text-green-600' : 'text-red-600'
                )}
              >
                {type === 'sell' ? '+' : '-'}¥{totalValue}
              </p>
            </div>
          </div>

          {type === 'sell' && parsedAmount > maxSellAmount && (
            <div className="text-sm text-red-500 text-center">
              碳配额不足，最多可卖出 {maxSellAmount} 吨
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'w-full py-3 rounded-lg font-bold text-white transition-all',
              canSubmit
                ? type === 'sell'
                  ? 'bg-green-500 hover:bg-green-600 active:bg-green-700'
                  : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed'
            )}
          >
            确认{type === 'sell' ? '卖出' : '买入'}
          </button>
        </form>
      )}
    </div>
  );
};
