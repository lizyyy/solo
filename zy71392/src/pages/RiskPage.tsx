import { useEffect, useState } from 'react';
import { AlertTriangle, Zap, Shield, Clock, FileCode } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api, type RiskDetail } from '@/utils/api';
import RiskBadge from '@/components/RiskBadge';

interface TabProps { label: string; icon: typeof Zap; count: number; active: boolean; onClick: () => void }

function RiskTab({ label, icon: Icon, count, active, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-bg-tertiary text-gray-400 hover:text-gray-200'
      }`}
    >
      <Icon size={18} />
      {label}
      <span className="ml-auto bg-bg-secondary px-2 py-0.5 rounded text-xs">{count}</span>
    </button>
  );
}

export default function RiskPage() {
  const [activeTab, setActiveTab] = useState<'dynamic' | 'wildcard' | 'exception'>('dynamic');
  const [risks, setRisks] = useState<RiskDetail[]>([]);
  const [overview, setOverview] = useState<{ total_score: number; breakdown: Array<{ category: string; score: number; count: number }> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [o, d, w, e] = await Promise.all([
      api.risks.overview(),
      api.risks.dynamicMiss(),
      api.risks.wildcardOver(),
      api.risks.exceptionLong(),
    ]);
    setOverview(o);
    const map = { dynamic: d, wildcard: w, exception: e };
    setRisks(map[activeTab]);
    setLoading(false);
  }

  useEffect(() => {
    if (overview) {
      const fn = activeTab === 'dynamic' ? api.risks.dynamicMiss :
                 activeTab === 'wildcard' ? api.risks.wildcardOver :
                 api.risks.exceptionLong;
      fn().then(setRisks);
    }
  }, [activeTab]);

  const counts = {
    dynamic: overview?.breakdown.find(b => b.category === '动态调用漏识别')?.count || 0,
    wildcard: overview?.breakdown.find(b => b.category === '通配权限过大')?.count || 0,
    exception: overview?.breakdown.find(b => b.category === '例外长期有效')?.count || 0,
  };

  const pieData = overview?.breakdown.map(b => ({ name: b.category, value: b.score })) || [];
  const COLORS = ['#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) return <div className="p-8 text-center text-gray-400">加载中...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <AlertTriangle size={24} className="text-amber-400" />
          风险评分
        </h1>
        <p className="text-gray-400 text-sm mt-1">分析权限配置的风险项</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 card">
          <h3 className="font-semibold mb-4">风险分布</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {pieData.map((d, idx) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx] }} />
                  <span className="text-gray-300">{d.name}</span>
                </div>
                <span className="text-gray-400">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 card">
          <h3 className="font-semibold mb-4">风险雷达</h3>
          <div className="h-64">
            {overview && (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={overview.breakdown.map(b => ({ subject: b.category, score: b.score, fullMark: 100 }))}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Radar name="风险" dataKey="score" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <RiskTab label="动态调用漏识别" icon={Zap} count={counts.dynamic} active={activeTab === 'dynamic'} onClick={() => setActiveTab('dynamic')} />
        <RiskTab label="通配权限过大" icon={Shield} count={counts.wildcard} active={activeTab === 'wildcard'} onClick={() => setActiveTab('wildcard')} />
        <RiskTab label="例外长期有效" icon={Clock} count={counts.exception} active={activeTab === 'exception'} onClick={() => setActiveTab('exception')} />
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">
          {activeTab === 'dynamic' && '动态调用漏识别风险'}
          {activeTab === 'wildcard' && '通配权限过大风险'}
          {activeTab === 'exception' && '例外长期有效风险'}
        </h3>

        {risks.length > 0 ? (
          <div className="space-y-4">
            {risks.map(r => (
              <div key={r.id} className="p-4 bg-bg-tertiary rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {r.script_name && (
                        <span className="text-sm text-gray-400 flex items-center gap-1">
                          <FileCode size={14} />
                          {r.script_name}
                        </span>
                      )}
                    </div>
                    <div className="text-base font-medium mt-1">{r.reason}</div>
                  </div>
                  <RiskBadge score={r.score} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400 mb-1">影响范围</div>
                    <div className="text-gray-200">{r.impact}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">建议动作</div>
                    <div className="text-brand-400">{r.next_action}</div>
                  </div>
                </div>

                {r.metadata && (
                  <div className="mt-3 pt-3 border-t border-gray-700/50">
                    <div className="text-xs text-gray-500">
                      {JSON.stringify(r.metadata, null, 2).slice(0, 200)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm py-8 text-center">
            <div className="flex justify-center mb-2">
              <Shield size={32} className="opacity-30" />
            </div>
            暂无此类风险
          </div>
        )}
      </div>
    </div>
  );
}
