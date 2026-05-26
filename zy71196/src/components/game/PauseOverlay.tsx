interface PauseOverlayProps {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function PauseOverlay({ onResume, onRestart, onExit }: PauseOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full mx-4">
        <h2 className="text-3xl font-bold text-white text-center mb-8">
          游戏暂停
        </h2>

        <div className="space-y-4">
          <button
            onClick={onResume}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-lg"
          >
            继续游戏
          </button>

          <button
            onClick={onRestart}
            className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            重新开始
          </button>

          <button
            onClick={onExit}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
          >
            退出到主菜单
          </button>
        </div>

        <p className="text-slate-400 text-center mt-6 text-sm">
          按 ESC 键继续游戏
        </p>
      </div>
    </div>
  );
}
