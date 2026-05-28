import { Activity, AlertTriangle, Users, Clock, TrendingUp } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { useSessionStore } from '@/store/sessionStore';
import { calculateSessionRisk } from '@/services/riskScoring';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function Dashboard() {
  const { sessionList, anomalyData } = useSessionStore();
  const { avgRisk, maxRisk, highRiskCount } = calculateSessionRisk(anomalyData);

  const needsReviewCount = anomalyData.filter((a) => a.reviewStatus === 'needs_review').length;
  const highRiskPercentage = anomalyData.length > 0
    ? Math.round((highRiskCount / anomalyData.length) * 100)
    : 0;

  const riskDistribution = [
    { range: '0-30', count: anomalyData.filter((a) => a.riskScore < 30).length, risk: '极低' },
    { range: '30-50', count: anomalyData.filter((a) => a.riskScore >= 30 && a.riskScore < 50).length, risk: '低' },
    { range: '50-70', count: anomalyData.filter((a) => a.riskScore >= 50 && a.riskScore < 70).length, risk: '中' },
    { range: '70-85', count: anomalyData.filter((a) => a.riskScore >= 70 && a.riskScore < 85).length, risk: '高' },
    { range: '85-100', count: anomalyData.filter((a) => a.riskScore >= 85).length, risk: '极高' },
  ];

  const pieData = [
    { name: '已确认', value: anomalyData.filter((a) => a.reviewStatus === 'confirmed').length, color: '#00B42A' },
    { name: '待处理', value: anomalyData.filter((a) => a.reviewStatus === 'pending').length, color: '#165DFF' },
    { name: '待复核', value: anomalyData.filter((a) => a.reviewStatus === 'needs_review').length, color: '#FFC53D' },
    { name: '误报', value: anomalyData.filter((a) => a.reviewStatus === 'false_positive').length, color: '#86909C' },
  ];

  const trendData = [
    { date: '周一', sessionCount: 5, avgRisk: 45, anomalyCount: 12 },
    { date: '周二', sessionCount: 8, avgRisk: 52, anomalyCount: 18 },
    { date: '周三', sessionCount: 6, avgRisk: 48, anomalyCount: 15 },
    { date: '周四', sessionCount: 10, avgRisk: 58, anomalyCount: 22 },
    { date: '周五', sessionCount: 7, avgRisk: 55, anomalyCount: 16 },
    { date: '周六', sessionCount: 12, avgRisk: 62, anomalyCount: 28 },
    { date: '周日', sessionCount: 9, avgRisk: 50, anomalyCount: 20 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">数据概览</h1>
        <p className="text-dark-400 mt-1">实时监控VR晕动症分析数据</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总会话数"
          value={sessionList.length}
          icon={<Users className="w-5 h-5" />}
          color="blue"
          trend="up"
          trendValue="+12% 本周"
        />
        <StatCard
          title="异常点总数"
          value={anomalyData.length}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="orange"
          trend="up"
          trendValue="+8% 本周"
        />
        <StatCard
          title="高风险占比"
          value={`${highRiskPercentage}%`}
          icon={<Activity className="w-5 h-5" />}
          color="red"
          trend="neutral"
          trendValue="持平"
        />
        <StatCard
          title="待复核数量"
          value={needsReviewCount}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
          trend="down"
          trendValue="-3 较昨日"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-700/50 rounded-xl border border-dark-600 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">风险趋势</h3>
            <div className="flex items-center gap-4 text-xs text-dark-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-500 rounded" /> 平均风险
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-orange-500 rounded" /> 异常数
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#272E3B" />
                <XAxis dataKey="date" stroke="#86909C" fontSize={12} />
                <YAxis yAxisId="left" stroke="#86909C" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#86909C" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F1218',
                    border: '1px solid #272E3B',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#E5E6EB' }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgRisk"
                  stroke="#165DFF"
                  strokeWidth={2}
                  dot={false}
                  name="平均风险"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="anomalyCount"
                  stroke="#FF7D00"
                  strokeWidth={2}
                  dot={false}
                  name="异常数"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
          <h3 className="font-display font-semibold text-white mb-4">复核状态分布</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F1218',
                    border: '1px solid #272E3B',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-dark-300">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
          <h3 className="font-display font-semibold text-white mb-4">风险评分分布</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#272E3B" />
                <XAxis dataKey="range" stroke="#86909C" fontSize={12} />
                <YAxis stroke="#86909C" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F1218',
                    border: '1px solid #272E3B',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {riskDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index === 0 ? '#10B981' :
                        index === 1 ? '#3B82F6' :
                        index === 2 ? '#F59E0B' :
                        index === 3 ? '#F97316' : '#EF4444'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
          <h3 className="font-display font-semibold text-white mb-4">最近会话</h3>
          <div className="space-y-3">
            {sessionList.slice(0, 5).map((session, idx) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg bg-dark-800/50 hover:bg-dark-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-sm font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{session.sessionName}</div>
                    <div className="text-xs text-dark-400">
                      {formatDistanceToNow(session.importedAt, { addSuffix: true, locale: zhCN })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    session.status === 'ready'
                      ? 'bg-success-500/20 text-success-400'
                      : 'bg-warning-500/20 text-warning-400'
                  }`}>
                    {session.status === 'ready' ? '已就绪' : '处理中'}
                  </span>
                  <TrendingUp className="w-4 h-4 text-dark-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
