import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ChevronDown, ChevronUp, BarChart3, Settings as SettingsIcon, AlertTriangle, Users, FileText, Activity, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useStore } from '@/store';
import AnomalyAlert from '@/components/AnomalyAlert';
import HitResultCard from '@/components/HitResultCard';
import Skeleton from '@/components/Skeleton';
import type { HitResult } from '../../shared/types';
import { HIT_REASON_LABELS, TIER_LABELS, REPORT_STATUS_COLORS, REPORT_STATUS_LABELS } from '../../shared/types';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-dark-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary-light" />
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {isOpen && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reports = useStore((state) => state.reports);
  const fetchReport = useStore((state) => state.fetchReport);
  const exportReport = useStore((state) => state.exportReport);
  const loading = useStore((state) => state.loading[`report:${id}`]);
  const exportLoading = useStore((state) => state.loading[`exportReport:${id}`]);
  const error = useStore((state) => state.error);

  const report = reports.find((r) => r.id === id);

  useEffect(() => {
    if (id) {
      fetchReport(id);
    }
  }, [id, fetchReport]);

  const handleExport = async (format: 'csv' | 'json') => {
    if (id) {
      await exportReport(id, format);
    }
  };

  const hitReasonAnalysis = report?.hitResults.reduce((acc, hit) => {
    acc[hit.hitReason] = (acc[hit.hitReason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const hitReasonData = Object.entries(hitReasonAnalysis).map(([reason, count]) => ({
    name: HIT_REASON_LABELS[reason as keyof typeof HIT_REASON_LABELS] || reason,
    value: count,
  }));

  const tierAnalysis = report?.hitResults.reduce((acc, hit) => {
    acc[hit.customerTier] = (acc[hit.customerTier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const COLORS = ['#DC2626', '#F59E0B', '#2563EB', '#6B7280'];

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-400">报告不存在</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/reports')}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{report.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: `${REPORT_STATUS_COLORS[report.status]}20`,
                color: REPORT_STATUS_COLORS[report.status],
              }}
            >
              {REPORT_STATUS_LABELS[report.status]}
            </span>
            <span className="text-sm text-slate-400">
              {report.ruleName} (v{report.ruleVersion})
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-slate-400 text-xs">总请求</p>
              <p className="text-xl font-bold text-white">
                {report.totalRequests.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-slate-400 text-xs">命中数</p>
              <p className="text-xl font-bold text-white">
                {report.hitCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-danger/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-slate-400 text-xs">拦截客户</p>
              <p className="text-xl font-bold text-white">
                {report.blockedCustomers.length}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-slate-400 text-xs">异常数</p>
              <p className="text-xl font-bold text-white">
                {report.anomalies.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleSection title="演练配置" icon={SettingsIcon}>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex justify-between py-2 border-b border-dark-200">
            <span className="text-slate-400">规则名称</span>
            <span className="text-white">{report.ruleName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-dark-200">
            <span className="text-slate-400">规则版本</span>
            <span className="text-white">v{report.ruleVersion}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-dark-200">
            <span className="text-slate-400">开始时间</span>
            <span className="text-white">
              {new Date(report.startTime).toLocaleString('zh-CN')}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-dark-200">
            <span className="text-slate-400">结束时间</span>
            <span className="text-white">
              {new Date(report.endTime).toLocaleString('zh-CN')}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-dark-200">
            <span className="text-slate-400">采样率</span>
            <span className="text-white">{report.sampleRate}%</span>
          </div>
          <div className="flex justify-between py-2 border-b border-dark-200">
            <span className="text-slate-400">创建时间</span>
            <span className="text-white">
              {new Date(report.createdAt).toLocaleString('zh-CN')}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="命中分析" icon={BarChart3}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-white mb-4">按命中原因分布</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hitReasonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                    <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-4">按客户层级分布</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(tierAnalysis).map(([tier, count]) => ({
                        name: TIER_LABELS[tier as keyof typeof TIER_LABELS],
                        value: count,
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {Object.entries(tierAnalysis).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-white mb-4">命中结果列表</h4>
            {report.hitResults.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                暂无命中数据
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {report.hitResults.slice(0, 10).map((hit: HitResult) => (
                  <HitResultCard key={hit.id} hit={hit} />
                ))}
                {report.hitResults.length > 10 && (
                  <p className="text-center text-sm text-slate-400 py-2">
                    仅展示前 10 条，共 {report.hitResults.length} 条命中结果
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="异常检测" icon={AlertTriangle}>
        {report.anomalies.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            本次演练未检测到异常
          </div>
        ) : (
          <div className="space-y-3">
            {report.anomalies.map((anomaly) => (
              <AnomalyAlert key={anomaly.id} anomaly={anomaly} />
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="受影响客户" icon={Users}>
        {report.blockedCustomers.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            本次演练没有拦截到客户
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    客户ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                    命中次数
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-200">
                {report.blockedCustomers.map((customerId) => {
                  const customerHits = report.hitResults.filter(
                    (h) => h.customerId === customerId
                  );
                  return (
                    <tr key={customerId} className="hover:bg-dark-100/50">
                      <td className="px-4 py-3 text-sm text-white">
                        {customerId}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {customerHits.length} 次
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="处理结论" icon={FileText}>
        <p className="text-slate-300 whitespace-pre-wrap">
          {report.conclusion || '暂无处理结论'}
        </p>
      </CollapsibleSection>

      <div className="fixed bottom-6 right-6 flex gap-2">
        <button
          onClick={() => handleExport('csv')}
          disabled={exportLoading || report.status !== 'completed'}
          className="px-4 py-2.5 rounded-lg bg-dark-200 text-white hover:bg-dark-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg"
        >
          <Download className="w-4 h-4" />
          导出 CSV
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={exportLoading || report.status !== 'completed'}
          className="px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg"
        >
          <Download className="w-4 h-4" />
          导出 JSON
        </button>
      </div>
    </div>
  );
}
