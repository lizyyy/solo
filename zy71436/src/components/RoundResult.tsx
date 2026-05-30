import { useGameStore } from '../store/gameStore';
import { Trophy, ArrowRight, RotateCcw, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RoundResult() {
  const { rounds, currentRoundIndex, nextRound, currentPrice, remainingBudget } = useGameStore();
  const round = rounds[currentRoundIndex];
  const navigate = useNavigate();

  if (!round || round.status !== 'ended') return null;

  const isPlayerWin = round.winner === '你';
  const isLastRound = currentRoundIndex >= rounds.length - 1;

  const handleNext = () => {
    if (isLastRound) {
      nextRound();
      navigate('/review');
    } else {
      nextRound();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1a1a2e]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e1e30] border border-[#c9a84c]/30 rounded-2xl p-8 max-w-md w-full space-y-6 text-center">
        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${isPlayerWin ? 'bg-[#2d5a3d]/20' : 'bg-[#8b2252]/15'}`}>
          <Trophy className={`w-8 h-8 ${isPlayerWin ? 'text-[#2d5a3d]' : 'text-[#8b2252]'}`} />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-[#f5f0e8] font-display">
            {isPlayerWin ? '恭喜成交！' : '未能拍得'}
          </h3>
          <p className="text-[#f5f0e8]/50 text-sm">{round.artwork.name}</p>
        </div>

        <div className="bg-[#12121e] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#f5f0e8]/50 text-sm">成交价</span>
            <span className="text-[#c9a84c] font-bold tabular-nums">¥{(round.finalPrice / 10000).toFixed(0)}万</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#f5f0e8]/50 text-sm">买家</span>
            <span className={`text-sm font-medium ${isPlayerWin ? 'text-[#2d5a3d]' : 'text-[#8b2252]'}`}>{round.winner}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#f5f0e8]/50 text-sm">估价区间</span>
            <span className="text-[#f5f0e8]/70 text-sm tabular-nums">¥{(round.valuation.lowEstimate / 10000).toFixed(0)}-{(round.valuation.highEstimate / 10000).toFixed(0)}万</span>
          </div>
          {round.finalPrice > round.valuation.highEstimate && (
            <div className="pt-2 border-t border-[#8b2252]/20">
              <p className="text-[#8b2252] text-xs">⚠ 成交价超出估价上限</p>
            </div>
          )}
          <div className="pt-2 border-t border-[#f5f0e8]/5">
            <div className="flex items-center justify-between">
              <span className="text-[#f5f0e8]/50 text-sm">剩余预算</span>
              <span className="text-[#f5f0e8] font-bold tabular-nums">¥{(remainingBudget / 10000).toFixed(0)}万</span>
            </div>
          </div>
        </div>

        {(round.conflictLogs.length > 0 || round.anomalyEvents.length > 0) && (
          <div className="flex gap-2 justify-center text-xs">
            {round.conflictLogs.length > 0 && (
              <span className="px-3 py-1 bg-[#c9a84c]/10 text-[#c9a84c] rounded-full border border-[#c9a84c]/20">
                {round.conflictLogs.length}处冲突
              </span>
            )}
            {round.anomalyEvents.length > 0 && (
              <span className="px-3 py-1 bg-[#8b2252]/10 text-[#8b2252] rounded-full border border-[#8b2252]/20">
                {round.anomalyEvents.length}个异常
              </span>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/review')}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#c9a84c]/30 text-[#c9a84c] rounded-lg text-sm font-medium hover:bg-[#c9a84c]/10 transition-all"
          >
            <ClipboardList className="w-4 h-4" />
            查看复盘
          </button>
          <button
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#c9a84c] text-[#1a1a2e] rounded-lg text-sm font-bold hover:bg-[#d4b65c] transition-all hover:shadow-[0_0_20px_rgba(201,168,76,0.3)]"
          >
            {isLastRound ? '查看总结' : '下一件拍品'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
