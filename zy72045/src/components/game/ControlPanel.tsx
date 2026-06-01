import { Play, Pause, RotateCcw, Flag, SkipForward } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useGameLogic } from '../../hooks/useGameLogic';

export function ControlPanel() {
  const { startGame, pauseGame, resumeGame, restartGame, settleGame } = useGameStore();
  const {
    canStart,
    canPause,
    canResume,
    canSettle,
    canRestart,
    status,
    handleNextRound,
    currentRound,
    totalRounds,
  } = useGameLogic();

  const handleStart = () => {
    if (canStart) {
      startGame();
    }
  };

  const handlePause = () => {
    if (canPause) {
      pauseGame();
    }
  };

  const handleResume = () => {
    if (canResume) {
      resumeGame();
    }
  };

  const handleRestart = () => {
    if (canRestart && window.confirm('确定要重新开始吗？当前对局数据将被重置。')) {
      restartGame();
    }
  };

  const handleSettle = () => {
    if (canSettle && window.confirm('确定要结算吗？结算后将生成最终报告。')) {
      settleGame('manual');
    }
  };

  const handleNext = () => {
    if (status === 'playing') {
      handleNextRound();
    }
  };

  return (
    <div className="card">
      <h3 className="font-serif text-lg font-semibold mb-4">控制面板</h3>

      <div className="grid grid-cols-2 gap-3">
        {canStart && (
          <button
            onClick={handleStart}
            className="btn-success col-span-2 flex items-center justify-center gap-2 py-3 text-base"
          >
            <Play size={18} />
            开始对局
          </button>
        )}

        {canPause && (
          <button
            onClick={handlePause}
            className="btn-warning flex items-center justify-center gap-2 py-3"
          >
            <Pause size={18} />
            暂停
          </button>
        )}

        {canResume && (
          <button
            onClick={handleResume}
            className="btn-success flex items-center justify-center gap-2 py-3"
          >
            <Play size={18} />
            继续
          </button>
        )}

        {status === 'playing' && (
          <button
            onClick={handleNext}
            className="btn-primary flex items-center justify-center gap-2 py-3"
            disabled={currentRound >= totalRounds}
          >
            <SkipForward size={18} />
            下一回合
          </button>
        )}

        {canSettle && (
          <button
            onClick={handleSettle}
            className="btn-primary flex items-center justify-center gap-2 py-3"
          >
            <Flag size={18} />
            手动结算
          </button>
        )}

        {canRestart && (
          <button
            onClick={handleRestart}
            className="btn-secondary col-span-2 flex items-center justify-center gap-2 py-3"
          >
            <RotateCcw size={18} />
            重新开始
          </button>
        )}
      </div>

      {status === 'paused' && (
        <div className="mt-4 p-3 bg-warning-50 rounded border border-warning-200">
          <p className="text-sm text-warning-700 text-center">
            ⏸️ 对局已暂停，回合数和持仓已锁定
          </p>
        </div>
      )}

      {status === 'settled' && (
        <div className="mt-4 p-3 bg-primary-50 rounded border border-primary-200">
          <p className="text-sm text-primary-700 text-center">
            ✅ 对局已结算，可在历史记录中查看报告
          </p>
        </div>
      )}
    </div>
  );
}
