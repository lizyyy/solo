import { Gavel, BookOpen, Zap } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export default function WelcomeScreen() {
  const { startGame } = useGameStore();

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#c9a84c] to-[#a0822a] flex items-center justify-center shadow-[0_0_40px_rgba(201,168,76,0.3)]">
            <Gavel className="w-10 h-10 text-[#1a1a2e]" />
          </div>
          <h1 className="text-3xl font-bold text-[#f5f0e8] font-display leading-tight">
            艺术品拍卖<br />心理战
          </h1>
          <p className="text-[#f5f0e8]/50 text-sm leading-relaxed max-w-sm mx-auto">
            在有限预算内，根据估价信息、藏家画像和竞价节奏做出出价决策。<br />
            当信息冲突时，先留痕再判断。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-4 space-y-2">
            <BookOpen className="w-5 h-5 text-[#c9a84c] mx-auto" />
            <p className="text-[#f5f0e8]/70 text-xs">5件拍品</p>
            <p className="text-[#f5f0e8]/40 text-xs">估价·藏家·描述</p>
          </div>
          <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-4 space-y-2">
            <Zap className="w-5 h-5 text-[#8b2252] mx-auto" />
            <p className="text-[#f5f0e8]/70 text-xs">心理博弈</p>
            <p className="text-[#f5f0e8]/40 text-xs">冲动·误判·透支</p>
          </div>
          <div className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-xl p-4 space-y-2">
            <Gavel className="w-5 h-5 text-[#2d5a3d] mx-auto" />
            <p className="text-[#f5f0e8]/70 text-xs">¥2000万预算</p>
            <p className="text-[#f5f0e8]/40 text-xs">结算·复盘·报告</p>
          </div>
        </div>

        <button
          onClick={startGame}
          className="w-full py-4 bg-gradient-to-r from-[#c9a84c] to-[#d4b65c] text-[#1a1a2e] rounded-xl font-bold text-lg hover:shadow-[0_0_30px_rgba(201,168,76,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          开始拍卖
        </button>

        <div className="text-[#f5f0e8]/30 text-xs space-y-1">
          <p>每个拍品有三类信息：描述、估价、藏家画像</p>
          <p>信息冲突时系统自动留痕，异常行为纳入最终报告</p>
        </div>
      </div>
    </div>
  );
}
