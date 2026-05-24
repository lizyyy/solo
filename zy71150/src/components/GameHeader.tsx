import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { formatTime } from '../utils/gameUtils';
import { levelConfigs } from '../data/levels';
import { 
  Clock, 
  Trophy, 
  Users, 
  Pause, 
  Play, 
  RotateCcw,
  Home,
  Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const GameHeader: React.FC = () => {
  const navigate = useNavigate();
  const gameState = useGameStore(state => state.gameState);
  const isPaused = useGameStore(state => state.isPaused);
  const pauseGame = useGameStore(state => state.pauseGame);
  const resumeGame = useGameStore(state => state.resumeGame);
  const restartGame = useGameStore(state => state.restartGame);

  if (!gameState) return null;

  const levelConfig = levelConfigs.find(l => l.id === gameState.levelId);

  const handleBack = () => {
    navigate('/');
  };

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white shadow-lg rounded-xl p-4 mb-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="返回主菜单"
          >
            <Home size={20} className="text-gray-600" />
          </button>
          
          <div>
            <h1 className="text-lg font-bold text-gray-800">{levelConfig?.name || '急诊分诊训练'}</h1>
            <p className="text-xs text-gray-500">{levelConfig?.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-blue-500" />
            <span className="font-mono text-lg font-semibold text-gray-700">
              {formatTime(gameState.timeElapsed)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-yellow-500" />
            <span className="font-bold text-lg text-gray-700">{gameState.score}</span>
          </div>

          <div className="flex items-center gap-2">
            <Target size={18} className="text-green-500" />
            <span className="text-sm text-gray-600">
              <span className="font-semibold">{gameState.patientsProcessed}</span>
              <span className="text-gray-400"> / {gameState.targetPatients}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Users size={18} className="text-purple-500" />
            <span className="text-sm text-gray-600">
              等待: {gameState.patients.filter(p => p.status === 'waiting' || p.status === 'reassess').length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isPaused ? resumeGame : pauseGame}
            className={`p-2 rounded-lg transition-colors ${
              isPaused 
                ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
            }`}
            title={isPaused ? '继续' : '暂停'}
          >
            {isPaused ? <Play size={20} /> : <Pause size={20} />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={restartGame}
            className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            title="重新开始"
          >
            <RotateCcw size={20} />
          </motion.button>
        </div>
      </div>

      {isPaused && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-3 bg-yellow-50 rounded-lg text-center"
        >
          <span className="text-yellow-700 font-medium">游戏已暂停</span>
        </motion.div>
      )}
    </motion.div>
  );
};
