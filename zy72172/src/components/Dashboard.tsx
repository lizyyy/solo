import React from 'react';
import { SignalPoint } from '../types';

interface DashboardProps {
  points: SignalPoint[];
}

export default function Dashboard({ points }: DashboardProps) {
  const total = points.length;
  const approved = points.filter(p => p.status === 'approved').length;
  const pending = points.filter(p => p.status === 'pending').length;
  const conflict = points.filter(p => p.status === 'conflict').length;
  const legacy = points.filter(p => p.status === 'legacy').length;
  const hasConflicts = points.filter(p => p.hasConflict).length;

  const streetStats = points.reduce((acc, p) => {
    acc[p.street] = (acc[p.street] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const StatCard = ({ label, value, colorClass, subtext }: {
    label: string;
    value: number;
    colorClass: string;
    subtext?: string;
  }) => (
    <div className={`p-4 rounded-lg border ${colorClass}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-80">{label}</div>
      {subtext && <div className="text-xs mt-1 opacity-60">{subtext}</div>}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-slate-800">数据看板</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="点位总数"
          value={total}
          colorClass="bg-slate-100 border-slate-200 text-slate-700"
        />
        <StatCard
          label="复核通过"
          value={approved}
          colorClass="bg-green-50 border-green-200 text-green-700"
          subtext={`${Math.round((approved / total) * 100)}%`}
        />
        <StatCard
          label="待确认"
          value={pending}
          colorClass="bg-amber-50 border-amber-200 text-amber-700"
          subtext="需人工处理"
        />
        <StatCard
          label="存在冲突"
          value={conflict}
          colorClass="bg-red-50 border-red-200 text-red-700"
          subtext={`${hasConflicts} 个点位有问题`}
        />
        <StatCard
          label="历史版本"
          value={legacy}
          colorClass="bg-gray-50 border-gray-200 text-gray-700"
          subtext="旧口径导入"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">状态分布</h3>
          <div className="space-y-3">
            {[
              { label: '复核通过', value: approved, color: 'bg-green-500' },
              { label: '待确认', value: pending, color: 'bg-amber-500' },
              { label: '存在冲突', value: conflict, color: 'bg-red-500' },
              { label: '历史版本', value: legacy, color: 'bg-gray-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-medium text-slate-800">{item.value}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all`}
                    style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">按街道分布</h3>
          <div className="space-y-3">
            {Object.entries(streetStats).map(([street, count]) => (
              <div key={street}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{street}</span>
                  <span className="font-medium text-slate-800">{count} 个</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">⚠️ 需要重点关注的点位</h3>
        <div className="text-sm text-amber-700">
          {points.filter(p => p.hasConflict).length > 0 ? (
            <ul className="list-disc list-inside space-y-1">
              {points.filter(p => p.hasConflict).map(p => (
                <li key={p.id}>
                  <span className="font-medium">{p.name}</span>
                  {p.conflictNote && ` - ${p.conflictNote}`}
                  {!p.manualNote && ' (未添加人工备注)'}
                </li>
              ))}
            </ul>
          ) : (
            <p>所有点位均无冲突，状态良好。</p>
          )}
        </div>
      </div>
    </div>
  );
}
