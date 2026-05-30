import type { BidRecord } from '../types';
import { User, Bot } from 'lucide-react';

interface Props {
  bids: BidRecord[];
}

export default function BidHistory({ bids }: Props) {
  if (bids.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[#f5f0e8]/30 text-sm">暂无出价记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {bids.map((bid, i) => {
        const isPlayer = bid.bidder === '你';
        return (
          <div
            key={i}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
              isPlayer ? 'bg-[#2d5a3d]/15 border border-[#2d5a3d]/20' : 'bg-[#8b2252]/10 border border-[#8b2252]/15'
            }`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isPlayer ? 'bg-[#2d5a3d]/30' : 'bg-[#8b2252]/20'}`}>
              {isPlayer ? <User className="w-3.5 h-3.5 text-[#2d5a3d]" /> : <Bot className="w-3.5 h-3.5 text-[#8b2252]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`font-medium ${isPlayer ? 'text-[#2d5a3d]' : 'text-[#8b2252]'}`}>{bid.bidder}</span>
                <span className="text-[#f5f0e8] font-bold tabular-nums">¥{(bid.amount / 10000).toFixed(0)}万</span>
              </div>
              {bid.isImpulsive && (
                <span className="text-[#c9a84c] text-xs">⚡ 冲动加价</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
