import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { TrendingUp, Users, Clock, CheckCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Timeline } from '../../components/Timeline/Timeline';
import { SampleType, AttributionStatus } from '../../types';
import { getSampleTypeLabel } from '../../utils';

const Review: React.FC = () => {
  const { samples, operationLogs, getStatistics } = useStore();
  const stats = getStatistics();

  const typeDistribution = Object.values(SampleType).map((type) => ({
    name: getSampleTypeLabel(type),
    value: samples.filter((s) => s.type === type).length,
    type
  }));

  const statusData = [
    { name: '正常归因', value: stats.normal, color: '#10B981' },
    { name: '存在冲突', value: stats.conflict, color: '#EF4444' },
    { name: '待运营复核', value: stats.pendingReview, color: '#F59E0B' },
    { name: '已确认', value: stats.confirmed, color: '#3B82F6' }
  ].filter((d) => d.value > 0);

  const stepDistribution = [
    { step: '第一步：脱敏规则导入', count: samples.filter((s) => s.currentStep >= 1).length },
    { step: '第二步：补看灰度批次', count: samples.filter((s) => s.currentStep >= 2).length },
    { step: '第三步：产品复盘更新', count: samples.filter((s) => s.currentStep >= 3).length }
  ];

  const recentLogs = [...operationLogs]
    .sort((a, b) => new Date(b.operationTime).getTime() - new Date(a.operationTime).getTime())
    .slice(0, 10);

  const typeColors: Record<SampleType, string> = {
    [SampleType.NORMAL]: '#10B981',
    [SampleType.VERSION_CONFLICT]: '#F59E0B',
    [SampleType.GRAY_BACKFILL]: '#8B5CF6'
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          产品复盘
        </h2>
        <p className="text-sm text-slate-500">
          归因结果汇总、变更历史追踪、影响范围分析
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingUp size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              <p className="text-xs text-slate-500">总样本数</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.normal + stats.confirmed}</p>
              <p className="text-xs text-slate-500">已处理完成</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.pendingReview}</p>
              <p className="text-xs text-slate-500">待运营复核</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <Users size={20} className="text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-violet-600">
                {new Set(operationLogs.map((l) => l.operator)).size}
              </p>
              <p className="text-xs text-slate-500">参与操作人数</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-medium text-slate-700 mb-4">样本类型分布</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={typeColors[entry.type]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-medium text-slate-700 mb-4">状态分布</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
        <h3 className="text-sm font-medium text-slate-700 mb-4">三步流程完成情况</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stepDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="step" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-lg font-bold text-blue-700">{stepDistribution[0].count}</p>
            <p className="text-xs text-blue-600">第一步完成</p>
          </div>
          <div className="p-3 bg-violet-50 rounded-lg">
            <p className="text-lg font-bold text-violet-700">{stepDistribution[1].count}</p>
            <p className="text-xs text-violet-600">第二步完成</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg">
            <p className="text-lg font-bold text-emerald-700">{stepDistribution[2].count}</p>
            <p className="text-xs text-emerald-600">第三步完成</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="text-sm font-medium text-slate-700 mb-4">最近操作记录</h3>
        <Timeline logs={recentLogs} />
      </div>
    </div>
  );
};

export default Review;
