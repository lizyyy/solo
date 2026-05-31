import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { REVIEW_TYPE_LABELS } from '@/types';
import type { ReviewType } from '@/types';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { PieChart, BarChart3, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const DISPUTE_TYPE_TAGS: { key: ReviewType; color: string }[] = [
  { key: 'gray_conflict', color: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
  { key: 'source_broken', color: 'bg-orange-400/15 text-orange-400 border-orange-400/30' },
  { key: 'sensitive_leak', color: 'bg-rose-400/15 text-rose-400 border-rose-400/30' },
];

const SUGGESTIONS: Record<ReviewType, string> = {
  gray_conflict: '灰度冲突建议：定期对齐灰度环境与报表数据源，确保灰度结论与生产报表结论一致',
  source_broken: '来源断链建议：建立来源链接自动巡检机制，及时发现并补充缺失或失效的条款来源文档',
  sensitive_leak: '敏感词漏脱敏建议：完善敏感词库并加强自动化脱敏检测，对已入库答案进行回溯扫描',
};

function RingChart({ value, color }: { value: number; color: string }) {
  const data = [
    { name: 'filled', value },
    { name: 'rest', value: Math.max(0, 100 - value) },
  ];

  return (
    <ResponsiveContainer width={80} height={80}>
      <RePieChart>
        <Pie
          data={data}
          innerRadius={24}
          outerRadius={36}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
          stroke="none"
        >
          <Cell fill={color} />
          <Cell fill="#1e293b" />
        </Pie>
      </RePieChart>
    </ResponsiveContainer>
  );
}

export default function Report() {
  const qaRecords = useStore((s) => s.qaRecords);
  const reviewLogs = useStore((s) => s.reviewLogs);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const metrics = useMemo(() => ({
    pendingCount: qaRecords.filter((r) => r.status === 'pending').length,
    grayConflictCount: qaRecords.filter((r) => r.isGrayConflict).length,
    sensitiveLeakCount: qaRecords.filter((r) => r.isSensitiveLeak).length,
    sourceBrokenCount: qaRecords.filter((r) => r.isSourceBroken).length,
    confirmedCount: qaRecords.filter((r) => r.status === 'confirmed').length,
    normalCount: qaRecords.filter((r) => r.status === 'normal').length,
  }), [qaRecords]);

  const total = qaRecords.length;
  const passRate = total > 0 ? ((metrics.normalCount + metrics.confirmedCount) / total) * 100 : 0;
  const pendingRate = total > 0 ? (metrics.pendingCount / total) * 100 : 0;

  const disputedRecords = useMemo(() => qaRecords.filter((r) => r.status !== 'normal'), [qaRecords]);

  const causeSummary: { type: ReviewType; label: string; count: number }[] = [
    { type: 'gray_conflict', label: REVIEW_TYPE_LABELS.gray_conflict, count: metrics.grayConflictCount },
    { type: 'source_broken', label: REVIEW_TYPE_LABELS.source_broken, count: metrics.sourceBrokenCount },
    { type: 'sensitive_leak', label: REVIEW_TYPE_LABELS.sensitive_leak, count: metrics.sensitiveLeakCount },
  ];

  const barData = causeSummary.map((c) => ({ name: c.label, count: c.count }));
  const BAR_COLORS = ['#f59e0b', '#f97316', '#f43f5e'];

  function getLogsForRecord(recordId: string) {
    return reviewLogs.filter((l) => l.recordId === recordId);
  }

  function handleExport() {
    const reportData = {
      generatedAt: new Date().toISOString(),
      metrics: { total, passRate: +passRate.toFixed(1), pendingRate: +pendingRate.toFixed(1), ...metrics },
      disputedRecords: disputedRecords.map((r) => ({
        id: r.id,
        question: r.question,
        status: r.status,
        disputeTypes: [
          r.isGrayConflict && 'gray_conflict',
          r.isSourceBroken && 'source_broken',
          r.isSensitiveLeak && 'sensitive_leak',
        ].filter(Boolean),
        reviewLogs: getLogsForRecord(r.id),
      })),
      causeSummary: causeSummary.map((c) => ({ type: c.type, label: c.label, count: c.count })),
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `质检报表_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="质检报表"
        subtitle="本周质检数据总览与争议明细分析"
        action={
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[#2a3548] hover:bg-[#344256] text-gray-300 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            导出报表
          </button>
        }
      />

      {/* Weekly Overview */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
          <PieChart className="w-4 h-4" />
          周度概览
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">本周质检总数</p>
              <p className="text-3xl font-bold text-gray-100">{total}</p>
            </div>
            <RingChart value={100} color="#64748b" />
          </div>

          <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">通过率</p>
              <p className="text-3xl font-bold text-emerald-400">{passRate.toFixed(1)}%</p>
            </div>
            <RingChart value={+passRate.toFixed(1)} color="#34d399" />
          </div>

          <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">待确认率</p>
              <p className="text-3xl font-bold text-rose-400">{pendingRate.toFixed(1)}%</p>
            </div>
            <RingChart value={+pendingRate.toFixed(1)} color="#fb7185" />
          </div>
        </div>
      </section>

      {/* Dispute Detail */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
          <ChevronRight className="w-4 h-4" />
          争议明细
        </h2>
        <div className="space-y-3">
          {disputedRecords.map((record) => {
            const isExpanded = expandedId === record.id;
            const logs = getLogsForRecord(record.id);
            const tags = DISPUTE_TYPE_TAGS.filter((t) => {
              if (t.key === 'gray_conflict') return record.isGrayConflict;
              if (t.key === 'source_broken') return record.isSourceBroken;
              if (t.key === 'sensitive_leak') return record.isSensitiveLeak;
              return false;
            });

            return (
              <div key={record.id} className="bg-[#1a2332] border border-[#2a3548] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#1e293b] transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                  )}
                  <span className="flex-1 text-sm text-gray-200 truncate">{record.question}</span>
                  <StatusBadge status={record.status} />
                  <div className="flex gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag.key}
                        className={`text-xs px-2 py-0.5 border rounded-full ${tag.color}`}
                      >
                        {REVIEW_TYPE_LABELS[tag.key]}
                      </span>
                    ))}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 pt-1 border-t border-[#2a3548]">
                    {logs.length > 0 ? (
                      <div className="space-y-3">
                        {logs.map((log) => (
                          <div key={log.id} className="bg-[#0f1724] rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>复核人：{log.reviewer}</span>
                              <span>日期：{log.reviewDate.slice(0, 10)}</span>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">复核原因</p>
                              <p className="text-sm text-gray-300">{log.reason}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">下一步建议</p>
                              <p className="text-sm text-gray-300">{log.nextStep}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic py-2">待复核</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {disputedRecords.length === 0 && (
            <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-8 text-center text-gray-500 text-sm">
              暂无争议记录
            </div>
          )}
        </div>
      </section>

      {/* Cause Analysis */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
          <BarChart3 className="w-4 h-4" />
          原因分析
        </h2>
        <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} barCategoryGap="30%">
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#2a3548' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#2a3548' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a2332',
                      border: '1px solid #2a3548',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              {causeSummary.map((c) => (
                <div key={c.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{c.label}</span>
                    <span className="text-sm font-medium text-gray-400">{c.count} 条</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{SUGGESTIONS[c.type]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
