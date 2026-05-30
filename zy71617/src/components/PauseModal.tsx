import { motion } from 'framer-motion';
import { Play, RotateCcw, Home } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useNavigate } from 'react-router-dom';

export const PauseModal = () => {
  const { status, resumeGame, restartGame, resetGame } = useGameStore();
  const navigate = useNavigate();

  if (status !== 'paused') return null;

  const handleResume = () => {
    resumeGame();
  };

  const handleRestart = () => {
    restartGame();
  };

  const handleHome = () => {
    resetGame();
    navigate('/');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        className="bg-gray-900 rounded-2xl p-8 border border-gray-700 shadow-2xl max-w-md w-full mx-4"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">游戏暂停</h2>
          <p className="text-gray-400">休息一下，准备好了再继续</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleResume}
            className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6" />
            继续游戏
          </button>

          <button
            onClick={handleRestart}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-3"
          >
            <RotateCcw className="w-6 h-6" />
            重新开始
          </button>

          <button
            onClick={handleHome}
            className="w-full py-4 px-6 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-3"
          >
            <Home className="w-6 h-6" />
            返回主页
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>按 ESC 或空格键继续游戏</p>
        </div>
      </motion.div>
    </div>
  );
};
