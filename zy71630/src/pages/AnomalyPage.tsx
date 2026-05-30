import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { AlertTriangle, CheckCircle, Filter, X, Clock, RefreshCw, FileText } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getAnomalyTypeLabel, getSeverityLabel, getAnomalyTypeColor } from '@/utils/anomalyDetector';
import { cn } from '@/lib/utils';
import type { AnomalyType } from '@/types';

export default function AnomalyPage() {
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'resolved' | 'unresolved'>('unresolved');

  const anomalies = useAppStore((state) => state.anomalies);
  const loans = useAppStore((state) => state.loans);
  const resolveAnomaly = useAppStore((state) => state.resolveAnomaly);
  const industryTags = useAppStore((state) => state.industryTags);

  const filteredAnomalies = anomalies.filter((a) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter === 'resolved' && !a.resolved) return false;
    if (statusFilter === 'unresolved' && a.resolved) return false;
    return true;
  });

  const stats = {
    total: anomalies.length,
    unresolved: anomalies.filter((a) => !a.resolved).length,
    resolved: anomalies.filter((a) => a.resolved).length,
    byType: {
      maturity_mismatch: anomalies.filter((a) => a.type === 'maturity_mismatch' && !a.resolved).length,
      guarantee_repeat: anomalies.filter((a) => a.type === 'guarantee_repeat' && !a.resolved).length,
      rating_override: anomalies.filter((a) => a.type === 'rating_override' && !a.resolved).length,
    },
    highSeverity: anomalies.filter((a) => a.severity === 3 && !a.resolved).length,
  };

  const handleResolve = (id: string) => {
    let confirmed = true;
    if (typeof window !== 'undefined' && window.confirm) {
      try {
        confirmed = window.confirm('确认标记该异常为已解决？此操作将记录到审计日志。');
      } catch {
        confirmed = true;
      }
    }
    if (confirmed) {
      resolveAnomaly(id);
    }
  };

  const anomalyTypes: { value: AnomalyType | 'all'; label: string; color: string }[] = [
    { value: 'all', label: '全部类型', color: '#06B6D4' },
    { value: 'maturity_mismatch', label: '到期桶错位', color: getAnomalyTypeColor('maturity_mismatch') },
    { value: 'guarantee_repeat', label: '担保重复', color: getAnomalyTypeColor('guarantee_repeat') },
    { value: 'rating_override', label: '风险等级覆盖', color: getAnomalyTypeColor('rating_override') },
  ];

  const severities = [
    { value: 'all', label: '全部级别' },
    { value: 3, label: '高' },
    { value: 2, label: '中' },
    { value: 1, label: '低' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <Navbar />
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">异常检测中心</h1>
              <p className="text-sm text-slate-400 mt-1">
                自动检测到期桶错位、担保重复、风险等级覆盖等数据异常
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl font-bold text-red-400">{stats.unresolved}</div>
                <div className="text-xs text-slate-400">待处理异常</div>
              </div>
              <div className="h-12 w-px bg-slate-700" />
              <div className="text-right">
                <div className="text-3xl font-bold text-green-400">{stats.resolved}</div>
                <div className="text-xs text-slate-400">已解决</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              title="高风险异常"
              value={stats.highSeverity}
              color="red"
              icon={<AlertTriangle className="w-5 h-5" />}
            />
            <StatCard
              title="到期桶错位"
              value={stats.byType.maturity_mismatch}
              color="amber"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              title="担保重复"
              value={stats.byType.guarantee_repeat}
              color="red"
              icon={<RefreshCw className="w-5 h-5" />}
            />
            <StatCard
              title="风险等级覆盖"
              value={stats.byType.rating_override}
              color="purple"
              icon={<FileText className="w-5 h-5" />}
            />
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mb-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">筛选:</span>
              </div>

              <div className="flex gap-1">
                {anomalyTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setTypeFilter(type.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5',
                      typeFilter === type.value
                        ? 'text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    )}
                    style={{
                      backgroundColor: typeFilter === type.value ? type.color + '30' : undefined,
                      borderColor: typeFilter === type.value ? type.color : undefined,
                      border: typeFilter === type.value ? '1px solid' : '1px solid transparent',
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    {type.label}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-slate-700" />

              <div className="flex gap-1">
                {severities.map((sev) => (
                  <button
                    key={sev.value}
                    onClick={() => setSeverityFilter(sev.value as any)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm transition-all',
                      severityFilter === sev.value
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
                    )}
                  >
                    {sev.label}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-slate-700" />

              <div className="flex gap-1">
                {[
                  { value: 'unresolved', label: '未解决' },
                  { value: 'resolved', label: '已解决' },
                  { value: 'all', label: '全部' },
                ].map((status) => (
                  <button
                    key={status.value}
                    onClick={() => setStatusFilter(status.value as any)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm transition-all',
                      statusFilter === status.value
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
                    )}
                  >
                    {status.label}
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              <div className="text-sm text-slate-400">
                显示 <span className="text-cyan-400 font-mono">{filteredAnomalies.length}</span> 条
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/80">
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">类型</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">严重程度</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">客户</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">行业</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">异常描述</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">状态</th>
                    <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredAnomalies.map((anomaly) => {
                    const loan = loans.find((l) => l.id === anomaly.loanId);
                    const industryName = industryTags.find(
                      (i) => i.code === loan?.industryCode
                    )?.name;

                    return (
                      <tr
                        key={anomaly.id}
                        className={cn(
                          'hover:bg-slate-700/30 transition-colors',
                          anomaly.resolved && 'opacity-60'
                        )}
                      >
                        <td className="px-4 py-4">
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                            style={{
                              backgroundColor: getAnomalyTypeColor(anomaly.type) + '20',
                              color: getAnomalyTypeColor(anomaly.type),
                            }}
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: getAnomalyTypeColor(anomaly.type) }}
                            />
                            {getAnomalyTypeLabel(anomaly.type)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                              anomaly.severity === 3
                                ? 'bg-red-500/20 text-red-400'
                                : anomaly.severity === 2
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            )}
                          >
                            {getSeverityLabel(anomaly.severity)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-white">{loan?.customerName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{loan?.loanNo}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-300">{industryName}</td>
                        <td className="px-4 py-4 max-w-md">
                          <p className="text-sm text-slate-300 line-clamp-2">{anomaly.description}</p>
                        </td>
                        <td className="px-4 py-4">
                          {anomaly.resolved ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle className="w-3.5 h-3.5" />
                              已解决
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              待处理
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {!anomaly.resolved && (
                            <button
                              onClick={() => handleResolve(anomaly.id)}
                              className="text-xs px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              标记解决
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredAnomalies.length === 0 && (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-700/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <div className="text-lg text-slate-300 mb-1">暂无异常数据</div>
                <div className="text-sm text-slate-500">当前筛选条件下没有异常记录</div>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-amber-400 mb-1">异常标记保留说明</div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  系统会自动检测三类数据异常：到期桶错位（实际到期日与分类桶偏差超过15天）、担保重复（同一担保人为多笔贷款担保且敞口超过限额）、风险等级覆盖（人工干预调整风险评级）。
                  所有异常标记在筛选、导出、视图切换时始终可见，不会丢失。标记为已解决的异常会保留历史记录，供审计追溯。
                </div>
              </div>
              <button className="ml-auto text-xs text-slate-400 hover:text-white flex items-center gap-1">
                <X className="w-3.5 h-3.5" />
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
  icon,
}: {
  title: string;
  value: number;
  color: 'red' | 'amber' | 'green' | 'cyan' | 'purple';
  icon: React.ReactNode;
}) {
  const colorClasses: Record<string, string> = {
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{title}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
