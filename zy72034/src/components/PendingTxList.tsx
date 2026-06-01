import React from 'react';
import { AlertTriangle, Check, X, Clock } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { cn } from '../lib/utils';

interface PendingTxListProps {
  onSuccess?: (message: string) => void;
}

export const PendingTxList: React.FC<PendingTxListProps> = ({ onSuccess }) => {
  const { farms, pendingTransactions, confirmTransaction, rejectTransaction, isReplaying } =
    useGameStore();

  if (pendingTransactions.length === 0 || isReplaying) {
    return null;
  }

  const getFarmName = (farmId: string) => {
    return farms.find((f) => f.id === farmId)?.name || '未知农场';
  };

  return (
    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
      <h3 className="text-lg font-bold text-yellow-800 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        待确认交易 ({pendingTransactions.length})
      </h3>

      <div className="space-y-2">
        {pendingTransactions.map((tx) => (
          <div
            key={tx.id}
            className="bg-white border border-yellow-200 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">{getFarmName(tx.farmId)}</span>
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs rounded font-medium',
                    tx.type === 'sell'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  )}
                >
                  {tx.type === 'sell' ? '卖出' : '买入'} {tx.amount}吨
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                第{tx.roundNumber}回合
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                单价: ¥{tx.price}/吨 | 金额: ¥{tx.amount * tx.price}
              </span>
            </div>

            {tx.reviewReason && (
              <div className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded mb-2">
                {tx.reviewReason}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  confirmTransaction(tx.id);
                  onSuccess?.('交易已确认');
                }}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition-colors"
              >
                <Check className="w-4 h-4" />
                确认
              </button>
              <button
                onClick={() => {
                  rejectTransaction(tx.id);
                  onSuccess?.('交易已拒绝');
                }}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-500 text-white rounded text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
                拒绝
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
