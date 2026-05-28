import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, SkipForward, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { PolicyPanel } from '@/components/PolicyPanel';
import { LiquidityLedger } from '@/components/LiquidityLedger';
import { RateChart, LiquidityChart } from '@/components/RateChart';
import { EventCardComponent } from '@/components/EventCard';
import { ClassNotes } from '@/components/ClassNotes';
import { DataCard } from '@/components/DataCard';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const game = useGameStore((state) => state.games.find((g) => g.id === gameId));
  const gameState = gameId ? useGameStore((state) => state.gameStates[gameId]) : undefined;
  const submitRound = useGameStore((state) => state.submitRound);
  const restartGame = useGameStore((state) => state.restartGame);
  const clearError = useGameStore((state) => state.clearError);

  useEffect(() => {
    if (!game || !gameState) {
      navigate('/');
    }
  }, [game, gameState, navigate]);

  useEffect(() => {
    if (game?.status === 'finished') {
      navigate(`/result/${gameId}`);
    }
  }, [game, gameId, navigate]);

  useEffect(() => {
    if (gameState?.error) {
      const timer = setTimeout(() => gameId && clearError(gameId), 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.error, gameId, clearError]);

  if (!game || !gameState) return null;

  const currentMarket = gameState.marketHistory[gameState.marketHistory.length - 1];
  const roundActions = gameState.policyActions.filter(
    (a) => a.roundNumber === game.currentRound
  );
  const prevMarket = gameState.marketHistory[gameState.marketHistory.length - 2];

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const result = submitRound(gameId!);

    if (result.success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    }

    setIsSubmitting(false);
  };

  const handleRestart = () => {
    if (confirm('确定要重新开局吗？当前进度将被重置。')) {
      restartGame(gameId!);
    }
  };

  const dr007Change = prevMarket ? currentMarket.dr007 - prevMarket.dr007 : 0;
  const t10yChange = prevMarket ? currentMarket.t10y - prevMarket.t10y : 0;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-navy-700/50 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gold-400">{game.title}</h1>
              <div className="flex items-center gap-3 text-sm text-navy-400">
                <span>回合 {game.currentRound}/{game.maxRounds}</span>
                <div className="w-32 h-2 bg-navy-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(game.currentRound / game.maxRounds) * 100}%` }}
                    className="h-full bg-gold-500"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-navy-700/50 transition-colors text-sm"
            >
              <RotateCcw size={16} />
              重新开局
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {gameState.error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-liquidity-danger/10 border border-liquidity-danger/30 rounded-lg flex items-center gap-3"
            >
              <AlertCircle className="text-liquidity-danger flex-shrink-0" size={20} />
              <span className="text-liquidity-danger">{gameState.error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mb-4 p-4 bg-liquidity-good/10 border border-liquidity-good/30 rounded-lg flex items-center gap-3"
            >
              <CheckCircle className="text-liquidity-good flex-shrink-0" size={20} />
              <span className="text-liquidity-good">回合提交成功！</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <DataCard
            title="银行间流动性"
            value={currentMarket.liquidity.toLocaleString()}
            unit="亿"
            icon={<span>💧</span>}
          />
          <DataCard
            title="DR007 利率"
            value={currentMarket.dr007.toFixed(2)}
            unit="%"
            change={dr007Change * 100}
            icon={<span>📊</span>}
          />
          <DataCard
            title="10年期国债"
            value={currentMarket.t10y.toFixed(2)}
            unit="%"
            change={t10yChange * 100}
            icon={<span>📈</span>}
          />
          <DataCard
            title="风险状态"
            value={currentMarket.liquidityRisk === 'normal' ? '稳健' : currentMarket.liquidityRisk === 'warning' ? '关注' : '警惕'}
            icon={<span>⚠️</span>}
            status={currentMarket.liquidityRisk}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <PolicyPanel
              gameId={gameId!}
              currentRound={game.currentRound}
              disabled={isSubmitting}
            />
            <ClassNotes gameId={gameId!} notes={gameState.classNotes} />
          </div>

          <div className="lg:col-span-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RateChart marketHistory={gameState.marketHistory} />
              <LiquidityChart marketHistory={gameState.marketHistory} />
            </div>

            <LiquidityLedger
              currentMarket={currentMarket}
              logs={gameState.liquidityLogs}
              roundActions={roundActions}
            />

            <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-4">
              <h3 className="text-sm font-semibold text-gold-400 mb-4">回合操作列表</h3>
              {roundActions.length === 0 ? (
                <p className="text-navy-500 text-sm text-center py-4">
                  暂无操作，在左侧面板添加政策工具
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {roundActions.map((action) => (
                    <div
                      key={action.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        action.status === 'confirmed'
                          ? 'border-gold-500/50 bg-gold-500/5'
                          : 'border-navy-600 tentative-bg'
                      )}
                    >
                      <div className={cn(
                        'font-mono text-sm',
                        action.status === 'tentative' && 'tentative-text'
                      )}>
                        <span className="text-gold-400">
                          {action.type === 'reverse_repo' ? '逆回购' : 'MLF'}
                        </span>
                        <span className="mx-2">·</span>
                        <span className={action.direction === 'inject' ? 'text-liquidity-good' : 'text-liquidity-danger'}>
                          {action.direction === 'inject' ? '投放' : '回笼'}
                        </span>
                        <span className="mx-2">·</span>
                        <span>{action.amount.toLocaleString()}亿</span>
                        <span className="mx-2">·</span>
                        <span>{action.term}天</span>
                      </div>
                      <StatusBadge type="action" status={action.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-4"
            >
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all',
                  isSubmitting
                    ? 'bg-navy-700 text-navy-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-navy-900 transform hover:scale-[1.02] shadow-lg shadow-gold-500/25'
                )}
              >
                <SkipForward size={20} />
                {isSubmitting ? '提交中...' : '确认并进入下一回合'}
              </button>
            </motion.div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {gameState.currentEvent ? (
              <EventCardComponent
                gameId={gameId!}
                event={gameState.currentEvent}
                disabled={isSubmitting}
              />
            ) : (
              <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-6 text-center">
                <div className="text-4xl mb-3">🎲</div>
                <h4 className="font-semibold text-navy-300 mb-1">暂无事件</h4>
                <p className="text-sm text-navy-500">
                  下一回合可能触发随机市场事件
                </p>
              </div>
            )}

            <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-4">
              <h3 className="text-sm font-semibold text-gold-400 mb-4">操作提示</h3>
              <div className="space-y-3 text-sm text-navy-400">
                <div className="flex items-start gap-2">
                  <span className="text-gold-400">1.</span>
                  <span>在左侧面板添加逆回购或MLF操作</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gold-400">2.</span>
                  <span>点击 ✓ 确认操作，确认后不可修改</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gold-400">3.</span>
                  <span>处理随机事件（如有）</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gold-400">4.</span>
                  <span>提交回合，观察市场变化</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-navy-600">
                <p className="text-xs text-navy-500">
                  💡 <span className="italic">临时</span> 状态的操作可以修改或删除，
                  <span className="text-gold-400 font-medium">已确认</span> 的操作将被锁定
                </p>
              </div>
            </div>

            <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-4">
              <h3 className="text-sm font-semibold text-gold-400 mb-3">关键指标说明</h3>
              <div className="space-y-2 text-xs text-navy-400">
                <div className="flex justify-between">
                  <span>超额准备金率目标</span>
                  <span className="text-navy-300">1.5% - 2.5%</span>
                </div>
                <div className="flex justify-between">
                  <span>目标期限结构</span>
                  <span className="text-navy-300">14天左右</span>
                </div>
                <div className="flex justify-between">
                  <span>利率传导滞后</span>
                  <span className="text-navy-300">逐步递减</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
