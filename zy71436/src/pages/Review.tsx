import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Trophy, AlertTriangle, Zap, Download, ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Review() {
  const store = useGameStore();
  const navigate = useNavigate();
  const [selectedRound, setSelectedRound] = useState(0);

  const allConflicts = store.rounds.flatMap(r => r.conflictLogs);
  const allAnomalies = store.rounds.flatMap(r => r.anomalyEvents);
  const itemsWon = store.rounds.filter(r => r.winner === '你').length;
  const totalSpent = store.totalBudget - store.remainingBudget;

  const handleExport = () => {
    const report = store.exportReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const round = store.rounds[selectedRound];

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#c9a84c]/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 text-[#f5f0e8]/50 hover:text-[#f5f0e8] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#f5f0e8] font-display">拍卖复盘</h1>
            <p className="text-xs text-[#f5f0e8]/40">回顾竞价回合、信息冲突与异常事件</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold text-sm hover:bg-[#d4b65c] transition-all hover:shadow-[0_0_20px_rgba(201,168,76,0.3)]"
        >
          <Download className="w-4 h-4" />
          导出报告
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-4 p-4">
          <div className="col-span-2 space-y-2 overflow-y-auto pr-2">
            <h3 className="text-xs font-bold text-[#c9a84c] uppercase tracking-wider mb-3">回合</h3>
            {store.rounds.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelectedRound(i)}
                className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                  selectedRound === i
                    ? 'bg-[#c9a84c]/15 border border-[#c9a84c]/30'
                    : 'bg-[#1e1e30] border border-transparent hover:border-[#c9a84c]/10'
                }`}
              >
                <p className={`text-xs font-medium ${selectedRound === i ? 'text-[#c9a84c]' : 'text-[#f5f0e8]/50'}`}>
                  拍品 {i + 1}
                </p>
                <p className="text-xs text-[#f5f0e8]/30 truncate">{r.artwork.name}</p>
                {r.winner && (
                  <div className="flex items-center gap-1 mt-1">
                    {r.winner === '你' ? (
                      <Trophy className="w-3 h-3 text-[#2d5a3d]" />
                    ) : (
                      <Trophy className="w-3 h-3 text-[#8b2252]" />
                    )}
                    <span className="text-xs text-[#f5f0e8]/40">¥{(r.finalPrice / 10000).toFixed(0)}万</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="col-span-6 overflow-y-auto space-y-4 pr-2">
            {round && (
              <>
                <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <img
                      src={round.artwork.imageUrl}
                      alt={round.artwork.name}
                      className="w-32 h-24 object-cover rounded-lg"
                      loading="lazy"
                    />
                    <div className="flex-1 space-y-2">
                      <h3 className="text-lg font-bold text-[#f5f0e8] font-display">{round.artwork.name}</h3>
                      <p className="text-[#c9a84c] text-sm">{round.artwork.artist} · {round.artwork.year}</p>
                      <p className="text-[#f5f0e8]/50 text-xs leading-relaxed">{round.artwork.description}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-4 text-center">
                    <p className="text-xs text-[#f5f0e8]/40 mb-1">成交价</p>
                    <p className="text-xl font-bold text-[#c9a84c] tabular-nums">
                      {round.finalPrice > 0 ? `¥${(round.finalPrice / 10000).toFixed(0)}万` : '—'}
                    </p>
                  </div>
                  <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-4 text-center">
                    <p className="text-xs text-[#f5f0e8]/40 mb-1">买家</p>
                    <p className={`text-lg font-bold ${round.winner === '你' ? 'text-[#2d5a3d]' : round.winner ? 'text-[#8b2252]' : 'text-[#f5f0e8]/30'}`}>
                      {round.winner || '—'}
                    </p>
                  </div>
                  <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-4 text-center">
                    <p className="text-xs text-[#f5f0e8]/40 mb-1">出价轮次</p>
                    <p className="text-xl font-bold text-[#f5f0e8] tabular-nums">{round.bidRecords.length}</p>
                  </div>
                </div>

                {round.bidRecords.length > 0 && (
                  <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-5">
                    <h4 className="text-sm font-bold text-[#c9a84c] mb-3">出价历程</h4>
                    <div className="space-y-1.5">
                      {round.bidRecords.map((bid, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="text-xs text-[#f5f0e8]/30 w-6 text-right">{i + 1}</span>
                          <div className={`w-2 h-2 rounded-full ${bid.bidder === '你' ? 'bg-[#2d5a3d]' : 'bg-[#8b2252]'}`} />
                          <span className={`flex-1 ${bid.bidder === '你' ? 'text-[#2d5a3d]' : 'text-[#8b2252]'}`}>{bid.bidder}</span>
                          <span className="text-[#f5f0e8] tabular-nums">¥{(bid.amount / 10000).toFixed(0)}万</span>
                          {bid.isImpulsive && <Zap className="w-3.5 h-3.5 text-[#c9a84c]" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {round.conflictLogs.length > 0 && (
                  <div className="bg-[#1e1e30] border border-[#c9a84c]/20 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-[#c9a84c]" />
                      <h4 className="text-sm font-bold text-[#c9a84c]">冲突留痕</h4>
                    </div>
                    <div className="space-y-2">
                      {round.conflictLogs.map((c, i) => (
                        <div key={i} className="bg-[#c9a84c]/5 border border-[#c9a84c]/15 rounded-lg p-3">
                          <p className="text-xs text-[#c9a84c] font-medium mb-1">
                            {c.conflictType === 'estimate_vs_description' ? '估价↔描述' : c.conflictType === 'collector_vs_estimate' ? '藏家↔估价' : '藏家↔描述'}
                          </p>
                          <p className="text-[#f5f0e8]/60 text-xs leading-relaxed">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {round.anomalyEvents.length > 0 && (
                  <div className="bg-[#1e1e30] border border-[#8b2252]/20 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-[#8b2252]" />
                      <h4 className="text-sm font-bold text-[#8b2252]">异常事件</h4>
                    </div>
                    <div className="space-y-2">
                      {round.anomalyEvents.map((a, i) => (
                        <div key={i} className="bg-[#8b2252]/5 border border-[#8b2252]/15 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-[#8b2252]">
                              {a.anomalyType === 'impulsive_bid' ? '冲动加价' : a.anomalyType === 'reserve_misjudgment' ? '保留价误判' : '预算透支'}
                            </span>
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, s) => (
                                <div key={s} className={`w-1.5 h-1.5 rounded-full ${s < a.severity ? 'bg-[#8b2252]' : 'bg-[#8b2252]/20'}`} />
                              ))}
                            </div>
                          </div>
                          <p className="text-[#f5f0e8]/60 text-xs leading-relaxed">{a.description}</p>
                          <p className="text-[#f5f0e8]/30 text-xs mt-1">{a.context}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="col-span-4 overflow-y-auto space-y-4 pl-2">
            <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-5">
              <h3 className="text-sm font-bold text-[#c9a84c] mb-4">拍卖总结</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#f5f0e8]/50 text-sm">拍得作品</span>
                  <span className="text-[#f5f0e8] font-bold">{itemsWon} 件</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#f5f0e8]/50 text-sm">总花费</span>
                  <span className="text-[#c9a84c] font-bold tabular-nums">¥{(totalSpent / 10000).toFixed(0)}万</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#f5f0e8]/50 text-sm">剩余预算</span>
                  <span className={`font-bold tabular-nums ${store.remainingBudget < store.totalBudget * 0.3 ? 'text-[#c9a84c]' : 'text-[#2d5a3d]'}`}>
                    ¥{(store.remainingBudget / 10000).toFixed(0)}万
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#1e1e30] border border-[#8b2252]/10 rounded-xl p-5">
              <h3 className="text-sm font-bold text-[#8b2252] mb-4">异常统计</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#c9a84c]" />
                    <span className="text-[#f5f0e8]/50 text-sm">冲动加价</span>
                  </div>
                  <span className="text-[#f5f0e8] font-bold">{allAnomalies.filter(a => a.anomalyType === 'impulsive_bid').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#8b2252]" />
                    <span className="text-[#f5f0e8]/50 text-sm">保留价误判</span>
                  </div>
                  <span className="text-[#f5f0e8] font-bold">{allAnomalies.filter(a => a.anomalyType === 'reserve_misjudgment').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#8b2252]" />
                    <span className="text-[#f5f0e8]/50 text-sm">预算透支</span>
                  </div>
                  <span className="text-[#f5f0e8] font-bold">{allAnomalies.filter(a => a.anomalyType === 'budget_overrun').length}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-5">
              <h3 className="text-sm font-bold text-[#c9a84c] mb-4">冲突统计</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#f5f0e8]/50 text-sm">估价↔描述</span>
                  <span className="text-[#f5f0e8] font-bold">{allConflicts.filter(c => c.conflictType === 'estimate_vs_description').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#f5f0e8]/50 text-sm">藏家↔估价</span>
                  <span className="text-[#f5f0e8] font-bold">{allConflicts.filter(c => c.conflictType === 'collector_vs_estimate').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#f5f0e8]/50 text-sm">藏家↔描述</span>
                  <span className="text-[#f5f0e8] font-bold">{allConflicts.filter(c => c.conflictType === 'collector_vs_description').length}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-5">
              <h3 className="text-sm font-bold text-[#c9a84c] mb-3">各拍品结果</h3>
              <div className="space-y-2">
                {store.rounds.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                      selectedRound === i ? 'bg-[#c9a84c]/10' : 'hover:bg-[#f5f0e8]/5'
                    }`}
                    onClick={() => setSelectedRound(i)}
                  >
                    <span className="text-xs text-[#f5f0e8]/30 w-5">{i + 1}</span>
                    <span className="flex-1 text-sm text-[#f5f0e8]/70 truncate">{r.artwork.name}</span>
                    <ChevronRight className="w-3 h-3 text-[#f5f0e8]/20" />
                    <span className={`text-xs font-medium ${r.winner === '你' ? 'text-[#2d5a3d]' : 'text-[#8b2252]'}`}>
                      {r.winner === '你' ? '成交' : r.winner ? `${r.winner}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
