import { useRecordStore } from '@/store/useRecordStore';
import { TrendingUp, TrendingDown, Minus, Clock, User, MessageSquare } from 'lucide-react';

interface PriceHistoryViewProps {
  recordId: string;
}

export function PriceHistoryView({ recordId }: PriceHistoryViewProps) {
  const history = useRecordStore((s) => s.getPriceHistory(recordId));

  if (history.length === 0) {
    return (
      <div className="text-center py-6 text-vinyl-500 text-sm">
        暂无价格变更记录
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item, idx) => {
        const diff = item.toPrice - item.fromPrice;
        const isUp = diff > 0;
        const isDown = diff < 0;

        return (
          <div
            key={item.id}
            className="card animate-fade-in"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-vinyl-700 line-through opacity-60">
                  ¥{item.fromPrice.toFixed(2)}
                </span>
                <span className="text-xl font-bold text-vinyl-900">
                  ¥{item.toPrice.toFixed(2)}
                </span>
              </div>
              <div
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-sm font-medium ${
                  isUp
                    ? 'bg-green-100 text-green-700'
                    : isDown
                    ? 'bg-alert-500/10 text-alert-500'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isUp ? (
                  <TrendingUp className="w-4 h-4" />
                ) : isDown ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                {isUp ? '+' : ''}
                {diff.toFixed(2)}
              </div>
            </div>
            <div className="text-sm text-vinyl-600 space-y-1">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{item.operator}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(item.timestamp).toLocaleString('zh-CN')}</span>
              </div>
              {item.reason && (
                <div className="flex items-start gap-1.5 text-vinyl-700 mt-2 pt-2 border-t border-vinyl-700/10">
                  <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{item.reason}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
