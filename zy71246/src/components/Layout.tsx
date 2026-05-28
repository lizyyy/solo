import React from 'react';
import { motion } from 'framer-motion';
import { Orbit, Radio, Clock } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { formatTime, formatDate } from '../utils/time';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentTime, score, status, speed } = useGameStore();

  return (
    <div className="min-h-screen bg-deep-950 text-white font-sans">
      <header className="bg-deep-900 border-b border-deep-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <Orbit className="w-8 h-8 text-gold-500" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-gold-400 font-mono tracking-wider">
                航天测控窗口赛
              </h1>
              <p className="text-xs text-deep-400 font-mono">
                AEROSPACE TT&C WINDOW CHALLENGE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 bg-deep-800 px-4 py-2 rounded-lg">
              <Clock className="w-4 h-4 text-blue-400" />
              <div>
                <div className="text-xs text-deep-400">任务时间</div>
                <div className="text-sm font-mono text-blue-300">
                  {formatDate(currentTime)} {formatTime(currentTime)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-deep-800 px-4 py-2 rounded-lg">
              <Radio className="w-4 h-4 text-green-400" />
              <div>
                <div className="text-xs text-deep-400">当前分数</div>
                <div className="text-sm font-mono text-green-300">
                  {score.toFixed(0)} / 1000
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-deep-800 px-4 py-2 rounded-lg">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                status === 'running' ? 'bg-green-500' :
                status === 'paused' ? 'bg-yellow-500' :
                status === 'completed' ? 'bg-blue-500' :
                'bg-gray-500'
              }`} />
              <div>
                <div className="text-xs text-deep-400">状态</div>
                <div className="text-sm font-mono">
                  {status === 'idle' && '准备中'}
                  {status === 'running' && `运行中 (${speed}x)`}
                  {status === 'paused' && '已暂停'}
                  {status === 'completed' && '已完成'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4">
        {children}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-deep-900 border-t border-deep-700 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-deep-500 font-mono">
          <span>© 2025 航天测控模拟器 | 深空网络管理系统 v2.4.1</span>
          <span>系统状态: <span className="text-green-400">NOMINAL</span></span>
        </div>
      </footer>
    </div>
  );
};
