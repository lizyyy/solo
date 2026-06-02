
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, CheckCircle, AlertTriangle, Clock, Users, FileCheck, Eye } from 'lucide-react';
import { useAppStore } from '../store/appStore';

export const Dashboard: React.FC = () => {
  const { samples, detections, trendData, report } = useAppStore();

  const totalSamples = samples.length;
  const driftCount = detections.filter((d) => d.isDrift).length;
  const completedCount = samples.filter((s) => s.status === 'completed').length;
  const reviewingCount = samples.filter((s) => s.status === 'reviewing' || s.status === 'detected').length;

  const stats = [
    {
      label: '样本总数',
      value: totalSamples,
      icon: FileCheck,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: '漂移占比',
      value: `${report.statistics.driftRate}%`,
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: '已复核',
      value: completedCount,
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: '待处理',
      value: reviewingCount,
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">检测仪表盘</h1>
          <p className="text-gray-500 mt-1">客服意图漂移监控系统</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4" />
          <span>当前用户：周姐（标注负责人）</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`${stat.bgColor} rounded-xl p-5 border border-gray-100 shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">漂移趋势</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`]}
                />
                <Line
                  type="monotone"
                  dataKey="driftRate"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                  name="漂移率"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">检测结果分类</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">模型判断</p>
                  <p className="text-xs text-gray-500">无需改判</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-green-600">
                {report.statistics.modelDecision}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">人工修正</p>
                  <p className="text-xs text-gray-500">已改判</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-orange-600">
                {report.statistics.manualCorrection}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">仍需复核</p>
                  <p className="text-xs text-gray-500">待处理</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-amber-600">
                {report.statistics.needReview}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">快捷操作</h2>
        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={() => (window.location.hash = '#/detection')}
            className="py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm"
          >
            运行漂移检测
          </button>
          <button
            onClick={() => (window.location.hash = '#/samples')}
            className="py-3 px-4 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            查看样本列表
          </button>
          <button
            onClick={() => (window.location.hash = '#/review')}
            className="py-3 px-4 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            进入人工改判
          </button>
          <button
            onClick={() => (window.location.hash = '#/reports')}
            className="py-3 px-4 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            生成检测报告
          </button>
        </div>
      </div>
    </div>
  );
};
