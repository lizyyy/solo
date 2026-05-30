import { Gavel, Play, Pause, RotateCcw } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export default function GameControls() {
  const { status, startGame, pauseGame, resumeGame, restartGame, currentRoundIndex, rounds } = useGameStore();

  return (
    <div className="flex items-center justify-between w-full px-6 py-4 bg-[#12121e] border-t border-[#c9a84c]/20">
      <div className="flex items-center gap-3">
        <Gavel className="w-5 h-5 text-[#c9a84c]" />
        <span className="text-[#f5f0e8]/70 text-sm font-medium">
          {status === 'idle' && '等待开始'}
          {status === 'info_review' && `拍品 ${currentRoundIndex + 1}/${rounds.length} · 信息审阅`}
          {status === 'bidding' && `拍品 ${currentRoundIndex + 1}/${rounds.length} · 竞价中`}
          {status === 'paused' && `拍品 ${currentRoundIndex + 1}/${rounds.length} · 已暂停`}
          {status === 'round_end' && `拍品 ${currentRoundIndex + 1}/${rounds.length} · 回合结束`}
          {status === 'settled' && '拍卖结束'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {status === 'idle' && (
          <button
            onClick={startGame}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold text-sm hover:bg-[#d4b65c] transition-all hover:shadow-[0_0_20px_rgba(201,168,76,0.4)]"
          >
            <Play className="w-4 h-4" />
            开始拍卖
          </button>
        )}

        {status === 'bidding' && (
          <button
            onClick={pauseGame}
            className="flex items-center gap-2 px-4 py-2 border border-[#c9a84c]/40 text-[#c9a84c] rounded-lg font-medium text-sm hover:bg-[#c9a84c]/10 transition-all"
          >
            <Pause className="w-4 h-4" />
            暂停
          </button>
        )}

        {status === 'paused' && (
          <button
            onClick={resumeGame}
            className="flex items-center gap-2 px-4 py-2 bg-[#2d5a3d] text-[#f5f0e8] rounded-lg font-medium text-sm hover:bg-[#3a7a50] transition-all"
          >
            <Play className="w-4 h-4" />
            继续
          </button>
        )}

        {(status === 'bidding' || status === 'paused' || status === 'info_review' || status === 'round_end') && (
          <button
            onClick={restartGame}
            className="flex items-center gap-2 px-4 py-2 border border-[#8b2252]/40 text-[#8b2252] rounded-lg font-medium text-sm hover:bg-[#8b2252]/10 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            重开
          </button>
        )}
      </div>
    </div>
  );
}
