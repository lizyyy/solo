import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shelf } from '../components/game/Shelf';
import { ChemicalLibrary } from '../components/game/ChemicalLibrary';
import { Dashboard } from '../components/ui/Dashboard';
import { ScorePanel } from '../components/ui/ScorePanel';
import { ControlPanel } from '../components/ui/ControlPanel';
import { useGameStore } from '../store/useGameStore';
import { useGameLoop } from '../hooks/useGameLoop';
import { getLevelById } from '../data/levels';
import { AlertTriangle, Pause } from 'lucide-react';

export const GamePage: React.FC = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  
  const status = useGameStore(state => state.status);
  const isPaused = useGameStore(state => state.isPaused);
  const failureReason = useGameStore(state => state.failureReason);
  const levelIdFromStore = useGameStore(state => state.levelId);
  const startLevel = useGameStore(state => state.startLevel);
  const resumeGame = useGameStore(state => state.resumeGame);
  const restartLevel = useGameStore(state => state.restartLevel);

  useGameLoop();

  useEffect(() => {
    if (levelId) {
      const id = parseInt(levelId, 10);
      const level = getLevelById(id);
      if (!level) {
        navigate('/');
        return;
      }
      if (levelIdFromStore !== id) {
        startLevel(id);
      }
    }
  }, [levelId, levelIdFromStore, startLevel, navigate]);

  useEffect(() => {
    if (status === 'completed' || status === 'failed') {
      setTimeout(() => {
        navigate(`/result/${levelId}`);
      }, 1500);
    }
  }, [status, levelId, navigate]);

  const currentLevel = levelId ? getLevelById(parseInt(levelId, 10)) : null;

  if (!currentLevel) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                关卡 {currentLevel.id}: {currentLevel.name}
              </h1>
              <p className="text-slate-400 text-sm">{currentLevel.description}</p>
            </div>
          </div>
          <ControlPanel />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <ScorePanel />
            <Dashboard />
          </div>

          <div className="col-span-12 lg:col-span-6">
            <Shelf />
          </div>

          <div className="col-span-12 lg:col-span-3 h-[600px]">
            <ChemicalLibrary />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isPaused && status === 'playing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-2xl border border-slate-600 p-8 text-center"
            >
              <Pause className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-100 mb-2">游戏暂停</h2>
              <p className="text-slate-400 mb-6">点击继续按钮恢复游戏</p>
              <button
                onClick={resumeGame}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
              >
                继续游戏
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === 'failed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-red-900/80 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              className="bg-slate-800 rounded-2xl border-2 border-red-500 p-8 text-center max-w-md"
            >
              <AlertTriangle className="w-20 h-20 text-red-500 mx-auto mb-4 animate-pulse" />
              <h2 className="text-3xl font-bold text-red-400 mb-2">安全事故！</h2>
              <p className="text-slate-300 mb-6">{failureReason}</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={restartLevel}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-colors"
                >
                  重新挑战
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-xl transition-colors"
                >
                  返回主页
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === 'completed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-green-900/60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              className="bg-slate-800 rounded-2xl border-2 border-green-500 p-8 text-center max-w-md"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-green-400 mb-2">任务完成！</h2>
              <p className="text-slate-300 mb-6">正在生成结算报告...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
