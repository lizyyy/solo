import { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, Pause, RotateCcw, Home, Check, 
  AlertTriangle, Info, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameControlsProps {
  status: 'idle' | 'reading' | 'playing' | 'paused' | 'finished';
  isAllChecked: boolean;
  hasAnyIncorrect: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onConfirm: () => void;
  onHome: () => void;
  readingTimeRemaining?: number;
}

export const GameControls = memo(function GameControls({
  status,
  isAllChecked,
  hasAnyIncorrect,
  onStart,
  onPause,
  onResume,
  onRestart,
  onConfirm,
  onHome,
  readingTimeRemaining = 0
}: GameControlsProps) {
  const canConfirm = isAllChecked && !hasAnyIncorrect && status === 'playing';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onHome}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 
                     hover:bg-gray-200 transition-all font-medium"
          >
            <Home size={18} />
            <span>返回菜单</span>
          </button>
          
          <button
            onClick={onRestart}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 text-orange-600 
                     hover:bg-orange-100 transition-all font-medium border border-orange-200"
          >
            <RotateCcw size={18} />
            <span>重新开始</span>
          </button>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-3">
          {status === 'idle' && (
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 
                       text-white font-bold text-lg hover:from-blue-600 hover:to-blue-700 
                       transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Play size={22} />
              <span>开始游戏</span>
            </button>
          )}
          
          {status === 'reading' && (
            <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-blue-50 border-2 border-blue-200">
              <Info size={20} className="text-blue-500 animate-pulse" />
              <span className="font-medium text-blue-700">
                阅读处方中... ({readingTimeRemaining}s)
              </span>
            </div>
          )}
          
          {status === 'playing' && (
            <>
              <button
                onClick={onPause}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 
                         hover:bg-gray-200 transition-all font-medium"
              >
                <Pause size={18} />
                <span>暂停</span>
              </button>
              
              <button
                onClick={onConfirm}
                disabled={!canConfirm}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-lg transition-all shadow-lg',
                  canConfirm
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:shadow-xl transform hover:-translate-y-0.5 cursor-pointer'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                )}
              >
                <Check size={22} />
                <span>确认配药</span>
                <ChevronRight size={18} />
              </button>
            </>
          )}
          
          {status === 'paused' && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-50 border-2 border-yellow-300">
                <AlertTriangle size={18} className="text-yellow-600" />
                <span className="font-medium text-yellow-700">游戏已暂停</span>
              </div>
              <button
                onClick={onResume}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 
                         text-white font-bold text-lg hover:from-green-600 hover:to-green-700 
                         transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <Play size={22} />
                <span>继续游戏</span>
              </button>
            </>
          )}
          
          {status === 'finished' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 border-2 border-green-300">
              <Check size={18} className="text-green-600" />
              <span className="font-medium text-green-700">配药完成</span>
            </div>
          )}
        </div>
      </div>
      
      {status === 'playing' && !isAllChecked && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-gray-100"
        >
          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-xl text-yellow-700 text-sm">
            <AlertTriangle size={16} />
            <span className="font-medium">请完成所有药品的剂量、禁忌、批号三项核对后再确认配药</span>
          </div>
        </motion.div>
      )}
      
      {status === 'playing' && hasAnyIncorrect && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-gray-100"
        >
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm">
            <AlertTriangle size={16} />
            <span className="font-medium">部分药品核对有误，请修正后再确认配药</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
});
