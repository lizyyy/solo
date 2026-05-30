import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Home, SkipForward } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useNavigate } from 'react-router-dom';

export const ControlPanel = () => {
  const { status, pauseGame, resumeGame, restartGame, resetGame } = useGameStore();
  const navigate = useNavigate();

  const handlePauseResume = () => {
    if (status === 'playing') {
      pauseGame();
    } else if (status === 'paused') {
      resumeGame();
    }
  };

  const handleRestart = () => {
    restartGame();
  };

  const handleHome = () => {
    resetGame();
    navigate('/');
  };

  const handleEnd = () => {
    useGameStore.getState().endGame();
    navigate('/report');
  };

  return (
    <motion.div
      className="flex items-center justify-center gap-4 p-4 bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        onClick={handleHome}
        className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-all"
        title="返回主页"
      >
        <Home className="w-5 h-5" />
      </button>

      <button
        onClick={handlePauseResume}
        disabled={status !== 'playing' && status !== 'paused'}
        className={`p-4 rounded-lg transition-all font-semibold
          ${status === 'playing' 
            ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-900' 
            : status === 'paused'
              ? 'bg-green-500 hover:bg-green-400 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
        title={status === 'playing' ? '暂停' : '继续'}
      >
        {status === 'playing' ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6" />
        )}
      </button>

      <button
        onClick={handleRestart}
        disabled={status === 'idle'}
        className="p-4 rounded-lg bg-blue-500 hover:bg-blue-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="重新开始"
      >
        <RotateCcw className="w-6 h-6" />
      </button>

      <button
        onClick={handleEnd}
        disabled={status !== 'playing' && status !== 'paused'}
        className="p-3 rounded-lg bg-purple-500 hover:bg-purple-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="结束并查看报告"
      >
        <SkipForward className="w-5 h-5" />
      </button>
    </motion.div>
  );
};
