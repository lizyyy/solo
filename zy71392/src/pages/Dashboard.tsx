import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { FileCode, Terminal, Shield, AlertTriangle, Clock, FileBarChart } from 'lucide-react';
import { api, type DashboardStats, type Activity } from '@/utils/api';
import { useAppStore } from '@/store/appStore';

const statCards = [
  { key: 'script_count', icon: FileCode, label: '脚本数量', color: 'text-brand-400' },
  { key: 'api_call_count', icon: Terminal, label: 'API调用', color: 'text-blue-400' },
  { key: 'permission_count', icon: Shield, label: '权限条目', color: 'text-purple-400' },
  { key: 'high_risk_count', icon: AlertTriangle, label: '高风险项', color: 'text-red-400' },
  { key: 'exception_pending_count', icon: Clock, label: '待批例外', color: 'text-amber-400' },
  { key: 'report_draft_count', icon: FileBarChart, label: '草稿报告', color: 'text-cyan-400' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [distribution, setDistribution] = useState<Array<{ name: string; value: number }>>([]);
  const [riskOverview, setRiskOverview] = useState<{ total_score: number; breakdown: Array<{ category: string; score: number; count: number }> } | null>(null);
  const { showToast } = useAppStore();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [s, a, d, r] = await Promise.all([
        api.dashboard.stats(),
        api.dashboard.activities(15),
        api.dashboard.permissionDistribution(),
        api.risks.overview(),
      ]);
      setStats(s);
      setActivities(a);
      setDistribution(d);
      setRiskOverview(r);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  const radarData = riskOverview?.breakdown.map(b => ({
    subject: b.category,
    score: b.score,
    fullMark: 100,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">分析总览</h1>
        <p className="text-gray-400 text-sm mt-1">脚本权限分析与风险概览</p>
      </div>

      <div className="grid grid-cols-6 gap-4">
        {statCards.map(card => (
          <div key={card.key} className="card">
            <div className="flex items-center justify-between mb-3">
              <card.icon className={card.color} size={20} />
              <span className="text-xs text-gray-500">{card.label}</span>
            </div>
            <div className="text-2xl font-bold">{stats?.[card.key as keyof DashboardStats] || 0}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card">
          <h3 className="font-semibold mb-4">权限分布</h3>
          <div className="h-64">
            {distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#9ca3af' }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} width={80} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#222837', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">暂无数据</div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">风险雷达</h3>
          <div className="h-64">
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Radar name="风险" dataKey="score" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">暂无数据</div>
            )}
          </div>
          {riskOverview && (
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">综合风险分</span>
                <span className={`font-bold ${riskOverview.total_score >= 70 ? 'text-red-400' : riskOverview.total_score >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {riskOverview.total_score}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">最近活动</h3>
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map(act => (
              <div key={act.id} className="flex items-center justify-between py-2 border-b border-gray-700/30 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-500" />
                  <span className="text-sm">{act.description}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(act.created_at).toLocaleString('zh-CN')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm py-4">暂无活动记录</div>
        )}
      </div>
    </div>
  );
}
