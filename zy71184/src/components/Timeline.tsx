import { X, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';

export function Timeline() {
  const { state, history, setReplayTurn, setReplayMode } = useGameStore();

  if (!state.isReplayMode) return null;

  const handleClose = () => {
    setReplayMode(false);
  };

  const handlePrev = () => {
    if (state.replayTurn > 0) {
      setReplayTurn(state.replayTurn - 1);
    }
  };

  const handleNext = () => {
    if (state.replayTurn < state.turn) {
      setReplayTurn(state.replayTurn + 1);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-4xl px-4"
      >
        <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Play size={18} className="text-purple-400" />
              历史回放模式
            </h3>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handlePrev}
              disabled={state.replayTurn <= 0}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={state.turn}
                value={state.replayTurn}
                onChange={(e) => setReplayTurn(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between mt-2">
                {Array.from({ length: Math.min(state.turn + 1, 8) }, (_, i) => {
                  const step = Math.ceil(state.turn / 7);
                  const turn = i * step;
                  return (
                    <span key={i} className="text-xs text-gray-500">
                      {turn}
                    </span>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={state.replayTurn >= state.turn}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-400">
              当前回放: 第 <span className="text-purple-400 font-bold">{state.replayTurn}</span> 回合
            </span>
            <span className="text-gray-500">
              拖动滑块或使用按钮浏览游戏历史
            </span>
          </div>

          {history[state.replayTurn]?.events.length > 0 && (
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <div className="text-gray-400 text-xs mb-2">本回合事件:</div>
              {history[state.replayTurn].events.map((event, idx) => (
                <div key={idx} className="text-sm text-gray-300">
                  • {event}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
