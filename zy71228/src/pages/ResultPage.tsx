import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, RotateCcw, Share2, Trophy, TrendingUp, AlertTriangle, Clock, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { RateChart, LiquidityChart } from '@/components/RateChart';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export function ResultPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'timeline' | 'analysis' | 'export'>('timeline');

  const game = useGameStore((state) => state.games.find((g) => g.id === gameId));
  const gameState = gameId ? useGameStore((state) => state.gameStates[gameId]) : undefined;
  const restartGame = useGameStore((state) => state.restartGame);
  const exportGame = useGameStore((state) => state.exportGame);

  if (!game || !gameState) {
    navigate('/');
    return null;
  }

  const marketHistory = gameState.marketHistory;
  const finalMarket = marketHistory[marketHistory.length - 1];
  const initialMarket = marketHistory[0];
  const policyActions = gameState.policyActions;
  const eventCards = gameState.eventCards;
  const classNotes = gameState.classNotes;

  const totalInjected = policyActions
    .filter(a => a.status === 'confirmed' && a.direction === 'inject')
    .reduce((sum, a) => sum + a.amount, 0);
  const totalWithdrawn = policyActions
    .filter(a => a.status === 'confirmed' && a.direction === 'withdraw')
    .reduce((sum, a) => sum + a.amount, 0);

  const liquidityChange = finalMarket.liquidity - initialMarket.liquidity;
  const dr007Change = finalMarket.dr007 - initialMarket.dr007;

  const getScore = () => {
    let score = 100;
    if (finalMarket.excessReserveRatio < 0.015 || finalMarket.excessReserveRatio > 0.025) {
      score -= 20;
    }
    if (finalMarket.liquidityRisk === 'warning') score -= 15;
    if (finalMarket.liquidityRisk === 'danger') score -= 30;
    if (Math.abs(dr007Change) > 0.5) score -= 10;
    return Math.max(0, score);
  };

  const score = getScore();

  const getGrade = (s: number) => {
    if (s >= 90) return { label: 'S', color: 'text-gold-400' };
    if (s >= 80) return { label: 'A', color: 'text-liquidity-good' };
    if (s >= 70) return { label: 'B', color: 'text-blue-400' };
    if (s >= 60) return { label: 'C', color: 'text-yellow-400' };
    return { label: 'D', color: 'text-liquidity-danger' };
  };

  const grade = getGrade(score);

  const handleRestart = () => {
    restartGame(gameId!);
    navigate(`/game/${gameId}`);
  };

  const handleExport = () => {
    const data = exportGame(gameId!);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omcb-result-${gameId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'timeline', label: '决策时间线', icon: Clock },
    { id: 'analysis', label: '数据分析', icon: TrendingUp },
    { id: 'export', label: '导出报告', icon: FileText },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-navy-700/50 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gold-400">{game.title} · 结算复盘</h1>
              <p className="text-navy-400 text-sm">
                {game.difficulty === 'easy' ? '新手模式' : game.difficulty === 'normal' ? '标准模式' : '挑战模式'}
                {' · '}
                {game.maxRounds} 回合
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-navy-700/50 transition-colors"
            >
              <RotateCcw size={18} />
              重新开局
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 transition-colors"
            >
              <Download size={18} />
              导出数据
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-navy-800/80 to-navy-700/50 backdrop-blur-sm rounded-2xl border border-gold-500/30 p-8 mb-8 text-center"
        >
          <Trophy className="mx-auto text-gold-400 mb-4" size={48} />
          <div className={cn('text-6xl font-bold mb-2', grade.color)}>
            {grade.label}
          </div>
          <div className="text-navy-400 mb-2">综合评分: {score}/100</div>
          <div className="flex justify-center gap-8 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-liquidity-good font-mono">
                {finalMarket.liquidity.toLocaleString()}</div>
              <div className="text-sm text-navy-500">最终流动性 (亿)</div>
            </div>
            <div className="text-center">
              <div className={cn('text-2xl font-bold font-mono', liquidityChange >= 0 ? 'text-liquidity-good' : 'text-liquidity-danger')}>
                {liquidityChange >= 0 ? '+' : ''}{liquidityChange.toLocaleString()}
              </div>
              <div className="text-sm text-navy-500">流动性变化 (亿)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gold-400 font-mono">
                {finalMarket.dr007.toFixed(2)}%
              </div>
              <div className="text-sm text-navy-500">最终 DR007</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono">
                {policyActions.filter(a => a.status === 'confirmed').length}
              </div>
              <div className="text-sm text-navy-500">确认操作数</div>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                activeTab === tab.id
                  ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                  : 'text-navy-400 hover:bg-navy-700/30'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'timeline' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-6"
          >
            <h3 className="text-lg font-semibold text-gold-400 mb-6">决策时间线</h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-navy-600" />
              <div className="space-y-6">
                {Array.from({ length: game.maxRounds }).map((_, i) => {
                  const roundNumber = i + 1;
                  const roundActions = policyActions.filter(a => a.roundNumber === roundNumber);
                  const roundEvent = eventCards.find(e => e.roundNumber === roundNumber);
                  const market = marketHistory[i + 1];

                  return (
                    <div key={i} className="relative pl-10">
                      <div className="absolute left-0 w-8 h-8 rounded-full bg-navy-700 border-2 border-gold-500 flex items-center justify-center text-xs font-bold text-gold-400">
                        {roundNumber}
                      </div>
                      <div className="bg-navy-900/50 rounded-lg p-4">
                        {roundActions.length > 0 && (
                          <div className="mb-2">
                            <div className="text-xs text-navy-400 mb-1">政策操作</div>
                            <div className="space-y-1">
                              {roundActions.map(action => (
                                <div
                                  key={action.id} className="flex items-center gap-2 text-sm">
                                  <StatusBadge type="action" status={action.status} />
                                  <span className="font-mono">
                                    <span className="text-gold-400">
                                      {action.type === 'reverse_repo' ? '逆回购' : 'MLF'}
                                    </span>
                                    <span className="mx-1">·</span>
                                    <span className={action.direction === 'inject' ? 'text-liquidity-good' : 'text-liquidity-danger'}>
                                      {action.direction === 'inject' ? '投放' : '回笼'}
                                    </span>
                                    <span className="mx-1">·</span>
                                    {action.amount.toLocaleString()}亿
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {roundEvent && (
                          <div className="mb-2">
                            <div className="text-xs text-navy-400 mb-1">📰 事件: {roundEvent.title}</div>
                            <div className="text-sm text-navy-300">
                              选择: {roundEvent.options.find(o => o.id === roundEvent.selectedOptionId)?.label}
                            </div>
                          </div>
                        )}
                        {market && (
                          <div className="flex gap-4 text-xs text-navy-500 mt-2 pt-2 border-t border-navy-700">
                            <span>流动性: {market.liquidity.toLocaleString()}亿</span>
                            <span>DR007: {market.dr007.toFixed(2)}%</span>
                            <StatusBadge type="risk" status={market.liquidityRisk} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analysis' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RateChart marketHistory={marketHistory} />
              <LiquidityChart marketHistory={marketHistory} />
            </div>

            <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-6">
              <h3 className="text-lg font-semibold text-gold-400 mb-4">关键指标分析</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-navy-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="text-liquidity-good" size={18} />
                    <span className="text-sm text-navy-400">流动性管理</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-liquidity-good">
                    {totalInjected.toLocaleString()}亿</div>
                  <div className="text-xs text-navy-500">累计投放</div>
                  <div className="text-lg font-bold font-mono text-liquidity-danger">
                    {totalWithdrawn.toLocaleString()}亿</div>
                  <div className="text-xs text-navy-500">累计回笼</div>
                </div>

                <div className="bg-navy-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={finalMarket.liquidityRisk === 'normal' ? 'text-liquidity-good' : 'text-yellow-400'} size={18} />
                    <span className="text-sm text-navy-400">风险评估</span>
                  </div>
                  <StatusBadge type="risk" status={finalMarket.liquidityRisk} />
                  <div className="text-xs text-navy-500 mt-2">
                    超额准备金率: {(finalMarket.excessReserveRatio * 100).toFixed(2)}%
                  </div>
                  <div className="text-xs text-navy-500">
                    期限错配: {finalMarket.maturityGap.toFixed(1)}天
                  </div>
                </div>

                <div className="bg-navy-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Share2 className="text-blue-400" size={18} />
                    <span className="text-sm text-navy-400">利率传导</span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-blue-400">
                    {Math.abs(dr007Change * 100).toFixed(1)}bp
                  </div>
                  <div className="text-xs text-navy-500">利率变化幅度</div>
                  <div className="text-xs text-navy-500">
                    传导效率: {((1 - finalMarket.rateLagEffect) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>

            {classNotes.length > 0 ? (
              <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-6">
                <h3 className="text-lg font-semibold text-gold-400 mb-4">课堂笔记</h3>
                <div className="space-y-2">
                  {classNotes.map(note => (
                    <div key={note.id} className="flex items-start gap-3 p-3 bg-navy-900/50 rounded-lg">
                      <StatusBadge type="action" status={note.status} />
                      <span className="text-sm">{note.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        )}

        {activeTab === 'export' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-6"
          >
            <h3 className="text-lg font-semibold text-gold-400 mb-4">导出复盘报告</h3>

            <div className="space-y-4">
              <div className="bg-navy-900/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">报告摘要</h4>
                <div className="text-sm text-navy-400 space-y-1">
                  <p><span className="text-navy-500">对局名称:</span> {game.title}</p>
                  <p><span className="text-navy-500">难度模式:</span> {game.difficulty === 'easy' ? '新手模式' : game.difficulty === 'normal' ? '标准模式' : '挑战模式'}</p>
                  <p><span className="text-navy-500">总回合数:</span> {game.maxRounds}</p>
                  <p><span className="text-navy-500">综合评分:</span> {score}/100 ({grade.label})</p>
                  <p><span className="text-navy-500">完成时间:</span> {new Date(game.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-navy-900/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">关键决策点</h4>
                <ul className="text-sm text-navy-400 space-y-1">
                  <li>• 累计投放流动性: {totalInjected.toLocaleString()} 亿元</li>
                  <li>• 累计回笼流动性: {totalWithdrawn.toLocaleString()} 亿元</li>
                  <li>• 最终流动性水平: {finalMarket.liquidity.toLocaleString()} 亿元</li>
                  <li>• DR007 变化: {dr007Change >= 0 ? '+' : ''}{(dr007Change * 100).toFixed(1)}bp</li>
                  <li>• 风险状态: {finalMarket.liquidityRisk === 'normal' ? '正常' : finalMarket.liquidityRisk === 'warning' ? '警告' : '危险'}
                  </li>
                </ul>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold transition-colors"
                >
                  <Download size={18} />
                  导出 JSON 数据
                </button>
              </div>

              <p className="text-xs text-navy-500 text-center">
                导出的 JSON 文件包含完整的对局数据，可用于后续分析或导入到其他设备
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
