import { useState, useCallback, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { HandCoins, X, Zap } from 'lucide-react';

export default function BiddingPanel() {
  const { currentPrice, currentBidder, remainingBudget, status, placeBid, passBid, triggerAiBid, rounds, currentRoundIndex } = useGameStore();
  const [bidAmount, setBidAmount] = useState('');
  const [showImpulsiveWarning, setShowImpulsiveWarning] = useState(false);

  const round = rounds[currentRoundIndex];
  const minIncrement = Math.max(currentPrice * 0.05, 50000);
  const suggestedBid = currentPrice + minIncrement;

  useEffect(() => {
    setBidAmount('');
    setShowImpulsiveWarning(false);
  }, [currentRoundIndex]);

  useEffect(() => {
    if (status === 'bidding') {
      setBidAmount('');
    }
  }, [currentPrice, status]);

  useEffect(() => {
    if (status !== 'bidding') return;
    if (currentBidder === '你') {
      const timer = setTimeout(() => {
        triggerAiBid();
      }, 1500 + Math.random() * 1500);
      return () => clearTimeout(timer);
    } else if (currentBidder === null && currentPrice > 0) {
      const timer = setTimeout(() => {
        triggerAiBid();
      }, 1000 + Math.random() * 1000);
      return () => clearTimeout(timer);
    }
  }, [currentBidder, status, currentPrice, triggerAiBid]);

  const handleBid = useCallback(() => {
    const amount = parseInt(bidAmount.replace(/[^0-9]/g, ''));
    if (!amount || amount <= currentPrice) return;

    const increment = amount - currentPrice;
    if (currentPrice > 0 && increment / currentPrice > 0.2) {
      setShowImpulsiveWarning(true);
      return;
    }

    placeBid(amount);
    setBidAmount('');
    setShowImpulsiveWarning(false);
  }, [bidAmount, currentPrice, placeBid]);

  const handleForceBid = useCallback(() => {
    const amount = parseInt(bidAmount.replace(/[^0-9]/g, ''));
    if (!amount || amount <= currentPrice) return;
    placeBid(amount);
    setBidAmount('');
    setShowImpulsiveWarning(false);
  }, [bidAmount, currentPrice, placeBid]);

  const handlePass = useCallback(() => {
    passBid();
  }, [passBid]);

  const setQuickBid = useCallback((multiplier: number) => {
    const amount = Math.ceil((currentPrice + minIncrement * multiplier) / 50000) * 50000;
    setBidAmount(String(amount));
  }, [currentPrice, minIncrement]);

  const isBidding = status === 'bidding';
  const isPlayerTurn = isBidding && (currentBidder !== null ? currentBidder !== '你' : true);

  return (
    <div className="bg-[#1e1e30] border border-[#c9a84c]/20 rounded-xl p-6 space-y-5">
      <div className="text-center space-y-2">
        <p className="text-xs text-[#f5f0e8]/40 uppercase tracking-wider">当前最高价</p>
        <p className="text-4xl font-bold text-[#c9a84c] tabular-nums font-display">
          ¥{currentPrice > 0 ? `${(currentPrice / 10000).toFixed(0)}万` : '—'}
        </p>
        {currentBidder && (
          <p className="text-sm text-[#f5f0e8]/60">
            出价者: <span className={currentBidder === '你' ? 'text-[#2d5a3d] font-bold' : 'text-[#8b2252]'}>{currentBidder}</span>
          </p>
        )}
      </div>

      {isBidding && (
        <>
          <div className="border-t border-[#c9a84c]/10 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={`建议出价 ¥${(suggestedBid / 10000).toFixed(0)}万`}
                className="flex-1 bg-[#12121e] border border-[#c9a84c]/20 rounded-lg px-4 py-3 text-[#f5f0e8] placeholder-[#f5f0e8]/20 focus:outline-none focus:border-[#c9a84c]/60 text-sm tabular-nums"
                disabled={!isPlayerTurn}
              />
              <span className="text-[#f5f0e8]/40 text-sm">万元</span>
            </div>

            <div className="flex gap-2">
              {[1, 1.5, 2].map(m => (
                <button
                  key={m}
                  onClick={() => setQuickBid(m)}
                  className="flex-1 py-2 bg-[#12121e] border border-[#c9a84c]/15 rounded-lg text-xs text-[#c9a84c]/70 hover:border-[#c9a84c]/40 hover:text-[#c9a84c] transition-all tabular-nums"
                  disabled={!isPlayerTurn}
                >
                  +{(m * 5).toFixed(0)}%
                </button>
              ))}
            </div>

            {showImpulsiveWarning && (
              <div className="bg-[#8b2252]/15 border border-[#8b2252]/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-[#8b2252]">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-bold">冲动加价预警</span>
                </div>
                <p className="text-[#f5f0e8]/60 text-xs">你的加价幅度超过20%，属于冲动加价行为。此行为将被记录在案并纳入最终报告。</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleForceBid}
                    className="px-3 py-1.5 bg-[#8b2252] text-[#f5f0e8] rounded text-xs font-medium hover:bg-[#a03068] transition-all"
                  >
                    确认冲动出价
                  </button>
                  <button
                    onClick={() => setShowImpulsiveWarning(false)}
                    className="px-3 py-1.5 border border-[#f5f0e8]/20 text-[#f5f0e8]/60 rounded text-xs hover:bg-[#f5f0e8]/5 transition-all"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleBid}
                disabled={!isPlayerTurn || !bidAmount}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold text-sm hover:bg-[#d4b65c] transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(201,168,76,0.3)]"
              >
                <HandCoins className="w-4 h-4" />
                出价
              </button>
              <button
                onClick={handlePass}
                disabled={!isPlayerTurn}
                className="flex items-center justify-center gap-2 px-5 py-3 border border-[#f5f0e8]/20 text-[#f5f0e8]/60 rounded-lg text-sm hover:bg-[#f5f0e8]/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" />
                过
              </button>
            </div>
          </div>

          {isPlayerTurn && currentBidder !== null && (
            <p className="text-center text-xs text-[#c9a84c]/60 animate-pulse">轮到你出价或选择过</p>
          )}

          {!isPlayerTurn && (
            <p className="text-center text-xs text-[#f5f0e8]/40">AI藏家正在思考...</p>
          )}
        </>
      )}

      {round && status === 'info_review' && (
        <div className="text-center py-4">
          <p className="text-[#f5f0e8]/50 text-sm">仔细审阅拍品信息后，点击"开始竞价"</p>
        </div>
      )}
    </div>
  );
}
