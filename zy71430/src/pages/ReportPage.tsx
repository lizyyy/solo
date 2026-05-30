
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  ArrowLeft,
  Trophy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Download,
  Play,
  Filter
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { generateScoreBreakdown, getScoreRating } from '../logic/scoring';
import { FilterType, OperationRecord } from '../types';

export const ReportPage: React.FC = () => {
  const navigate = useNavigate();
  const state = useGameStore();
  const [filterType, setFilterType] = useState<FilterType>('all');

  const scoreBreakdown = useMemo(() => generateScoreBreakdown(state), [state]);
  const scoreRating = getScoreRating(scoreBreakdown.totalScore);

  const filteredHistory = useMemo(() => {
    if (filterType === 'all') return state.operationHistory;
    return state.operationHistory.filter((record) => record.type === filterType);
  }, [state.operationHistory, filterType]);

  const mineralStats = useMemo(() => {
    const stats: Record<string, { name: string; quantity: number; value: number }> = {};
    state.mineGrid.flat().forEach((cell) => {
      if (cell.status === 'mined' && cell.mineral) {
        const id = cell.mineral.id;
        if (!stats[id]) {
          stats[id] = { name: cell.mineral.nameCn, quantity: 0, value: 0 };
        }
        const multiplier = cell.isCorrect ? 1 : 0.5;
        stats[id].quantity += cell.minedQuantity;
        stats[id].value += cell.minedQuantity * cell.mineral.value * multiplier;
      }
    });
    return Object.values(stats);
  }, [state.mineGrid]);

  const handleExport = () => {
    const exportData = {
      gameVersion: state.gameVersion,
      rulesVersion: state.rulesVersion,
      exportTime: new Date().toISOString(),
      score: scoreBreakdown.totalScore,
      scoreRating: scoreRating.grade,
      scoreBreakdown,
      mineralStats,
      operationHistory: filteredHistory,
      powerHistory: state.powerHistory,
      inventory: state.inventory
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mining-game-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getVerdictText = () => {
    switch (scoreBreakdown.finalVerdict) {
      case 'success':
        return '任务圆满完成！';
      case 'partial':
        return '任务部分完成';
      case 'failed':
        return '任务失败';
    }
  };

  const getVerdictColor = () => {
    switch (scoreBreakdown.finalVerdict) {
      case 'success':
        return 'text-green-400';
      case 'partial':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
    }
  };

  const CHART_COLORS = ['#00d4ff', '#ff6b35', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">结算报告</h1>
                <p className="text-xs text-slate-400">
                  游戏版本: v{state.gameVersion} | 规则版本: v{state.rulesVersion}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="px-4 py-2 rounded-lg bg-slate-700/50 text-slate-300 text-sm flex items-center gap-2 hover:bg-slate-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出数据
              </button>
              <button
                onClick={() => navigate('/replay')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium flex items-center gap-2 hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              >
                <Play className="w-4 h-4" />
                查看回放
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 text-4xl font-bold"
            style={{
              backgroundColor: `${scoreRating.color}20`,
              color: scoreRating.color,
              border: `3px solid ${scoreRating.color}`
            }}
          >
            <Trophy className="w-12 h-12" />
          </div>
          <div className="text-5xl font-bold mb-2" style={{ color: scoreRating.color }}>
            {scoreRating.grade}
          </div>
          <div className="text-3xl font-bold text-white mb-2">
            {scoreBreakdown.totalScore} 分
          </div>
          <div className={`text-xl font-semibold ${getVerdictColor()}`}>
            {getVerdictText()}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              分数明细
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-900/30 rounded-lg border border-green-700/50">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-white font-medium">正确开采</div>
                    <div className="text-xs text-slate-400">{scoreBreakdown.correctMining.count} 次</div>
                  </div>
                </div>
                <div className="text-green-400 font-bold text-lg">+{scoreBreakdown.correctMining.score}</div>
              </div>

              {scoreBreakdown.wrongGuess.count > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-900/30 rounded-lg border border-red-700/50">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <div>
                      <div className="text-white font-medium">光谱误判</div>
                      <div className="text-xs text-slate-400">{scoreBreakdown.wrongGuess.count} 次</div>
                    </div>
                  </div>
                  <div className="text-red-400 font-bold text-lg">{scoreBreakdown.wrongGuess.penalty}</div>
                </div>
              )}

              {scoreBreakdown.mixedInventory.count > 0 && (
                <div className="flex items-center justify-between p-3 bg-yellow-900/30 rounded-lg border border-yellow-700/50">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    <div>
                      <div className="text-white font-medium">库存混放</div>
                      <div className="text-xs text-slate-400">{scoreBreakdown.mixedInventory.count} 批</div>
                    </div>
                  </div>
                  <div className="text-yellow-400 font-bold text-lg">{scoreBreakdown.mixedInventory.penalty}</div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-cyan-900/30 rounded-lg border border-cyan-700/50">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-white font-medium">剩余电量奖励</div>
                    <div className="text-xs text-slate-400">{scoreBreakdown.powerEfficiency.remainingPower} 单位</div>
                  </div>
                </div>
                <div className="text-cyan-400 font-bold text-lg">+{scoreBreakdown.powerEfficiency.bonus}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">结果分析</h3>

            <div className="space-y-3">
              {scoreBreakdown.reasons.map((reason, index) => (
                <div key={index} className="flex items-start gap-2 text-slate-300 text-sm">
                  <span className="text-cyan-400">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>

            {scoreBreakdown.wrongGuess.details.length > 0 && (
              <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-2">误判详情：</div>
                <div className="space-y-1">
                  {scoreBreakdown.wrongGuess.details.map((detail, index) => (
                    <div key={index} className="text-xs text-slate-300">
                      位置 {detail.cell}: 猜的是「{detail.guessed}」，实际是「{detail.actual}」
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">矿石产量统计</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mineralStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="quantity" name="产量" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">电量消耗趋势</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={state.powerHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} label={{ value: '时间 (秒)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px' }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="power" name="电量" stroke="#ff6b35" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {mineralStats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-8"
          >
            <h3 className="text-lg font-semibold text-white mb-4">矿石价值分布</h3>
            <div className="flex items-center justify-center">
              <div className="h-64 w-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mineralStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {mineralStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">操作记录</h3>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-300"
              >
                <option value="all">全部</option>
                <option value="scan">扫描</option>
                <option value="guess">识别</option>
                <option value="mine">开采</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">时间</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">类型</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">位置</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">设备</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">电量消耗</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">结果</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record: OperationRecord, index: number) => (
                  <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-3 text-slate-300 font-mono text-xs">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        record.type === 'scan' ? 'bg-cyan-900/50 text-cyan-400' :
                        record.type === 'guess' ? 'bg-purple-900/50 text-purple-400' :
                        'bg-amber-900/50 text-amber-400'
                      }`}>
                        {record.type === 'scan' ? '扫描' : record.type === 'guess' ? '识别' : '开采'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 font-mono">
                      ({record.cellPosition.x + 1}, {record.cellPosition.y + 1})
                    </td>
                    <td className="py-2 px-3 text-slate-300">{record.equipment}</td>
                    <td className="py-2 px-3 text-amber-400 font-mono">-{record.powerCost}</td>
                    <td className="py-2 px-3 text-slate-300 text-xs">
                      {record.type === 'guess' && (
                        <span className={record.result.isCorrect ? 'text-green-400' : 'text-red-400'}>
                          {record.result.isCorrect ? '✓ 正确' : '✗ 错误'}
                        </span>
                      )}
                      {record.type === 'mine' && (
                        <span className="text-cyan-400">
                          +{record.result.quantity} 单位, +{record.result.scoreChange}分
                        </span>
                      )}
                      {record.type === 'scan' && (
                        <span className="text-slate-400">已扫描</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
