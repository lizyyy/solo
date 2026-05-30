import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { NeonButton } from '@/components/ui/NeonButton';
import { GlowCard } from '@/components/ui/GlowCard';
import { ZapIcon, FlameIcon, ClockIcon, HistoryIcon, BarChartIcon, CircuitBoardIcon } from '@/components/circuit/CircuitIcons';
import { getGameHistory } from '@/utils/gameConfig';
import { useState, useEffect } from 'react';
import type { HistoryRecord } from '@/types';

export default function Home() {
  const navigate = useNavigate();
  const [recentGames, setRecentGames] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    const history = getGameHistory();
    setRecentGames(history.slice(0, 3));
  }, []);

  const handleStartGame = (difficulty: 'easy' | 'medium' | 'hard') => {
    navigate(`/game/${difficulty}`);
  };

  const handleViewHistory = () => {
    navigate('/history');
  };

  const difficultyOptions = [
    {
      level: 'easy' as const,
      title: '新手调酒师',
      description: '90秒游戏时间，充足的元件和简单的订单',
      color: 'green' as const,
      icon: ZapIcon,
      features: ['90秒游戏时间', '5个电源', '低难度订单'],
    },
    {
      level: 'medium' as const,
      title: '熟练电工',
      description: '120秒游戏时间，适量的元件和中等难度订单',
      color: 'cyan' as const,
      icon: CircuitBoardIcon,
      features: ['120秒游戏时间', '3个电源', '中等难度订单'],
    },
    {
      level: 'hard' as const,
      title: '电路大师',
      description: '90秒游戏时间，有限的元件和高难度订单',
      color: 'red' as const,
      icon: FlameIcon,
      features: ['90秒游戏时间', '2个电源', '高难度订单'],
    },
  ];

  return (
    <div className="min-h-screen bg-neon-bg flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-neon-orange/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-5xl w-full">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <ZapIcon className="w-12 h-12 text-neon-cyan animate-pulse" />
            <h1 className="font-display font-bold text-5xl text-neon-purple text-neon-glow-purple">
              电路酒吧点单夜
            </h1>
            <ZapIcon className="w-12 h-12 text-neon-cyan animate-pulse" />
          </div>
          <p className="text-neon-silver text-lg max-w-2xl mx-auto">
            电子社迎新教学游戏 · 通过串并联电路为不同吧台供电
            <br />
            体验电压控制的艺术，在限时内完成顾客订单
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          {difficultyOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <motion.div
                key={option.level}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlowCard color={option.color} className="p-6 h-full">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-3 rounded-lg bg-neon-${option.color}/20`}>
                        <Icon className={`w-8 h-8 text-neon-${option.color}`} />
                      </div>
                      <div>
                        <h3 className={`font-display font-bold text-xl text-neon-${option.color}`}>
                          {option.title}
                        </h3>
                        <p className="text-neon-silver/70 text-sm">{option.description}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-6 flex-1">
                      {option.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-neon-silver">
                          <div className={`w-1.5 h-1.5 rounded-full bg-neon-${option.color}`} />
                          {feature}
                        </div>
                      ))}
                    </div>
                    <NeonButton
                      color={option.color}
                      className="w-full"
                      onClick={() => handleStartGame(option.level)}
                    >
                      开始挑战
                    </NeonButton>
                  </div>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-6 mb-8"
        >
          <GlowCard color="purple" className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <HistoryIcon className="w-6 h-6 text-neon-purple" />
              <h3 className="font-display font-bold text-lg text-neon-purple">
                最近游戏记录
              </h3>
            </div>
            {recentGames.length > 0 ? (
              <div className="space-y-3">
                {recentGames.map((game) => (
                  <div
                    key={game.gameId}
                    className="flex items-center justify-between p-3 rounded-lg bg-neon-bgSecondary/50 hover:bg-neon-bgSecondary transition-colors cursor-pointer"
                    onClick={() => navigate(`/report/${game.gameId}`)}
                  >
                    <div>
                      <div className="text-sm text-neon-silver">
                        {new Date(game.startTime).toLocaleString('zh-CN')}
                      </div>
                      <div className="text-xs text-neon-silver/60">
                        {game.totalOrders} 订单 · {game.totalIncidents} 事故
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-neon-orange">
                        {game.totalScore} 分
                      </div>
                      <div className="text-xs text-neon-silver/60">
                        {Math.round(game.accuracy * 100)}% 准确率
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-neon-silver/50 py-4">
                暂无游戏记录
              </div>
            )}
            <NeonButton
              color="purple"
              variant="outline"
              className="w-full mt-4"
              onClick={handleViewHistory}
            >
              查看全部历史
            </NeonButton>
          </GlowCard>

          <GlowCard color="cyan" className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChartIcon className="w-6 h-6 text-neon-cyan" />
              <h3 className="font-display font-bold text-lg text-neon-cyan">
                游戏说明
              </h3>
            </div>
            <div className="space-y-3 text-sm text-neon-silver">
              <div className="flex items-start gap-2">
                <ClockIcon className="w-4 h-4 text-neon-cyan mt-0.5 flex-shrink-0" />
                <span>游戏限时1-2分钟，每次操作都有即时后果</span>
              </div>
              <div className="flex items-start gap-2">
                <CircuitBoardIcon className="w-4 h-4 text-neon-cyan mt-0.5 flex-shrink-0" />
                <span>拖拽元件到画布，点击节点连线，构建串并联电路</span>
              </div>
              <div className="flex items-start gap-2">
                <ZapIcon className="w-4 h-4 text-neon-cyan mt-0.5 flex-shrink-0" />
                <span>电压误差±20%内为正常，过压欠压都会扣分</span>
              </div>
              <div className="flex items-start gap-2">
                <FlameIcon className="w-4 h-4 text-neon-cyan mt-0.5 flex-shrink-0" />
                <span>短路会触发紧急停摆，扣除大量分数</span>
              </div>
            </div>
          </GlowCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-neon-silver/50 text-sm"
        >
          <p>💡 提示：串联分压，并联分流。合理规划电路布局是成功的关键！</p>
        </motion.div>
      </div>
    </div>
  );
}
