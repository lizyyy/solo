import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, AlertTriangle, FileCheck, ShieldCheck, BarChart3 } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useClearingStore } from '@/store/useClearingStore';
import Clearing3DChart from '@/components/charts/Clearing3DChart';
import StatusPieChart from '@/components/charts/StatusPieChart';
import AmountDisplay from '@/components/common/AmountDisplay';

export default function ClearingOverview() {
  const navigate = useNavigate();
  const { chart3DData, pieChartData, getOverviewStats, adjustments } = useClearingStore();
  const stats = getOverviewStats();

  const trendData = useMemo(() => {
    return chart3DData.map((d) => ({
      date: d.date.slice(5),
      金额: d.amount,
      笔数: d.count,
      异常: d.hasFlagged ? d.count : 0,
    }));
  }, [chart3DData]);

  const totalAmount = useMemo(() => {
    return adjustments.reduce((sum, a) => sum + a.amount, 0);
  }, [adjustments]);

  const statCards = [
    {
      label: '总清算金额',
      value: <AmountDisplay amount={totalAmount} className="text-lg" />,
      icon: TrendingUp,
      color: 'text-finance-green',
      bgColor: 'bg-finance-green-light',
    },
    {
      label: '总记录数',
      value: <span className="text-2xl font-bold text-carbon-800">{stats.total}</span>,
      icon: BarChart3,
      color: 'text-custody-blue',
      bgColor: 'bg-custody-blue-light',
    },
    {
      label: '待补托管页',
      value: <span className="text-2xl font-bold text-warning-orange">{stats.pendingCustody}</span>,
      icon: FileCheck,
      color: 'text-warning-orange',
      bgColor: 'bg-warning-orange-light',
      action: () => navigate('/custody'),
    },
    {
      label: '待风控复核',
      value: <span className="text-2xl font-bold text-risk-red">{stats.pendingReview}</span>,
      icon: ShieldCheck,
      color: 'text-risk-red',
      bgColor: 'bg-risk-red-light',
      action: () => navigate('/review'),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-carbon-800">清算总览</h1>
          <p className="text-carbon-500 mt-1">3D可视化展示近期清算数据，点击异常柱形可跳转处理</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`bg-white rounded-xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200 ${
                card.action ? 'cursor-pointer hover:-translate-y-1' : ''
              } animate-slide-up`}
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={card.action}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-carbon-500">{card.label}</p>
                  <div className="mt-2">{card.value}</div>
                </div>
                <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-carbon-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-custody-blue" />
            3D清算金额柱形图
          </h2>
          <div className="flex items-center gap-4 text-xs text-carbon-400">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-carbon-500 rounded" />
              正常
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-risk-red rounded animate-pulse-slow" />
              异常（含冲正记录）
            </div>
          </div>
        </div>
        <Clearing3DChart data={chart3DData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-semibold text-carbon-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-finance-green" />
            金额趋势图
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3a4b73" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3a4b73" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e9f2" />
                <XAxis dataKey="date" stroke="#93a0c0" fontSize={12} />
                <YAxis stroke="#93a0c0" fontSize={12} />
                <Tooltip
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '金额']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e6e9f2',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="金额"
                  stroke="#3a4b73"
                  strokeWidth={2}
                  fill="url(#colorAmount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-semibold text-carbon-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning-orange" />
            状态分布
          </h2>
          <StatusPieChart data={pieChartData} />
        </div>
      </div>

      <div className="bg-gradient-to-r from-carbon-50 to-custody-blue-light/20 rounded-xl p-6 border border-custody-blue/20">
        <h3 className="font-semibold text-carbon-800 mb-3">💡 数据解读</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white/80 rounded-lg p-4">
            <p className="text-carbon-500 mb-1">异常记录占比</p>
            <p className="text-2xl font-bold text-risk-red">
              {stats.total > 0 ? ((stats.flagged / stats.total) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-carbon-400 mt-1">
              共 {stats.flagged} 条冲正记录待处理
            </p>
          </div>
          <div className="bg-white/80 rounded-lg p-4">
            <p className="text-carbon-500 mb-1">日均清算金额</p>
            <p className="text-2xl font-bold text-carbon-800 font-mono">
              ¥{chart3DData.length > 0
                ? (chart3DData.reduce((s, d) => s + d.amount, 0) / chart3DData.length).toLocaleString(undefined, { maximumFractionDigits: 0 })
                : 0}
            </p>
            <p className="text-xs text-carbon-400 mt-1">
              基于最近 {chart3DData.length} 天数据
            </p>
          </div>
          <div className="bg-white/80 rounded-lg p-4">
            <p className="text-carbon-500 mb-1">处理进度</p>
            <p className="text-2xl font-bold text-finance-green">
              {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-carbon-400 mt-1">
              已完成 {stats.completed} / {stats.total} 条
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
