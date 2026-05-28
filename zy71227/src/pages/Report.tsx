import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Eye, EyeOff, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { exportToJSON, exportToCSV } from '../utils/sanitizer';
import { scenarioLabels } from '../data/mockData';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Report() {
  const navigate = useNavigate();
  const [sanitized, setSanitized] = useState(true);
  const { generateReport, resetGame } = useGameStore();
  const report = generateReport(sanitized);

  const scenarioData = report.scenarios.map(s => ({
    name: scenarioLabels[s.type],
    count: s.count,
    impact: s.impact
  }));

  const handleExportJSON = () => {
    const data = exportToJSON(report, sanitized);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const data = exportToCSV(report.byArtwork, ['title', 'status', 'finalPrice', 'scenario']);
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestart = () => {
    resetGame();
    navigate('/');
  };

  return (
    <div className="container mx-auto px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif text-amber-100 mb-2">拍卖报告</h1>
          <p className="text-slate-400">完整经营数据分析</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSanitized(!sanitized)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              sanitized
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            {sanitized ? <EyeOff size={18} /> : <Eye size={18} />}
            {sanitized ? '已脱敏' : '原始数据'}
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
          >
            <Download size={18} />
            导出 JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
          >
            <Download size={18} />
            导出 CSV
          </button>
          <button
            onClick={handleRestart}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-500 to-rose-500 rounded-lg font-semibold hover:shadow-lg hover:shadow-amber-500/20 transition-all"
          >
            <RefreshCw size={18} />
            重新开始
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <div className="text-slate-400 text-sm mb-2">总成交额</div>
          <div className="text-4xl font-mono font-bold text-emerald-400">
            ¥{report.summary.totalRevenue.toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <div className="text-slate-400 text-sm mb-2">成交率</div>
          <div className="text-4xl font-mono font-bold text-amber-400">
            {report.summary.totalAuctions > 0
              ? Math.round((report.summary.soldCount / report.summary.totalAuctions) * 100)
              : 0}%
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <div className="text-slate-400 text-sm mb-2">平均成交价</div>
          <div className="text-4xl font-mono font-bold text-sky-400">
            ¥{Math.round(report.summary.avgSalePrice).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-medium text-amber-100 mb-4">回合收益趋势</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={report.byRound}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="round" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#fbbf24' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                name="收益"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981' }}
              />
              <Line
                type="monotone"
                dataKey="sold"
                name="成交数"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-medium text-amber-100 mb-4">场景分布</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={scenarioData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="count"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {scenarioData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 mb-8">
        <h2 className="text-lg font-medium text-amber-100 mb-4">场景影响分析</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={scenarioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar dataKey="count" name="发生次数" fill="#f59e0b" />
            <Bar dataKey="impact" name="热度影响" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-medium text-amber-100">作品明细</h2>
        </div>
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="text-left px-6 py-3 text-sm text-slate-400 font-medium">作品</th>
              <th className="text-center px-6 py-3 text-sm text-slate-400 font-medium">状态</th>
              <th className="text-right px-6 py-3 text-sm text-slate-400 font-medium">成交价</th>
              <th className="text-left px-6 py-3 text-sm text-slate-400 font-medium">场景类型</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {report.byArtwork.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-700/30">
                <td className="px-6 py-4 text-amber-100">{item.title}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.status === 'sold'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {item.status === 'sold' ? '成交' : '流拍'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-mono">
                  <span className={item.status === 'sold' ? 'text-emerald-400' : 'text-slate-500'}>
                    {item.status === 'sold' ? `¥${item.finalPrice.toLocaleString()}` : '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm ${
                    item.scenario === 'normal' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {scenarioLabels[item.scenario]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleRestart}
          className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
        >
          <Home size={20} />
          返回首页
        </button>
      </div>
    </div>
  );
}
