import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, FileText, FileSpreadsheet, FileJson, BookOpen, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useGameStore } from '@/store/gameStore';
import { RatingBadge } from '@/components/ui/RatingBadge';
import { ANOMALY_TYPES, RATING_LEVELS } from '@/data/constants';
import { GameEngine } from '@/engine/gameEngine';
import { exportToPDF, exportToExcel, exportToJSON, exportAuditLog } from '@/utils/export';
import { formatCurrency, formatPercent, formatNumber, formatDateTime } from '@/utils/format';
import type { Game, Anomaly, GameReport } from '@/types';

const ReportPage: React.FC = () => {
  const { gameId = '' } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { getSavedGame } = useGameStore();
  const reportRef = useRef<HTMLDivElement>(null);

  const [game, setGame] = useState<Game | null>(null);
  const [report, setReport] = useState<GameReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const savedGame = getSavedGame(gameId);
    if (savedGame) {
      setGame(savedGame);
      setReport(GameEngine.generateReport(savedGame));
    }
  }, [gameId, getSavedGame]);

  if (!game) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">未找到游戏记录</div>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const totalRounds = game.rounds.length;
  const correctRounds = game.rounds.filter(r => r.roundScore > 0).length;
  const accuracyRate = totalRounds > 0 ? (correctRounds / totalRounds * 100) : 0;
  const navChange = game.currentNav - game.initialNav;
  const navChangePercent = ((game.currentNav - game.initialNav) / game.initialNav * 100);

  const allAnomalies: Anomaly[] = game.rounds.flatMap(r => r.anomalies || []);
  const anomalyByType = allAnomalies.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const navHistory = [
    { round: '初始', nav: game.initialNav },
    ...game.rounds.map((r, i) => ({
      round: `第${i + 1}回合`,
      nav: r.navAfter || game.initialNav,
    })),
  ];

  const scoreByRound = game.rounds.map((r, i) => ({
    round: `第${i + 1}回合`,
    score: r.roundScore,
    cumulative: game.rounds.slice(0, i + 1).reduce((sum, r) => sum + r.roundScore, 0),
  }));

  const grade = game.totalScore >= 80 ? 'A' : game.totalScore >= 60 ? 'B' : game.totalScore >= 40 ? 'C' : 'D';
  const gradeColors: Record<string, string> = {
    A: 'text-emerald-400',
    B: 'text-blue-400',
    C: 'text-amber-400',
    D: 'text-red-400',
  };

  const handleExportPDF = async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      await exportToPDF(report, 'report-content');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (!report) return;
    setIsExporting(true);
    try {
      exportToExcel(report);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = () => {
    if (!report) return;
    setIsExporting(true);
    try {
      exportToJSON(report);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAudit = () => {
    if (!report) return;
    setIsExporting(true);
    try {
      exportAuditLog(report);
    } finally {
      setIsExporting(false);
    }
  };

  const exportButtons = [
    { label: 'PDF报告', icon: FileText, onClick: handleExportPDF, color: 'bg-red-600 hover:bg-red-700' },
    { label: 'Excel表格', icon: FileSpreadsheet, onClick: handleExportExcel, color: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: 'JSON数据', icon: FileJson, onClick: handleExportJSON, color: 'bg-blue-600 hover:bg-blue-700' },
    { label: '审计日志', icon: BookOpen, onClick: handleExportAudit, color: 'bg-purple-600 hover:bg-purple-700' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">复盘报告</h1>
                <div className="text-xs text-gray-400">
                  {formatDateTime(game.createdAt)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {exportButtons.map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.onClick}
                  disabled={isExporting}
                  className={`hidden sm:flex items-center gap-2 px-4 py-2 ${btn.color} rounded-lg text-white text-sm transition-colors disabled:opacity-50`}
                >
                  <btn.icon className="w-4 h-4" />
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 sm:hidden overflow-x-auto pb-2 mt-2">
            {exportButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                disabled={isExporting}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 ${btn.color} rounded-lg text-white text-xs transition-colors disabled:opacity-50`}
              >
                <btn.icon className="w-3 h-3" />
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div ref={reportRef} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-emerald-900/30 via-slate-800/50 to-cyan-900/30 rounded-2xl border border-emerald-500/30 p-8 text-center"
          >
            <div className="text-sm text-emerald-400 mb-2">债券评级急救室 · 完整报告</div>
            <h2 className="text-3xl font-bold text-white mb-4">{game.studentName || '学员'} 的评级表现</h2>
            <div className={`text-7xl font-black ${gradeColors[grade]} mb-2`}>
              {grade}
            </div>
            <div className="text-gray-400">
              {game.mode === 'standard' ? '标准模式' : game.mode === 'tutorial' ? '新手教学' : '新人样例'}
              {' · '}
              {totalRounds} 回合
            </div>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              { label: '总得分', value: `${game.totalScore >= 0 ? '+' : ''}${game.totalScore}`, icon: Award, color: 'text-emerald-400' },
              { label: '最终净值', value: formatCurrency(game.currentNav), subValue: formatPercent(navChangePercent), subColor: navChange >= 0 ? 'text-emerald-400' : 'text-red-400', icon: Award },
              { label: '正确率', value: `${formatNumber(accuracyRate, 1)}%`, icon: CheckCircle2, color: 'text-blue-400' },
              { label: '异常数', value: allAnomalies.length, icon: AlertTriangle, color: allAnomalies.length > 0 ? 'text-amber-400' : 'text-gray-400' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="bg-slate-800/50 rounded-xl border border-slate-700 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{stat.label}</span>
                  <stat.icon className={`w-4 h-4 ${stat.color || 'text-gray-400'}`} />
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                {stat.subValue && (
                  <div className={`text-xs mt-1 ${stat.subColor}`}>{stat.subValue}</div>
                )}
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-800/50 rounded-xl border border-slate-700 p-6"
            >
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                组合净值走势
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={navHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="round" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => (v / 10000).toFixed(0) + '万'} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: number) => [formatCurrency(value), '净值']}
                    />
                    <Line
                      type="monotone"
                      dataKey="nav"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-slate-800/50 rounded-xl border border-slate-700 p-6"
            >
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-400" />
                得分分布
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreByRound}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="round" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="score" name="回合得分" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cumulative" name="累计得分" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {allAnomalies.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-800/50 rounded-xl border border-slate-700 p-6"
            >
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                异常问题统计
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {Object.entries(ANOMALY_TYPES).map(([type, config]) => (
                  <div key={type} className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{config.icon}</span>
                      <span className="text-white font-medium">{config.label}</span>
                    </div>
                    <div className="text-3xl font-bold" style={{ color: config.color }}>
                      {anomalyByType[type] || 0}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">项</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-slate-800/50 rounded-xl border border-slate-700 p-6"
          >
            <h3 className="text-white font-semibold mb-4">回合详情</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-sm text-gray-400 font-medium">回合</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-400 font-medium">新闻</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-400 font-medium">操作债券</th>
                    <th className="text-center py-3 px-4 text-sm text-gray-400 font-medium">原评级</th>
                    <th className="text-center py-3 px-4 text-sm text-gray-400 font-medium">新评级</th>
                    <th className="text-center py-3 px-4 text-sm text-gray-400 font-medium">正确评级</th>
                    <th className="text-center py-3 px-4 text-sm text-gray-400 font-medium">得分</th>
                    <th className="text-center py-3 px-4 text-sm text-gray-400 font-medium">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {game.rounds.map((round, index) => (
                    <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-4 text-sm text-white">第 {index + 1} 回合</td>
                      <td className="py-3 px-4 text-sm text-gray-300 max-w-xs truncate">
                        {round.news?.title || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-300">
                        {round.action?.bondCode || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {round.action?.oldRating ? (
                          <RatingBadge rating={round.action.oldRating} size="sm" />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {round.action?.newRating ? (
                          <RatingBadge rating={round.action.newRating} size="sm" />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {round.correctRating ? (
                          <RatingBadge rating={round.correctRating} size="sm" />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className={`py-3 px-4 text-center font-bold text-sm ${
                        round.roundScore >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {round.roundScore >= 0 ? '+' : ''}{round.roundScore}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {round.roundScore > 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-emerald-900/20 rounded-xl border border-emerald-500/30 p-6"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              综合评估与建议
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-emerald-400 font-medium mb-2">✅ 做得好的地方</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  {correctRounds >= 3 && (
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      整体正确率达到 {formatNumber(accuracyRate, 1)}%，评级判断能力良好
                    </li>
                  )}
                  {game.totalScore >= 50 && (
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      总得分 {game.totalScore} 分，超过及格线
                    </li>
                  )}
                  {navChange >= 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      组合净值实现正增长 {formatPercent(navChangePercent)}
                    </li>
                  )}
                  {allAnomalies.length === 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      全程无异常操作，流程规范
                    </li>
                  )}
                  {correctRounds < 3 && game.totalScore < 50 && (
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      完成了全部 {totalRounds} 回合的练习
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-amber-400 font-medium mb-2">⚠️ 需要改进</h4>
                <ul className="text-gray-300 text-sm space-y-2">
                  {accuracyRate < 60 && (
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      评级正确率偏低，建议加强债券信用分析基础知识
                    </li>
                  )}
                  {allAnomalies.filter(a => a.type === 'DATA_ISSUE').length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      存在 {allAnomalies.filter(a => a.type === 'DATA_ISSUE').length} 项数据问题，注意评级调整的连续性
                    </li>
                  )}
                  {allAnomalies.filter(a => a.type === 'RULE_ISSUE').length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      存在 {allAnomalies.filter(a => a.type === 'RULE_ISSUE').length} 项规则问题，注意新闻与评级方向的一致性
                    </li>
                  )}
                  {allAnomalies.filter(a => a.type === 'MATERIAL_ISSUE').length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      存在 {allAnomalies.filter(a => a.type === 'MATERIAL_ISSUE').length} 项材料问题，记得填写调整理由
                    </li>
                  )}
                  {game.rounds.filter(r => !r.action).length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      有 {game.rounds.filter(r => !r.action).length} 回合超时未操作，需要提升决策速度
                    </li>
                  )}
                  {accuracyRate >= 60 && allAnomalies.length === 0 && navChange >= 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400">•</span>
                      表现优秀！可以尝试挑战更高难度
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-blue-900/20 rounded-xl border border-blue-500/30 p-6"
          >
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
              学习建议
            </h3>
            <div className="text-gray-300 text-sm space-y-3">
              <p>
                <strong>1. 巩固评级体系：</strong>
                熟悉7档评级标准（{RATING_LEVELS.map(r => r.level).join('/')}）及其风险权重含义。
              </p>
              <p>
                <strong>2. 新闻敏感度训练：</strong>
                不同类型的新闻对债券信用风险的影响方向不同，需要快速判断是正面、负面还是中性。
              </p>
              <p>
                <strong>3. 时间管理：</strong>
                在保证准确性的前提下，提高决策速度，避免超时导致的扣分和净值损失。
              </p>
              <p>
                <strong>4. 理由填写：</strong>
                每次评级调整都需要填写充分的理由，这是分析师专业能力的重要体现。
              </p>
              <p>
                <strong>5. 异常规避：</strong>
                注意避免评级倒退、方向矛盾等常见问题，保持评级调整的逻辑一致性。
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-center text-sm text-gray-500 pb-8"
          >
            <p>报告生成时间：{formatDateTime(new Date().toISOString())}</p>
            <p className="mt-1">债券评级急救室 v1.0 · 金融实训平台</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
