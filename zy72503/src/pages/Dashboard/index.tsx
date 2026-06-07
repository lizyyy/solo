import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Clock,
  Search,
  Filter,
  ArrowUpRight,
  Layers,
  FileText,
} from 'lucide-react';
import { useConflictStore } from '@/store/useConflictStore';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { mockTrendData } from '@/utils/mockData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { cn } from '@/lib/utils';
import type { Conflict, ConflictStatus } from '@/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { conflicts } = useConflictStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConflictStatus | 'all'>('all');

  const stats = useMemo(() => {
    const total = conflicts.length;
    const pending = conflicts.filter((c) => c.status === 'pending').length;
    const reviewing = conflicts.filter((c) => c.status === 'reviewing').length;
    const resolved = conflicts.filter((c) => c.status === 'resolved').length;
    const modelChanged = conflicts.filter((c) => c.isModelVersionChanged).length;
    return { total, pending, reviewing, resolved, modelChanged };
  }, [conflicts]);

  const filteredConflicts = useMemo(() => {
    return conflicts.filter((c) => {
      const matchesSearch =
        c.sampleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.labelA.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.labelB.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [conflicts, searchQuery, statusFilter]);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-800">冲突总览</h1>
          <p className="text-sm text-slate-500 mt-1">监控和管理所有图片质检标签冲突</p>
        </div>
        <button
          onClick={() => navigate('/import')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all hover:-translate-y-0.5"
        >
          <RefreshCw className="w-4 h-4" />
          导入知识库链接
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="待复核"
          value={stats.pending}
          subtitle="需运营复核人处理"
          icon={AlertTriangle}
          gradient="bg-gradient-to-br from-amber-500 to-orange-500"
          trend={{ value: '+2', isPositive: false }}
        />
        <StatCard
          title="处理中"
          value={stats.reviewing}
          subtitle="标注负责人处理中"
          icon={Clock}
          gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
        />
        <StatCard
          title="已解决"
          value={stats.resolved}
          subtitle="已完成复核闭环"
          icon={CheckCircle}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
          trend={{ value: '+1', isPositive: true }}
        />
        <StatCard
          title="模型版本冲突"
          value={stats.modelChanged}
          subtitle="版本换了样本没变"
          icon={Layers}
          gradient="bg-gradient-to-br from-purple-500 to-pink-500"
        />
        <StatCard
          title="冲突总数"
          value={stats.total}
          subtitle="所有记录"
          icon={FileText}
          gradient="bg-gradient-to-br from-slate-600 to-slate-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">冲突趋势</h3>
              <p className="text-sm text-slate-500">近7天冲突数量变化</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary-500" />
                <span className="text-slate-600">全部冲突</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-slate-600">版本变更冲突</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockTrendData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorModel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px -12px rgba(0,0,0,0.15)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorCount)"
                  name="全部冲突"
                />
                <Area
                  type="monotone"
                  dataKey="modelChanged"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#colorModel)"
                  name="版本变更冲突"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">快速操作</h3>
          <div className="space-y-3">
            <button
              onClick={() => setStatusFilter('pending')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-amber-50 hover:bg-amber-100/70 border border-amber-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-amber-900">待复核队列</p>
                  <p className="text-xs text-amber-600">{stats.pending} 条待处理</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>

            <button
              onClick={() => setStatusFilter('reviewing')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-blue-50 hover:bg-blue-100/70 border border-blue-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-blue-900">处理中</p>
                  <p className="text-xs text-blue-600">{stats.reviewing} 条进行中</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/visualization')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-purple-50 hover:bg-purple-100/70 border border-purple-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-purple-900">可视化分析</p>
                  <p className="text-xs text-purple-600">3D散点图 + 图表</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-purple-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-lg font-semibold text-slate-800">冲突列表</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索样本编号、标签..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ConflictStatus | 'all')}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                <option value="all">全部状态</option>
                <option value="pending">待复核</option>
                <option value="reviewing">处理中</option>
                <option value="resolved">已解决</option>
                <option value="dismissed">已忽略</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  样本编号
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  标签冲突
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  模型版本
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  特殊标记
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredConflicts.map((conflict) => (
                <tr
                  key={conflict.id}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-mono text-sm font-medium text-slate-800">
                        {conflict.sampleNumber}
                      </p>
                      {conflict.currentRemark && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                          {conflict.currentRemark}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-100">
                        {conflict.labelA}
                      </span>
                      <span className="text-slate-300">vs</span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                        {conflict.labelB}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-700">{conflict.modelVersion}</span>
                      {conflict.previousModelVersion && (
                        <span className="text-xs text-slate-400">
                          (来自 {conflict.previousModelVersion})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={conflict.status} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    {conflict.isModelVersionChanged ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                        <Layers className="w-3 h-3" />
                        版本变更
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{formatTime(conflict.updatedAt)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => navigate(`/conflict/${conflict.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      查看详情
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredConflicts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">暂无匹配的冲突记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
