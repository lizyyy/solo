import { Play, Pause, RotateCcw, FastForward, Download } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

export default function ControlPanel() {
  const {
    status,
    isPaused,
    gameSpeed,
    pauseGame,
    resumeGame,
    resetGame,
    setGameSpeed,
    exportReport,
  } = useGameStore();

  const handleExport = () => {
    const report = exportReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repair_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      {status === 'playing' || status === 'paused' ? (
        <>
          <button
            onClick={isPaused ? resumeGame : pauseGame}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            title={isPaused ? '继续' : '暂停'}
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>

          <div className="flex items-center gap-1">
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setGameSpeed(speed)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  gameSpeed === speed
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          <button
            onClick={resetGame}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            title="重新开始"
          >
            <RotateCcw size={18} />
          </button>
        </>
      ) : null}

      {status === 'ended' && (
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-medium hover:bg-amber-400 transition-colors"
        >
          <Download size={16} />
          导出报告
        </button>
      )}
    </div>
  );
}
