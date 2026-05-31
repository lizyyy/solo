import { useMemo } from 'react';
import { useStore } from '@/store';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { Clock, AlertTriangle, ShieldOff, Link2Off, CheckCircle2, ShieldCheck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const metricCards = [
  { key: 'pendingCount', label: '待确认', icon: Clock, accent: 'text-rose-400', border: 'border-rose-400/30' },
  { key: 'grayConflictCount', label: '灰度冲突', icon: AlertTriangle, accent: 'text-amber-400', border: 'border-amber-400/30' },
  { key: 'sensitiveLeakCount', label: '敏感词漏检', icon: ShieldOff, accent: 'text-rose-400', border: 'border-rose-400/30' },
  { key: 'sourceBrokenCount', label: '答案断链', icon: Link2Off, accent: 'text-amber-400', border: 'border-amber-400/30' },
  { key: 'confirmedCount', label: '已确认', icon: CheckCircle2, accent: 'text-emerald-400', border: 'border-emerald-400/30' },
  { key: 'normalCount', label: '正常', icon: ShieldCheck, accent: 'text-blue-400', border: 'border-blue-400/30' },
] as const;

export default function Dashboard() {
  const qaRecords = useStore((s) => s.qaRecords);
  const trendData = useStore((s) => s.trendData);

  const metrics = useMemo(() => ({
    pendingCount: qaRecords.filter((r) => r.status === 'pending').length,
    grayConflictCount: qaRecords.filter((r) => r.isGrayConflict).length,
    sensitiveLeakCount: qaRecords.filter((r) => r.isSensitiveLeak).length,
    sourceBrokenCount: qaRecords.filter((r) => r.isSourceBroken).length,
    confirmedCount: qaRecords.filter((r) => r.status === 'confirmed').length,
    normalCount: qaRecords.filter((r) => r.status === 'normal').length,
  }), [qaRecords]);

  const pendingRecords = useMemo(() =>
    qaRecords.filter((r) => r.status === 'pending').slice(0, 5),
    [qaRecords]
  );

  return (
    <div>
      <PageHeader title="仪表盘" subtitle="合同条款 Q&A 管理系统概览" />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {metricCards.map(({ key, label, icon: Icon, accent, border }) => (
          <div
            key={key}
            className={`bg-[#1a2332] border border-[#2a3548] rounded-xl p-5 border-l-4 ${border}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">{label}</span>
              <Icon className={`w-4 h-4 ${accent}`} />
            </div>
            <div className={`text-2xl font-bold ${accent}`}>
              {metrics[key]}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
          <h2 className="text-gray-100 font-semibold mb-4">问题趋势</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a2332',
                  border: '1px solid #2a3548',
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  fontSize: 13,
                }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="grayConflict" name="灰度冲突" stroke="#fbbf24" fill="#fbbf2420" strokeWidth={2} />
              <Area type="monotone" dataKey="sourceBroken" name="答案断链" stroke="#fb7185" fill="#fb718520" strokeWidth={2} />
              <Area type="monotone" dataKey="sensitiveLeak" name="敏感词漏检" stroke="#f97316" fill="#f9731620" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
          <h2 className="text-gray-100 font-semibold mb-4">待确认记录</h2>
          {pendingRecords.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无待确认记录</p>
          ) : (
            <div className="space-y-3">
              {pendingRecords.map((record) => (
                <div key={record.id} className="border border-[#2a3548] rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-gray-200 text-sm font-medium leading-snug line-clamp-1">
                      {record.question}
                    </span>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
                    {record.judgmentReason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
