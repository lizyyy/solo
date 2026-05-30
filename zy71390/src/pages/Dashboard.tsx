import { useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { Activity, Target, AlertTriangle, Users } from 'lucide-react';
import { useStore } from '@/store';
import AnomalyAlert from '@/components/AnomalyAlert';
import { StatCardSkeleton, ChartSkeleton } from '@/components/Skeleton';
import { TIER_COLORS, TIER_LABELS } from '../../shared/types';

export default function Dashboard() {
  const dashboardStats = useStore((state) => state.dashboardStats);
  const loading = useStore((state) => state.loading.dashboardStats);
  const fetchDashboardStats = useStore((state) => state.fetchDashboardStats);
  const error = useStore((state) => state.error);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const unresolvedAnomalies = dashboardStats?.recentAnomalies.filter((a) => !a.resolved) || [];

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {unresolvedAnomalies.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-danger" />
            <h3 className="text-lg font-semibold text-white">
              未解决异常 ({unresolvedAnomalies.length})
            </h3>
          </div>
          <div className="space-y-3">
            {unresolvedAnomalies.map((anomaly) => (
              <AnomalyAlert
                key={anomaly.id}
                anomaly={anomaly}
                onResolve={fetchDashboardStats}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))
        ) : (
          <>
            <div className="card p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">今日演练数</span>
                <Activity className="w-5 h-5 text-primary-light" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {dashboardStats?.todayDrills ?? 0}
              </div>
              <div className="text-xs text-slate-500">次演练</div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">总命中数</span>
                <Target className="w-5 h-5 text-warning" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {dashboardStats?.totalHits?.toLocaleString() ?? 0}
              </div>
              <div className="text-xs text-slate-500">次命中</div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">活跃异常数</span>
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {dashboardStats?.activeAnomalies ?? 0}
              </div>
              <div className="text-xs text-slate-500">个异常</div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">受影响客户数</span>
                <Users className="w-5 h-5 text-success" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {dashboardStats?.affectedCustomers ?? 0}
              </div>
              <div className="text-xs text-slate-500">位客户</div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">命中趋势</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardStats?.hitTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="hits"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      name="命中数"
                      dot={{ fill: '#F59E0B' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="drills"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      name="演练数"
                      dot={{ fill: '#3B82F6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">客户分层分布</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardStats?.tierDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="tier"
                      label={({ tier, count }) => `${TIER_LABELS[tier]}: ${count}`}
                    >
                      {dashboardStats?.tierDistribution?.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={TIER_COLORS[entry.tier]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} 人`,
                        `${TIER_LABELS[name as keyof typeof TIER_LABELS]}`,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {dashboardStats?.tierDistribution?.map((item) => (
                  <div key={item.tier} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: TIER_COLORS[item.tier] }}
                      />
                      <span className="text-slate-400">{TIER_LABELS[item.tier]}</span>
                    </div>
                    <span className="text-white font-medium">
                      {item.count} 人 ({item.hitCount} 次命中)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">命中按层级分布</h3>
        {loading ? (
          <div className="h-64 animate-pulse bg-dark-200 rounded-lg" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardStats?.tierDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="tier"
                  stroke="#94A3B8"
                  tick={{ fill: '#94A3B8', fontSize: 12 }}
                  tickFormatter={(tier) => TIER_LABELS[tier]}
                />
                <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend />
                <Bar dataKey="count" name="客户数" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="hitCount" name="命中数" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
