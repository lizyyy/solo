import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { 
  Home, RotateCcw, Download, FileText, BarChart3, 
  TrendingUp, AlertTriangle, Clock, Users, Trophy
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { generateTeachingReport, exportToCSV, exportToJSON, downloadFile } from '@/utils/reportGenerator';
import { TeachingReport } from '@/types/game';

const Report = () => {
  const navigate = useNavigate();
  const gameState = useGameStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'rhythm' | 'dispatch' | 'anomalies'>('overview');

  const report = useMemo<TeachingReport | null>(() => {
    if (gameState.status === 'idle') return null;
    return generateTeachingReport(gameState);
  }, [gameState]);

  const handleExportCSV = () => {
    if (!report) return;
    const content = exportToCSV(report);
    downloadFile(content, `节奏地铁调度战报告_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  const handleExportJSON = () => {
    if (!report) return;
    const content = exportToJSON(report);
    downloadFile(content, `节奏地铁调度战报告_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const handleRestart = () => {
    gameState.startGame(gameState.difficulty);
    navigate('/game');
  };

  const handleHome = () => {
    gameState.resetGame();
    navigate('/');
  };

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">暂无游戏数据</p>
          <button
            onClick={handleHome}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg"
          >
            返回主页
          </button>
        </div>
      </div>
    );
  }

  const judgeData = [
    { name: 'Perfect', value: report.rhythmAnalysis.judgeDistribution.perfect, color: '#00D4FF' },
    { name: 'Good', value: report.rhythmAnalysis.judgeDistribution.good, color: '#2ED573' },
    { name: 'Miss', value: report.rhythmAnalysis.judgeDistribution.miss, color: '#FF4757' },
  ];

  const offsetData = [
    { name: '提前', value: report.rhythmAnalysis.offsetDistribution.early, color: '#FFA502' },
    { name: '延迟', value: report.rhythmAnalysis.offsetDistribution.late, color: '#9B59B6' },
  ];

  const platformData = report.congestionAnalysis.platformStats.map(p => ({
    name: p.platformName.split('-')[1] || p.platformName,
    avg: Math.round(p.avgCongestion),
    max: Math.round(p.maxCongestion),
    overflow: p.overflowCount,
  }));

  const anomalyTypeData = [
    { name: '拍点偏移', value: report.anomalyDetails.filter(a => a.type === 'beat_offset').length, color: '#FFA502' },
    { name: '列车追尾', value: report.anomalyDetails.filter(a => a.type === 'train_collision').length, color: '#FF4757' },
    { name: '客流溢出', value: report.anomalyDetails.filter(a => a.type === 'passenger_overflow').length, color: '#9B59B6' },
  ];

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'S': return 'text-yellow-400';
      case 'A': return 'text-cyan-400';
      case 'B': return 'text-green-400';
      case 'C': return 'text-orange-400';
      default: return 'text-red-400';
    }
  };

  const tabs = [
    { id: 'overview', label: '总览', icon: BarChart3 },
    { id: 'rhythm', label: '节奏分析', icon: TrendingUp },
    { id: 'dispatch', label: '调度分析', icon: Clock },
    { id: 'anomalies', label: '异常事件', icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <FileText className="w-8 h-8 text-cyan-400" />
              教学报告
            </h1>
            <p className="text-gray-400">
              {new Date(report.basicInfo.date).toLocaleString('zh-CN')} · 
              难度: {report.basicInfo.difficulty === 'easy' ? '简单' : report.basicInfo.difficulty === 'normal' ? '普通' : '困难'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 JSON
            </button>
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-400 text-sm">最终得分</span>
            </div>
            <p className="text-3xl font-bold text-yellow-400">{report.basicInfo.finalScore.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span className="text-gray-400 text-sm">评级</span>
            </div>
            <p className={`text-3xl font-bold ${getGradeColor(report.basicInfo.grade)}`}>{report.basicInfo.grade}</p>
          </div>
          <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">命中率</span>
            </div>
            <p className="text-3xl font-bold text-green-400">{(report.rhythmAnalysis.hitRate * 100).toFixed(1)}%</p>
          </div>
          <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-gray-400 text-sm">异常事件</span>
            </div>
            <p className="text-3xl font-bold text-red-400">{report.anomalyDetails.length}</p>
          </div>
        </motion.div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors
                ${activeTab === tab.id 
                  ? 'bg-cyan-500 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gray-800/60 rounded-xl border border-gray-700 p-6 min-h-96"
        >
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">判定分布</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={judgeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {judgeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">站台拥堵</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={platformData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Bar dataKey="avg" name="平均拥堵%" fill="#00D4FF" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="max" name="最大拥堵%" fill="#FF4757" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-4">核心数据</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-400 text-sm">平均偏移</p>
                    <p className="text-2xl font-bold text-white">{report.rhythmAnalysis.averageOffset.toFixed(1)}ms</p>
                  </div>
                  <div className="p-4 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-400 text-sm">总发车数</p>
                    <p className="text-2xl font-bold text-white">{report.dispatchAnalysis.totalDispatches}</p>
                  </div>
                  <div className="p-4 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-400 text-sm">平均间隔</p>
                    <p className="text-2xl font-bold text-white">{(report.dispatchAnalysis.avgInterval / 1000).toFixed(2)}s</p>
                  </div>
                  <div className="p-4 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-400 text-sm">调度效率</p>
                    <p className="text-2xl font-bold text-white">{report.dispatchAnalysis.queueEfficiency.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rhythm' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">判定详情</h3>
                <div className="space-y-4">
                  {judgeData.map((item) => (
                    <div key={item.name} className="flex items-center gap-4">
                      <div className="w-20 text-gray-300">{item.name}</div>
                      <div className="flex-1 h-6 bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${report.rhythmAnalysis.totalBeats > 0 ? (item.value / report.rhythmAnalysis.totalBeats) * 100 : 0}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <div className="w-16 text-right text-white font-mono">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">提前/延迟分布</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={offsetData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {offsetData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="md:col-span-2 p-4 bg-gray-900/50 rounded-lg">
                <h4 className="text-md font-semibold text-white mb-2">节奏分析建议</h4>
                <ul className="text-gray-300 space-y-1 text-sm">
                  {report.rhythmAnalysis.averageOffset > 50 && (
                    <li>⚠️ 平均偏移较大，建议多练习节奏感</li>
                  )}
                  {report.rhythmAnalysis.offsetDistribution.early > report.rhythmAnalysis.offsetDistribution.late && (
                    <li>📊 提前点击较多，建议稍作等待再操作</li>
                  )}
                  {report.rhythmAnalysis.offsetDistribution.late > report.rhythmAnalysis.offsetDistribution.early && (
                    <li>📊 延迟点击较多，建议提高反应速度</li>
                  )}
                  {report.rhythmAnalysis.hitRate < 0.7 && (
                    <li>💡 命中率低于70%，建议从简单难度开始练习</li>
                  )}
                  {report.rhythmAnalysis.hitRate >= 0.9 && (
                    <li>🎉 表现优秀！可以尝试更高难度</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'dispatch' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">调度数据</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">总发车数</span>
                    <span className="text-white font-mono">{report.dispatchAnalysis.totalDispatches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">平均发车间隔</span>
                    <span className="text-white font-mono">{(report.dispatchAnalysis.avgInterval / 1000).toFixed(2)}秒</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">最小发车间隔</span>
                    <span className={`font-mono ${report.dispatchAnalysis.minInterval < 1500 ? 'text-red-400' : 'text-white'}`}>
                      {(report.dispatchAnalysis.minInterval / 1000).toFixed(2)}秒
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">追尾警告次数</span>
                    <span className={`font-mono ${report.dispatchAnalysis.collisionCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {report.dispatchAnalysis.collisionCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">调度效率</span>
                    <span className="text-white font-mono">{report.dispatchAnalysis.queueEfficiency.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">站台客流统计</h3>
                <div className="space-y-3">
                  {report.congestionAnalysis.platformStats.map((p) => (
                    <div key={p.platformId} className="flex items-center gap-3">
                      <div className="w-24 text-sm text-gray-300 truncate">{p.platformName}</div>
                      <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, p.avgCongestion)}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-sm text-gray-300">
                        {p.avgCongestion.toFixed(1)}%
                      </div>
                      {p.overflowCount > 0 && (
                        <span className="text-red-400 text-xs">溢出{p.overflowCount}次</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'anomalies' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">异常事件统计</h3>
                <span className="text-gray-400 text-sm">共 {report.anomalyDetails.length} 条记录</span>
              </div>
              
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={anomalyTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {anomalyTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {report.anomalyDetails.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {report.anomalyDetails.map((anomaly) => (
                    <motion.div
                      key={anomaly.id}
                      className={`p-3 rounded-lg border flex items-center gap-3
                        ${anomaly.severity === 'danger' 
                          ? 'bg-red-900/30 border-red-500/50' 
                          : 'bg-yellow-900/30 border-yellow-500/50'}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${anomaly.severity === 'danger' ? 'text-red-400' : 'text-yellow-400'}`} />
                      <div className="flex-1">
                        <div className="text-sm text-white">{anomaly.description}</div>
                        <div className="text-xs text-gray-400">
                          时间: {(anomaly.time / 1000).toFixed(2)}s · 类型: {anomaly.type}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium
                        ${anomaly.severity === 'danger' 
                          ? 'bg-red-500/30 text-red-300' 
                          : 'bg-yellow-500/30 text-yellow-300'}`}>
                        {anomaly.severity === 'danger' ? '危险' : '警告'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  🎉 无异常事件，表现完美！
                </div>
              )}
            </div>
          )}
        </motion.div>

        <motion.div
          className="flex justify-center gap-4 mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={handleHome}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            返回主页
          </button>
          <button
            onClick={handleRestart}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            再来一局
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default Report;
