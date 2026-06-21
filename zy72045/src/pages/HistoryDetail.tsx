import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { ReplayPlayer } from '../components/history/ReplayPlayer';
import { SourceCard } from '../components/common/SourceCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { useHistoryStore } from '../store/useHistoryStore';
import { useReplay } from '../hooks/useReplay';
import { formatCurrency, formatPercent, formatDateTime, getReturnColor } from '../utils/formatters';
import type { HistoryRound } from '../types/history';

export default function HistoryDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { loadRecordById, currentRecord } = useHistoryStore();
  const {
    currentRound,
    totalRounds,
    isPlaying,
    speed,
    currentRoundData: replayRoundData,
    goToRound,
    goToFirst,
    goToLast,
    goToPrev,
    goToNext,
    togglePlay,
    stop,
    setSpeed,
    speedOptions,
  } = useReplay(currentRecord);

  useEffect(() => {
    if (id) {
      loadRecordById(id);
    }
  }, [id, loadRecordById]);

  const currentRoundData = useMemo((): HistoryRound | undefined => {
    if (!currentRecord) return undefined;
    return currentRecord.rounds.find((r) => r.roundNumber === currentRound);
  }, [currentRecord, currentRound]);

  if (!currentRecord) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500 mb-4">未找到该记录</p>
          <button onClick={() => navigate('/history')} className="btn-primary">
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/history')}
              className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-serif text-xl font-bold text-neutral-800">历史回放</h1>
              <p className="text-xs text-neutral-500">{currentRecord.configName}</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/report/${currentRecord.id}`)}
            className="btn-primary text-sm flex items-center gap-1"
          >
            <FileText size={16} />
            查看报告
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="card mb-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-neutral-50 rounded">
              <p className="text-xs text-neutral-500 mb-1">总收益率</p>
              <p className={`text-xl font-bold font-mono ${getReturnColor(currentRecord.totalReturnPercent)}`}>
                {formatPercent(currentRecord.totalReturnPercent)}
              </p>
            </div>
            <div className="text-center p-3 bg-neutral-50 rounded">
              <p className="text-xs text-neutral-500 mb-1">胜率</p>
              <p className="text-xl font-bold font-mono">
                {formatPercent(currentRecord.settlement.winRate)}
              </p>
            </div>
            <div className="text-center p-3 bg-neutral-50 rounded">
              <p className="text-xs text-neutral-500 mb-1">最大回撤</p>
              <p className="text-xl font-bold font-mono text-danger-500">
                {formatPercent(currentRecord.settlement.maxDrawdown)}
              </p>
            </div>
            <div className="text-center p-3 bg-neutral-50 rounded">
              <p className="text-xs text-neutral-500 mb-1">交易次数</p>
              <p className="text-xl font-bold font-mono">
                {currentRecord.settlement.tradeCount}
              </p>
            </div>
          </div>
        </div>

        <ReplayPlayer
          record={currentRecord}
          currentRound={currentRound}
          totalRounds={totalRounds}
          isPlaying={isPlaying}
          speed={speed}
          speedOptions={speedOptions}
          onGoToRound={goToRound}
          onGoToFirst={goToFirst}
          onGoToLast={goToLast}
          onGoToPrev={goToPrev}
          onGoToNext={goToNext}
          onTogglePlay={togglePlay}
          onSetSpeed={setSpeed}
          onStop={stop}
        />

        {currentRoundData && (
          <div className="mt-6 grid grid-cols-12 gap-6">
            <div className="col-span-8">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-lg font-semibold">
                    第 {currentRoundData.roundNumber} 回合 - 新闻播报
                  </h3>
                  <span className="text-xs text-neutral-500 font-mono">
                    {formatDateTime(currentRoundData.timestamp)}
                  </span>
                </div>

                {currentRoundData.news.length > 0 ? (
                  <div className="space-y-4">
                    {currentRoundData.news.map((news) => (
                      <div key={news.id} className="p-4 bg-neutral-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusBadge status={news.confidence} type="confidence" />
                          <span className="text-xs text-neutral-500">{news.sourceName}</span>
                        </div>
                        <h4 className="font-serif font-semibold mb-1">{news.title}</h4>
                        <p className="text-sm text-neutral-600 mb-3">{news.content}</p>
                        <SourceCard sourceInfo={news} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-neutral-400">
                    本回合无新闻事件
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-4 space-y-6">
              <div className="card">
                <h3 className="font-serif text-lg font-semibold mb-4">
                  第 {currentRoundData.roundNumber} 回合 - 交易记录
                </h3>
                {currentRoundData.trades.length > 0 ? (
                  <div className="space-y-3">
                    {currentRoundData.trades.map((trade) => (
                      <div key={trade.id} className="p-3 bg-neutral-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-medium">{trade.symbol}</span>
                          <StatusBadge status={trade.action} type="trade" />
                        </div>
                        <div className="text-xs text-neutral-500 space-y-1">
                          <div className="flex justify-between">
                            <span>数量：{trade.quantity.toLocaleString()} 股</span>
                            <span>价格：{formatCurrency(trade.price)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>金额：{formatCurrency(trade.quantity * trade.price)}</span>
                          </div>
                          {trade.reason && (
                            <p className="text-neutral-600 mt-2 pt-2 border-t border-neutral-200">
                              理由：{trade.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-neutral-400 text-sm">
                    本回合无交易
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="font-serif text-lg font-semibold mb-4">
                  第 {currentRoundData.roundNumber} 回合 - 资产状态
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-neutral-400" />
                      <span className="text-sm text-neutral-600">总资产</span>
                    </div>
                    <span className="font-mono font-medium text-sm">
                      {formatCurrency(
                        currentRoundData.capital +
                        currentRoundData.positions.reduce((sum, p) => sum + p.marketValue, 0)
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-neutral-400" />
                      <span className="text-sm text-neutral-600">可用资金</span>
                    </div>
                    <span className="font-mono font-medium text-sm">
                      {formatCurrency(currentRoundData.capital)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} className="text-neutral-400" />
                      <span className="text-sm text-neutral-600">持仓市值</span>
                    </div>
                    <span className="font-mono font-medium text-sm">
                      {formatCurrency(
                        currentRoundData.positions.reduce((sum, p) => sum + p.marketValue, 0)
                      )}
                    </span>
                  </div>
                </div>

                {currentRoundData.positions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-neutral-100">
                    <p className="text-xs text-neutral-500 mb-2">持仓明细</p>
                    <div className="space-y-2">
                      {currentRoundData.positions.map((pos) => (
                        <div key={pos.symbol} className="flex justify-between text-xs">
                          <span className="text-neutral-600">{pos.name}</span>
                          <span className={`font-mono ${getReturnColor(pos.profitLossPercent)}`}>
                            {pos.quantity.toLocaleString()}股 {formatCurrency(pos.marketValue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
