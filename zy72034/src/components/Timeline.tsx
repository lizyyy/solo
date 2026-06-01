import React from 'react';
import { Clock, PauseCircle, AlertTriangle, Edit3, CheckCircle } from 'lucide-react';
import type { Round, PauseRecord, SupplementRecord, Transaction } from '../types';
import { cn } from '../lib/utils';

interface TimelineProps {
  rounds: Round[];
  pauseRecords: PauseRecord[];
  supplementRecords: SupplementRecord[];
  transactions: Transaction[];
  currentRound: number;
}

export const Timeline: React.FC<TimelineProps> = ({
  rounds,
  pauseRecords,
  supplementRecords,
  transactions,
  currentRound,
}) => {
  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoundTransactions = (roundNumber: number) => {
    return transactions.filter((tx) => tx.roundNumber === roundNumber);
  };

  const getRoundPauseRecords = (roundNumber: number) => {
    return pauseRecords.filter((pr) => pr.roundNumber === roundNumber);
  };

  const getRoundSupplementRecords = (roundNumber: number) => {
    return supplementRecords.filter((sr) => sr.roundNumber === roundNumber);
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {rounds.map((round, index) => {
          const isCurrent = round.roundNumber === currentRound;
          const isPast = round.roundNumber < currentRound;
          const roundTxs = getRoundTransactions(round.roundNumber);
          const roundPauses = getRoundPauseRecords(round.roundNumber);
          const roundSupplements = getRoundSupplementRecords(round.roundNumber);

          return (
            <div key={round.roundNumber} className="relative pl-10">
              <div
                className={cn(
                  'absolute left-0 w-8 h-8 rounded-full border-4 flex items-center justify-center',
                  isCurrent
                    ? 'bg-green-500 border-green-200 animate-pulse'
                    : isPast
                    ? 'bg-gray-400 border-gray-200'
                    : 'bg-white border-gray-300'
                )}
              >
                <span
                  className={cn(
                    'text-xs font-bold',
                    isCurrent || isPast ? 'text-white' : 'text-gray-400'
                  )}
                >
                  {round.roundNumber}
                </span>
              </div>

              <div
                className={cn(
                  'bg-white border-2 rounded-lg p-4 transition-all',
                  isCurrent
                    ? 'border-green-500 shadow-lg shadow-green-50'
                    : 'border-gray-200'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4
                    className={cn(
                      'font-bold',
                      isCurrent ? 'text-green-700' : 'text-gray-800'
                    )}
                  >
                    第 {round.roundNumber} 回合
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>
                      {formatTime(round.startTime)}
                      {round.endTime && ` - ${formatTime(round.endTime)}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm mb-2">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                    碳价: ¥{round.carbonPrice}/吨
                  </span>
                  {round.priceFluctuation !== 0 && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded',
                        round.priceFluctuation > 0
                          ? 'bg-red-50 text-red-600'
                          : 'bg-green-50 text-green-600'
                      )}
                    >
                      {round.priceFluctuation > 0 ? '+' : ''}
                      {round.priceFluctuation}%
                    </span>
                  )}
                  {round.isSupplemented && (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      已补录
                    </span>
                  )}
                </div>

                {roundTxs.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">交易记录 ({roundTxs.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {roundTxs.map((tx) => (
                        <span
                          key={tx.id}
                          className={cn(
                            'px-2 py-0.5 text-xs rounded flex items-center gap-1',
                            tx.type === 'sell'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-blue-50 text-blue-700',
                            tx.status === 'pending' && 'opacity-60'
                          )}
                        >
                          {tx.type === 'sell' ? '卖出' : '买入'}
                          {tx.amount}吨
                          {tx.status === 'pending' && (
                            <AlertTriangle className="w-3 h-3 text-yellow-500" />
                          )}
                          {tx.status === 'confirmed' && (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {roundPauses.length > 0 && (
                  <div className="mb-2">
                    {roundPauses.map((pause) => (
                      <div
                        key={pause.id}
                        className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 mb-1"
                      >
                        <PauseCircle className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <div className="font-medium">暂停记录</div>
                          <div>原因: {pause.reason}</div>
                          <div>
                            {formatTime(pause.pauseTime)}
                            {pause.resumeTime && ` - ${formatTime(pause.resumeTime)}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {roundSupplements.length > 0 && (
                  <div className="mb-2">
                    {roundSupplements.map((supp) => (
                      <div
                        key={supp.id}
                        className="flex items-start gap-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700 mb-1"
                      >
                        <Edit3 className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <div className="font-medium">补录记录</div>
                          <div>{supp.difference}</div>
                          <div className="text-purple-500">备注: {supp.remark}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                  <span className="font-medium">结算原因:</span> {round.settlementReason}
                </p>
              </div>

              {index < rounds.length - 1 && <div className="h-4" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
