import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useStatistics } from '../../hooks/useRecordQueries';

export default function StatsChart() {
  const stats = useStatistics();

  const statusData = useMemo(() => {
    return [
      { name: '待复核', value: stats.pending, color: '#94a3b8' },
      { name: '已复核', value: stats.reviewed, color: '#22c55e' },
      { name: '异常', value: stats.anomaly, color: '#f97316' },
      { name: '边界', value: stats.boundary, color: '#a855f7' },
    ];
  }, [stats]);

  const seaStateData = useMemo(() => {
    return stats.seaStateDistribution.filter(d => d.count > 0).map(d => ({
      level: `${d.level}级`,
      count: d.count,
    }));
  }, [stats]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-medium text-slate-700">统计分布</h3>
        <p className="text-xs text-slate-400 mt-0.5">随复核动作实时更新</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-600 mb-2">状态分布</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={45}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    boxShadow: 'none',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {statusData.map(item => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
                <span className="font-medium text-slate-700 ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-600 mb-2">海况等级分布</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seaStateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="level" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    boxShadow: 'none',
                  }}
                />
                <Bar dataKey="count" fill="#0B7AFF" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-ocean-50 rounded-lg p-3 border border-ocean-100">
          <p className="text-xs font-medium text-ocean-700 mb-2">复核进度</p>
          <div className="h-2 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-ocean-500 rounded-full transition-all duration-700"
              style={{ width: `${stats.total ? (stats.reviewed / stats.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-ocean-600 mt-1.5 text-right font-medium">
            {stats.reviewed} / {stats.total} 条
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-alert-400/10 rounded-lg p-2.5 border border-alert-400/20">
            <p className="text-xs text-slate-500">异常数</p>
            <p className="text-lg font-semibold text-alert-500">{stats.anomaly}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-2.5 border border-purple-200">
            <p className="text-xs text-slate-500">边界样本</p>
            <p className="text-lg font-semibold text-purple-600">{stats.boundary}</p>
          </div>
          <div className="bg-cyan-50 rounded-lg p-2.5 border border-cyan-200">
            <p className="text-xs text-slate-500">云遮挡</p>
            <p className="text-lg font-semibold text-cyan-600">{stats.cloudOccluded}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2.5 border border-green-200">
            <p className="text-xs text-slate-500">总记录</p>
            <p className="text-lg font-semibold text-green-600">{stats.total}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
