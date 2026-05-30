import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { NeonButton } from '@/components/ui/NeonButton';
import { GlowCard } from '@/components/ui/GlowCard';
import {
  getGameHistory,
  deleteGameData,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
} from '@/utils/gameConfig';
import {
  HomeIcon,
  HistoryIcon,
  BarChartIcon,
  PlayIcon,
  TrashIcon,
  ScoreIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
} from '@/components/circuit/CircuitIcons';
import type { HistoryRecord } from '@/types';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const data = getGameHistory();
    setHistory(data);
  };

  const handleDelete = (gameId: string) => {
    if (deleteConfirm === gameId) {
      deleteGameData(gameId);
      loadHistory();
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(gameId);
      setTimeout(() => {
        setDeleteConfirm(null);
      }, 3000);
    }
  };

  const handleViewReport = (gameId: string) => {
    navigate(`/report/${gameId}`);
  };

  const handlePlayAgain = (difficulty: string) => {
    navigate(`/game/${difficulty}`);
  };

  const getDifficultyColor = (difficulty: string) => {
    return DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS] || '#9CA3AF';
  };

  return (
    <div className="min-h-screen bg-neon-bg p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass-card px-6 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-6 h-6 text-neon-purple" />
              <h1 className="font-display font-bold text-2xl text-neon-purple text-neon-glow-purple">
                历史记录
              </h1>
            </div>
            <span className="px-3 py-1 bg-neon-cyan/20 text-neon-cyan rounded-full text-sm">
              共 {history.length} 条记录
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NeonButton color="purple" variant="outline" onClick={() => navigate('/')}>
              <HomeIcon className="w-4 h-4" />
            </NeonButton>
          </div>
        </motion.div>

        <AnimatePresence>
          {history.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-12 text-center"
            >
              <HistoryIcon className="w-16 h-16 text-neon-silver/30 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-neon-silver mb-2">暂无游戏记录</h2>
              <p className="text-neon-silver/60 mb-6">完成一局游戏后，记录将显示在这里</p>
              <NeonButton color="purple" onClick={() => navigate('/')}>
                开始游戏
              </NeonButton>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {history.map((record, index) => (
                <motion.div
                  key={record.gameId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <GlowCard color="purple" className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div
                            className="w-16 h-16 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${getDifficultyColor(record.difficulty)}20` }}
                          >
                            <span
                              className="font-display font-bold text-2xl"
                              style={{ color: getDifficultyColor(record.difficulty) }}
                            >
                              #{history.length - index}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded text-xs font-bold"
                              style={{
                                backgroundColor: `${getDifficultyColor(record.difficulty)}20`,
                                color: getDifficultyColor(record.difficulty),
                              }}
                            >
                              {DIFFICULTY_LABELS[record.difficulty as keyof typeof DIFFICULTY_LABELS]}
                            </span>
                            <span className="text-neon-silver/60 text-sm">
                              {new Date(record.startTime).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-1 text-sm">
                              <ScoreIcon className="w-4 h-4 text-neon-orange" />
                              <span className="text-neon-orange font-bold">{record.totalScore} 分</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <CheckCircleIcon className="w-4 h-4 text-neon-green" />
                              <span className="text-neon-green">
                                {Math.round(record.accuracy * 100)}% 准确率
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <ClockIcon className="w-4 h-4 text-neon-cyan" />
                              <span className="text-neon-cyan">
                                {Math.round((record.endTime - record.startTime) / 1000)} 秒
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <BarChartIcon className="w-4 h-4 text-neon-purple" />
                              <span className="text-neon-purple">{record.totalOrders} 订单</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <AlertTriangleIcon className="w-4 h-4 text-neon-red" />
                              <span className="text-neon-red">{record.totalIncidents} 事故</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <NeonButton
                          color="cyan"
                          variant="outline"
                          onClick={() => handleViewReport(record.gameId)}
                        >
                          <BarChartIcon className="w-4 h-4 mr-2" />
                          查看报告
                        </NeonButton>
                        <NeonButton
                          color="green"
                          variant="outline"
                          onClick={() => handlePlayAgain(record.difficulty)}
                        >
                          <PlayIcon className="w-4 h-4 mr-2" />
                          再来一局
                        </NeonButton>
                        <NeonButton
                          color={deleteConfirm === record.gameId ? 'red' : 'cyan'}
                          variant="outline"
                          onClick={() => handleDelete(record.gameId)}
                        >
                          <TrashIcon className="w-4 h-4" />
                          {deleteConfirm === record.gameId && (
                            <span className="ml-2 text-xs">再次确认</span>
                          )}
                        </NeonButton>
                      </div>
                    </div>
                  </GlowCard>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
