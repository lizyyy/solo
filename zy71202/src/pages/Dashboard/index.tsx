import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Users,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { triggerWindowService } from '@/services/TriggerWindowService';
import {
  formatNumber,
  formatMoney,
  formatDate,
  getStatusBadgeClass,
  generateChartColors,
} from '@/utils/format';
import { TASK_STATUS_TEXT } from '@/services/ExportService';

const Dashboard: React.FC = () => {
  const {
    bonds,
    triggerResults,
    disposalTasks,
    positions,
    stockQuotes,
    isRefreshing,
    setSelectedBond,
  } = useAppStore();

  const stats = useMemo(() => {
    const triggered = Object.values(triggerResults).filter(r => r.isTriggered).length;
    const warning = Object.values(triggerResults).filter(
      r => !r.isTriggered && r.meetDays >= r.totalDays * 0.7
    ).length;
    const hasGap = Object.values(triggerResults).filter(r => r.hasGap).length;
    const pendingTasks = disposalTasks.filter(t => t.status === 'PENDING_CONFIRM').length;
    const totalPosition = positions.reduce((sum, p) => sum + p.positionAmount, 0);
    const totalCustomers = new Set(positions.map(p => p.customerId)).size;

    return {
      triggered,
      warning,
      hasGap,
      pendingTasks,
      totalBonds: bonds.length,
      totalPosition,
      totalCustomers,
      processedTasks: disposalTasks.filter(t => t.status === 'PROCESSED').length,
      returnedTasks: disposalTasks.filter(t => t.status === 'RETURNED').length,
    };
  }, [triggerResults, disposalTasks, positions, bonds]);

  const chartData = useMemo(() => {
    const triggeredBonds = Object.values(triggerResults)
      .filter(r => r.isTriggered || r.meetDays >= r.totalDays * 0.5)
      .slice(0, 6);

    return triggeredBonds.map(result => {
      const bond = bonds.find(b => b.bondCode === result.bondCode);
      const quotes = stockQuotes[bond?.stockCode || ''] || [];
      const recentQuotes = quotes.slice(-10);

      return {
        bondCode: result.bondCode,
        bondName: bond?.bondName || '',
        redemptionPrice: bond?.redemptionPrice || 0,
        meetDays: result.meetDays,
        totalDays: result.totalDays,
        isTriggered: result.isTriggered,
        dailyData: recentQuotes.map(q => ({
          date: formatDate(q.tradeDate, 'MM-DD'),
          price: q.closePrice,
          meet: q.meetRedemptionCondition ? 1 : 0,
        })),
      };
    });
  }, [triggerResults, bonds, stockQuotes]);

  const heatmapData = useMemo(() => {
    const data: Array<{
      bondCode: string;
      bondName: string;
      days: Array<{ date: string; meet: boolean; consecutive: number }>;
    }> = [];

    const triggeredBonds = Object.values(triggerResults)
      .sort((a, b) => b.meetDays - a.meetDays)
      .slice(0, 6);

    triggeredBonds.forEach(result => {
      const bond = bonds.find(b => b.bondCode === result.bondCode);
      const quotes = result.dailyQuotes.slice(-20);

      let consecutive = 0;
      const days = quotes.map(q => {
        if (q.meetRedemptionCondition) {
          consecutive++;
        } else {
          consecutive = 0;
        }
        return {
          date: formatDate(q.tradeDate, 'MM-DD'),
          meet: q.meetRedemptionCondition,
          consecutive,
        };
      });

      data.push({
        bondCode: result.bondCode,
        bondName: bond?.bondName || '',
        days,
      });
    });

    return data;
  }, [triggerResults, bonds]);

  const recentTasks = useMemo(() => {
    return [...disposalTasks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [disposalTasks]);

  const industryChartData = useMemo(() => {
    const industryMap: Record<string, { count: number; triggered: number }> = {};
    bonds.forEach(bond => {
      if (!industryMap[bond.industry]) {
        industryMap[bond.industry] = { count: 0, triggered: 0 };
      }
      industryMap[bond.industry].count++;
      const result = triggerResults[bond.bondCode];
      if (result?.isTriggered) {
        industryMap[bond.industry].triggered++;
      }
    });
    return Object.entries(industryMap)
      .map(([name, data]) => ({
        name,
        监控中: data.count - data.triggered,
        已触发: data.triggered,
        总计: data.count,
      }))
      .sort((a, b) => b.总计 - a.总计);
  }, [bonds, triggerResults]);

  const handleBondClick = (bondCode: string) => {
    setSelectedBond(bondCode);
  };

  if (isRefreshing && bonds.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
          <p className="text-slate-600">正在加载数据...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: '已触发强赎',
      value: stats.triggered,
      total: stats.totalBonds,
      icon: AlertTriangle,
      gradient: 'from-red-500 to-rose-600',
      delay: 0,
    },
    {
      label: '即将触发',
      value: stats.warning,
      total: stats.totalBonds,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      delay: 100,
    },
    {
      label: '待确认任务',
      value: stats.pendingTasks,
      icon: TrendingUp,
      gradient: 'from-blue-500 to-indigo-600',
      delay: 200,
    },
    {
      label: '数据断档',
      value: stats.hasGap,
      total: stats.totalBonds,
      icon: XCircle,
      gradient: 'from-slate-500 to-slate-700',
      delay: 300,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div
            key={card.label}
            className="stat-card animate-slide-up"
            style={{ animationDelay: `${card.delay}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-90`} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/80 text-sm font-medium">{card.label}</span>
                <card.icon className="w-6 h-6 text-white/80" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white font-serif">
                  {card.value}
                </span>
                {card.total !== undefined && (
                  <span className="text-white/60 text-sm">/ {card.total}</span>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex items-center justify-between text-white/70 text-xs">
                  <span>
                    {card.label === '已触发强赎' && `持仓总金额 ${formatNumber(stats.totalPosition)}元`}
                    {card.label === '即将触发' && `涉及 ${stats.totalCustomers} 位客户`}
                    {card.label === '待确认任务' && `已处理 ${stats.processedTasks} 单`}
                    {card.label === '数据断档' && `需退回 ${stats.returnedTasks} 单`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 font-serif">正股价格走势</h3>
              <p className="text-sm text-slate-500 mt-0.5">近10个交易日收盘价对比</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <DollarSign className="w-4 h-4" />
              <span>单位：元</span>
            </div>
          </div>
          <div className="card-body h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend />
                {chartData.length > 0 && chartData[0].dailyData.some(d => d.price) && (
                  <ReferenceLine
                    y={chartData[0]?.redemptionPrice || 0}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    label={{ value: '强赎触发线', fill: '#ef4444', fontSize: 11 }}
                  />
                )}
                {chartData.map((bond, index) => (
                  <Line
                    key={bond.bondCode}
                    data={bond.dailyData}
                    type="monotone"
                    dataKey="price"
                    name={bond.bondName}
                    stroke={generateChartColors(chartData.length)[index]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    onClick={() => handleBondClick(bond.bondCode)}
                    className="cursor-pointer"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-slate-800 font-serif">待办任务</h3>
            <p className="text-sm text-slate-500 mt-0.5">最新处置任务列表</p>
          </div>
          <div className="card-body p-0">
            <div className="divide-y divide-slate-100">
              {recentTasks.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-success-500/50" />
                  <p>暂无待办任务</p>
                </div>
              ) : (
                recentTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => handleBondClick(task.bondCode)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 truncate">
                            {task.bondName}
                          </span>
                          <span className={getStatusBadgeClass(task.status)}>
                            {TASK_STATUS_TEXT[task.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {task.customerCount} 位客户
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatNumber(task.totalPosition)} 元
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(task.createdAt, 'MM-DD HH:mm')}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600 transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-slate-800 font-serif">连续达标热力图</h3>
            <p className="text-sm text-slate-500 mt-0.5">近20个交易日满足强赎条件情况</p>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto scrollbar-thin">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-[120px_repeat(20,1fr)] gap-1 mb-2">
                  <div className="text-xs font-medium text-slate-500 text-right pr-2">转债名称</div>
                  {heatmapData[0]?.days.map((day, i) => (
                    <div key={i} className="text-xs text-slate-500 text-center">
                      {day.date.slice(3)}
                    </div>
                  ))}
                </div>

                {heatmapData.map(bond => (
                  <div
                    key={bond.bondCode}
                    className="grid grid-cols-[120px_repeat(20,1fr)] gap-1 mb-1 items-center cursor-pointer group"
                    onClick={() => handleBondClick(bond.bondCode)}
                  >
                    <div className="text-sm text-slate-700 text-right pr-2 truncate group-hover:text-primary-600 transition-colors">
                      {bond.bondName}
                    </div>
                    {bond.days.map((day, i) => (
                      <div
                        key={i}
                        className={`aspect-square rounded-sm transition-all ${
                          day.meet
                            ? day.consecutive >= 5
                              ? 'bg-danger-500'
                              : day.consecutive >= 3
                              ? 'bg-danger-400'
                              : 'bg-success-500'
                            : 'bg-slate-200'
                        } group-hover:ring-2 ring-primary-400`}
                        title={`${day.date}: ${day.meet ? '达标' : '未达标'}${day.consecutive > 0 ? `，连续${day.consecutive}天` : ''}`}
                      />
                    ))}
                  </div>
                ))}

                <div className="flex items-center justify-end gap-4 mt-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-slate-200 rounded-sm" />
                    <span>未达标</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-success-500 rounded-sm" />
                    <span>达标</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-danger-400 rounded-sm" />
                    <span>连续3+天</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-danger-500 rounded-sm" />
                    <span>连续5+天</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-slate-800 font-serif">行业分布</h3>
            <p className="text-sm text-slate-500 mt-0.5">触发强赎转债的行业分布</p>
          </div>
          <div className="card-body h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={industryChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="#94a3b8" width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend />
                <Bar dataKey="监控中" stackId="a" fill="#94a3b8" />
                <Bar dataKey="已触发" stackId="a" fill="#ef4444">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#ef4444' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
