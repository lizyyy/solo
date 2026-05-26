
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, RotateCcw, Home, Clock, Trophy, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useGameTimer } from '@/hooks/useGameTimer';
import { useNavigate } from 'react-router-dom';
import { getCurrentAppointmentSlot } from '@/engine/rules';

export function GameHUD() {
  const navigate = useNavigate();
  const {
    status,
    score,
    correctCount,
    wrongCount,
    levelConfig,
    currentTrashIndex,
    trashQueue,
    pauseGame,
    resumeGame,
    restartGame,
    errors,
  } = useGameStore();
  const { formattedTime, timeRemaining } = useGameTimer();

  const gameState = useGameStore();
  const appointmentStatus = levelConfig
    ? getCurrentAppointmentSlot(gameState, levelConfig)
    : { available: true };

  const isPaused = status === 'paused';
  const progress = trashQueue.length > 0 ? (currentTrashIndex / trashQueue.length) * 100 : 0;
  const isLowTime = timeRemaining <= 10;

  return (
    <>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left Side - Level Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
            >
              <Home size={20} className="text-gray-700" />
            </button>
            <div className="bg-white/90 backdrop-blur rounded-xl px-4 py-2 shadow-lg">
              <div className="text-sm text-gray-500">关卡</div>
              <div className="font-bold text-gray-800">{levelConfig?.name || '-'}</div>
            </div>
          </div>

          {/* Center - Timer */}
          <motion.div
            animate={isLowTime ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: isLowTime ? Infinity : 0, duration: 0.5 }}
            className={`bg-white/90 backdrop-blur rounded-xl px-6 py-3 shadow-lg ${
              isLowTime ? 'bg-red-100/90' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock size={20} className={isLowTime ? 'text-red-500' : 'text-gray-600'} />
              <span className={`font-mono text-2xl font-bold ${
                isLowTime ? 'text-red-500' : 'text-gray-800'
              }`}>
                {formattedTime}
              </span>
            </div>
          </motion.div>

          {/* Right Side - Score & Controls */}
          <div className="flex items-center gap-4">
            <div className="bg-white/90 backdrop-blur rounded-xl px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <Trophy size={20} className="text-yellow-500" />
                <span className="font-bold text-2xl text-gray-800">{score}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={isPaused ? resumeGame : pauseGame}
                className="w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
              >
                {isPaused ? (
                  <Play size={20} className="text-green-600" />
                ) : (
                  <Pause size={20} className="text-gray-700" />
                )}
              </button>
              <button
                onClick={restartGame}
                className="w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-colors"
              >
                <RotateCcw size={20} className="text-gray-700" />
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="max-w-6xl mx-auto mt-4">
          <div className="bg-white/50 backdrop-blur rounded-full h-3 overflow-hidden shadow-inner">
            <motion.div
              className="h-full bg-gradient-to-r from-green-400 to-green-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-white/80">
            <span>进度: {currentTrashIndex}/{trashQueue.length}</span>
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <CheckCircle size={14} className="text-green-400" />
                {correctCount}
              </span>
              <span className="flex items-center gap-1">
                <X size={14} className="text-red-400" />
                {wrongCount}/{levelConfig?.maxWrongCount || 5}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Appointment Status */}
      {levelConfig?.hasAppointmentMechanic && (
        <div className="absolute top-32 left-4 z-50">
          <motion.div
            animate={appointmentStatus.available ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: appointmentStatus.available ? Infinity : 0, duration: 2 }}
            className={`rounded-xl px-4 py-3 shadow-lg ${
              appointmentStatus.available
                ? 'bg-green-500/90 text-white'
                : 'bg-gray-500/90 text-white'
            }`}
          >
            <div className="text-sm font-medium">
              {appointmentStatus.available ? '✅ 预约时段开放中' : '⏳ 预约时段关闭'}
            </div>
            {!appointmentStatus.available && appointmentStatus.nextSlotTime !== undefined && (
              <div className="text-xs opacity-80">
                下一时段: {appointmentStatus.nextSlotTime}秒后
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Pause Overlay */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white rounded-2xl p-8 shadow-2xl text-center"
            >
              <h2 className="text-3xl font-bold text-gray-800 mb-6">游戏暂停</h2>
              <div className="flex gap-4">
                <button
                  onClick={resumeGame}
                  className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors shadow-lg"
                >
                  继续游戏
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-8 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors shadow-lg"
                >
                  返回主菜单
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-red-500 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3">
              <AlertCircle size={24} />
              <div>
                <div className="font-bold">{errors[errors.length - 1]?.wrongAction}</div>
                <div className="text-sm opacity-90">{errors[errors.length - 1]?.explanation}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default GameHUD;
