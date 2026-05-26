import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/useGameStore';

interface PauseMenuProps {
  onClose: () => void;
}

export function PauseMenu({ onClose }: PauseMenuProps) {
  const navigate = useNavigate();
  const { resumeGame, restartGame } = useGameStore();

  const handleResume = () => {
    resumeGame();
    onClose();
  };

  const handleRestart = () => {
    restartGame();
    onClose();
  };

  const handleQuit = () => {
    navigate('/');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-3xl font-bold text-white text-center mb-8">
          ⏸️ 游戏暂停
        </h2>

        <div className="space-y-4">
          <button
            onClick={handleResume}
            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl text-lg font-semibold transition-all transform hover:scale-105"
          >
            ▶️ 继续游戏
          </button>

          <button
            onClick={handleRestart}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-lg font-semibold transition-all transform hover:scale-105"
          >
            🔄 重新开始
          </button>

          <button
            onClick={handleQuit}
            className="w-full py-4 bg-slate-600 hover:bg-slate-500 text-white rounded-xl text-lg font-semibold transition-all transform hover:scale-105"
          >
            🏠 返回主菜单
          </button>
        </div>

        <p className="text-slate-400 text-center mt-6 text-sm">
          按 ESC 键继续游戏
        </p>
      </div>
    </div>
  );
}
