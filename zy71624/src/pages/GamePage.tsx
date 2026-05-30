import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { GameHeader } from '@/components/game/GameHeader';
import { CircuitCanvas } from '@/components/circuit/CircuitCanvas';
import { ComponentPanel } from '@/components/circuit/ComponentPanel';
import { BarStatus } from '@/components/game/BarStatus';
import { OrderQueue } from '@/components/game/OrderQueue';
import { IncidentFeedback } from '@/components/game/IncidentFeedback';
import { NeonButton } from '@/components/ui/NeonButton';
import { PlayIcon, RotateCcwIcon } from '@/components/circuit/CircuitIcons';

export default function GamePage() {
  const navigate = useNavigate();
  const { difficulty } = useParams<{ difficulty: string }>();
  const { initGame, status, resetGame } = useGameStore();

  useEffect(() => {
    const diff = (difficulty as 'easy' | 'medium' | 'hard') || 'medium';
    initGame(diff);
  }, [difficulty, initGame]);

  const handleNavigateHome = () => {
    navigate('/');
  };

  const handleNavigateReport = () => {
    navigate('/report');
  };

  const handleReplay = () => {
    navigate('/replay');
  };

  const handleReset = () => {
    resetGame();
  };

  return (
    <div className="min-h-screen bg-neon-bg p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        <GameHeader
          onNavigateHome={handleNavigateHome}
          onNavigateReport={handleNavigateReport}
        />

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-2 space-y-4">
            <ComponentPanel />
          </div>

          <div className="col-span-7">
            <CircuitCanvas />
          </div>

          <div className="col-span-3 space-y-4">
            <BarStatus />
            <OrderQueue />
            <IncidentFeedback />
          </div>
        </div>

        <AnimatePresence>
          {status === 'finished' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="glass-card p-8 max-w-lg w-full mx-4 text-center"
              >
                <h2 className="font-display font-bold text-3xl text-neon-purple text-neon-glow-purple mb-4">
                  🎉 游戏结束！
                </h2>
                <p className="text-neon-silver mb-6">
                  恭喜完成本局游戏，现在可以查看详细报告或回放精彩瞬间。
                </p>
                <div className="flex gap-4 justify-center">
                  <NeonButton color="purple" onClick={handleNavigateReport}>
                    查看报告
                  </NeonButton>
                  <NeonButton color="cyan" onClick={handleReplay}>
                    <PlayIcon className="w-4 h-4 mr-2" />
                    事故回放
                  </NeonButton>
                  <NeonButton color="green" onClick={handleReset}>
                    <RotateCcwIcon className="w-4 h-4 mr-2" />
                    再来一局
                  </NeonButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 pointer-events-none"
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="glass-card p-6 max-w-md text-center pointer-events-auto"
              >
                <h3 className="font-display font-bold text-xl text-neon-cyan mb-3">
                  欢迎来到电路酒吧！
                </h3>
                <p className="text-neon-silver text-sm mb-4">
                  使用左侧元件面板拖拽元件到画布，点击元件节点进行连线。
                  <br />
                  为每个吧台提供正确的电压，完成顾客订单赚取积分！
                </p>
                <div className="text-xs text-neon-silver/60 mb-4">
                  <p>💡 串联分压，并联分流</p>
                  <p>⚠️ 短路会扣大量分数</p>
                  <p>⏱️ 订单超时会被退回</p>
                </div>
                <p className="text-neon-green text-sm">
                  点击上方「开始游戏」按钮开始！
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
