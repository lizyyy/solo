import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { MapPin, AlertTriangle, BarChart3, ArrowRight, Eye } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { STATUS_LABELS } from '../../shared/types';

const COLORS = ['#6b7280', '#3b82f6', '#f59e0b', '#10b981', '#059669'];

export const VisualizationPage: React.FC = () => {
  const { breakpoints, fetchBreakpoints } = useAppStore();
  const [selectedBp, setSelectedBp] = useState<string | null>(null);

  useEffect(() => {
    fetchBreakpoints();
  }, [fetchBreakpoints]);

  const statusData = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    name: label,
    value: breakpoints.filter((b) => b.status === key).length,
    key,
  })).filter((d) => d.value > 0);

  const detourData = [
    { name: '正常', value: breakpoints.filter((b) => !b.hasConstructionDetour).length },
    { name: '施工改道未同步', value: breakpoints.filter((b) => b.hasConstructionDetour).length },
  ];

  const barData = breakpoints.map((b) => ({
    name: b.name.length > 8 ? b.name.slice(0, 8) + '...' : b.name,
    fullName: b.name,
    id: b.id,
    status: b.status,
    hasDetour: b.hasConstructionDetour ? 1 : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <BarChart3 className="w-6 h-6" />
              绿道断点数据总览
            </h3>
            <p className="text-emerald-100 text-sm">
              点击图表中的断点可以跳转到详情页查看公交刷卡时段和红线图备注
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <h4 className="font-bold text-stone-800 mb-4">状态分布</h4>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={entry.key} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <h4 className="font-bold text-stone-800 mb-4">施工改道情况</h4>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={detourData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
        <h4 className="font-bold text-stone-800 mb-2">断点概览</h4>
        <p className="text-sm text-stone-500 mb-4">
          点击柱状图上的断点可直接跳转到详情页，查看关联的公交刷卡时段和红线图备注
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white border border-stone-200 rounded-lg shadow-lg p-3">
                      <div className="font-medium text-stone-800">{data.fullName}</div>
                      <div className="text-xs text-stone-500 mt-1">
                        状态：{STATUS_LABELS[data.status as keyof typeof STATUS_LABELS]}
                      </div>
                      <div className="text-xs text-orange-600 mt-0.5">
                        {data.hasDetour ? '⚠️ 有施工改道' : '正常'}
                      </div>
                      <Link
                        to={`/breakpoints/${data.id}`}
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline mt-2 font-medium"
                      >
                        <Eye className="w-3 h-3" />
                        查看详情 →
                      </Link>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="hasDetour" name="施工改道标记" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 bg-amber-50">
          <h4 className="font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            需要居民代表复核的施工临时改道（直接点击跳转）
          </h4>
        </div>
        <div className="divide-y divide-amber-100">
          {breakpoints.filter((b) => b.status === 'pending_review').map((bp) => (
            <Link
              key={bp.id}
              to={`/breakpoints/${bp.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-amber-50/50 transition-colors group"
            >
              <div>
                <div className="font-medium text-stone-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  {bp.name}
                </div>
                <div className="text-sm text-stone-500 mt-1">{bp.location}</div>
              </div>
              <div className="flex items-center gap-2 text-amber-600 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                查看并复核
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VisualizationPage;
