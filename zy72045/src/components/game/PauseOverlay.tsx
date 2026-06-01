import { Pause, Play } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useGameLogic } from '../../hooks/useGameLogic';

export function PauseOverlay() {
  const { resumeGame } = useGameStore();
  const { status, currentRound } = useGameLogic();

  if (status !== 'paused') return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        <div className="w-20 h-20 mx-auto mb-6 bg-warning-100 rounded-full flex items-center justify-center">
          <Pause size={40} className="text-warning-600" />
        </div>

        <h2 className="font-serif text-2xl font-bold mb-2">对局已暂停</h2>
        <p className="text-neutral-500 mb-6">
          当前回合：第 {currentRound} 回合
        </p>

        <div className="space-y-3 mb-6 text-sm text-left bg-neutral-50 rounded-lg p-4">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-warning-500 rounded-full"></span>
            回合数已锁定，不会自动推进
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-warning-500 rounded-full"></span>
            持仓和资金状态已保存
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-warning-500 rounded-full"></span>
            无法进行交易操作
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 bg-warning-500 rounded-full"></span>
            点击继续后从当前回合恢复
          </p>
        </div>

        <button
          onClick={resumeGame}
          className="btn-success w-full flex items-center justify-center gap-2 py-4 text-lg"
        >
          <Play size={24} />
          继续对局
        </button>
      </div>
    </div>
  );
}
