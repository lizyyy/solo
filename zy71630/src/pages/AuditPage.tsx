import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { History, GitCompare, Clock, User, FileText, AlertTriangle, CheckCircle, Shield, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

export default function AuditPage() {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);
  const [view, setView] = useState<'logs' | 'compare'>('logs');

  const auditLogs = useAppStore((state) => state.auditLogs);
  const snapshots = useAppStore((state) => state.snapshots);
  const loans = useAppStore((state) => state.loans);
  const reports = useAppStore((state) => state.reports);

  const sortedLogs = [...auditLogs].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );

  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId);
  const compareSnapshot = snapshots.find((s) => s.id === compareSnapshotId);

  const handleCompare = () => {
    if (selectedSnapshotId && compareSnapshotId) {
      setView('compare');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getFieldLabel = (fieldName: string): string => {
    const labels: Record<string, string> = {
      riskRatingCode: '风险评级',
      'report.adjustedValue': '修正值',
      'report.conclusion': '最终结论',
    };
    return labels[fieldName] || fieldName;
  };

  const renderDiff = (oldVal: string, newVal: string) => {
    const isDifferent = oldVal !== newVal;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-12">旧值:</span>
          <span className={cn(
            'text-sm flex-1 p-2 rounded',
            isDifferent ? 'bg-red-500/10 text-red-300 line-through' : 'text-slate-300 bg-slate-700/30'
          )}>
            {oldVal || '-'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-12">新值:</span>
          <span className={cn(
            'text-sm flex-1 p-2 rounded',
            isDifferent ? 'bg-green-500/10 text-green-300' : 'text-slate-300 bg-slate-700/30'
          )}>
            {newVal || '-'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <Navbar />
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">审计追踪中心</h1>
              <p className="text-sm text-slate-400 mt-1">
                版本快照对比、数据变更历史、防覆盖验证
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('logs')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2',
                  view === 'logs'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white border border-transparent'
                )}
              >
                <Clock className="w-4 h-4" />
                变更日志
              </button>
              <button
                onClick={() => setView('compare')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2',
                  view === 'compare'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white border border-transparent'
                )}
              >
                <GitCompare className="w-4 h-4" />
                版本对比
              </button>
            </div>
          </div>

          {view === 'logs' && (
            <>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={<History className="w-5 h-5" />}
                  label="总变更次数"
                  value={auditLogs.length}
                  color="cyan"
                />
                <StatCard
                  icon={<FileText className="w-5 h-5" />}
                  label="评级调整"
                  value={auditLogs.filter((l) => l.fieldName === 'riskRatingCode').length}
                  color="amber"
                />
                <StatCard
                  icon={<GitCompare className="w-5 h-5" />}
                  label="结论修改"
                  value={auditLogs.filter((l) => l.fieldName === 'report.conclusion').length}
                  color="purple"
                />
                <StatCard
                  icon={<Shield className="w-5 h-5" />}
                  label="覆盖保护"
                  value={auditLogs.filter((l) => l.oldValue && l.newValue && l.oldValue !== l.newValue).length}
                  color="green"
                />
              </div>

              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="p-4 border-b border-slate-700/50 bg-slate-800/50">
                  <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    数据变更日志
                  </h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {sortedLogs.length === 0 ? (
                    <div className="py-16 text-center">
                      <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <div className="text-slate-400">暂无变更记录</div>
                      <div className="text-sm text-slate-500 mt-1">修改数据后会在此处显示变更历史</div>
                    </div>
                  ) : (
                    sortedLogs.map((log) => {
                      const loan = loans.find((l) => l.id === log.loanId);
                      const isConclusionChange = log.fieldName === 'report.conclusion';
                      const hasOldConclusion = !!log.oldValue;

                      return (
                        <div
                          key={log.id}
                          className={cn(
                            'p-4 hover:bg-slate-700/20 transition-colors',
                            isConclusionChange && hasOldConclusion && 'bg-amber-500/5'
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center',
                                log.fieldName === 'riskRatingCode'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : log.fieldName === 'report.conclusion'
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-cyan-500/20 text-cyan-400'
                              )}>
                                {log.fieldName === 'riskRatingCode' ? (
                                  <AlertTriangle className="w-4 h-4" />
                                ) : log.fieldName === 'report.conclusion' ? (
                                  <FileText className="w-4 h-4" />
                                ) : (
                                  <GitCompare className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm text-white">
                                  <span className="font-medium">{loan?.customerName || '未知客户'}</span>
                                  <span className="text-slate-500 mx-2">·</span>
                                  <span className="text-cyan-400">{getFieldLabel(log.fieldName)}</span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                  <User className="w-3 h-3" />
                                  {log.changedBy}
                                  <Clock className="w-3 h-3 ml-2" />
                                  {formatDate(log.changedAt)}
                                </div>
                              </div>
                            </div>
                            {isConclusionChange && hasOldConclusion && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                                <Shield className="w-3.5 h-3.5" />
                                防覆盖记录
                              </div>
                            )}
                          </div>
                          {renderDiff(log.oldValue, log.newValue)}
                          {log.changeReason && (
                            <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
                              <div className="text-xs text-slate-400 mb-1">变更原因:</div>
                              <div className="text-sm text-slate-300">{log.changeReason}</div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {view === 'compare' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <SnapshotSelector
                  title="选择基准版本"
                  snapshots={sortedSnapshots}
                  selectedId={selectedSnapshotId}
                  onSelect={setSelectedSnapshotId}
                  compareId={compareSnapshotId}
                />
                <SnapshotSelector
                  title="选择对比版本"
                  snapshots={sortedSnapshots}
                  selectedId={compareSnapshotId}
                  onSelect={setCompareSnapshotId}
                  compareId={selectedSnapshotId}
                />
              </div>

              {selectedSnapshot && compareSnapshot && (
                <button
                  onClick={handleCompare}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
                >
                  <GitCompare className="w-5 h-5" />
                  开始对比分析
                </button>
              )}

              {selectedSnapshot && compareSnapshot && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-cyan-500/30">
                      <h3 className="text-sm font-medium text-cyan-400 mb-3">
                        {selectedSnapshot.name}
                      </h3>
                      <div className="text-xs text-slate-400 mb-3">
                        {formatDate(selectedSnapshot.createdAt)} · {selectedSnapshot.createdBy}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-slate-500 text-xs">贷款笔数</div>
                          <div className="text-white font-mono">
                            {selectedSnapshot.data.loans.length}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">总敞口</div>
                          <div className="text-cyan-400 font-mono">
                            {(selectedSnapshot.data.loans.reduce((s, l) => s + l.principal, 0) / 100000000).toFixed(2)}亿
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">异常数</div>
                          <div className="text-amber-400 font-mono">
                            {selectedSnapshot.data.anomalies.filter((a) => !a.resolved).length}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">报告数</div>
                          <div className="text-white font-mono">
                            {selectedSnapshot.data.reports.length}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-purple-500/30">
                      <h3 className="text-sm font-medium text-purple-400 mb-3">
                        {compareSnapshot.name}
                      </h3>
                      <div className="text-xs text-slate-400 mb-3">
                        {formatDate(compareSnapshot.createdAt)} · {compareSnapshot.createdBy}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-slate-500 text-xs">贷款笔数</div>
                          <div className="text-white font-mono">
                            {compareSnapshot.data.loans.length}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">总敞口</div>
                          <div className="text-purple-400 font-mono">
                            {(compareSnapshot.data.loans.reduce((s, l) => s + l.principal, 0) / 100000000).toFixed(2)}亿
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">异常数</div>
                          <div className="text-amber-400 font-mono">
                            {compareSnapshot.data.anomalies.filter((a) => !a.resolved).length}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">报告数</div>
                          <div className="text-white font-mono">
                            {compareSnapshot.data.reports.length}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedSnapshot && compareSnapshot && (
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-medium text-slate-200">差异分析</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <DiffRow
                      label="贷款笔数变化"
                      oldValue={selectedSnapshot.data.loans.length}
                      newValue={compareSnapshot.data.loans.length}
                      format="number"
                    />
                    <DiffRow
                      label="总敞口变化"
                      oldValue={selectedSnapshot.data.loans.reduce((s, l) => s + l.principal, 0)}
                      newValue={compareSnapshot.data.loans.reduce((s, l) => s + l.principal, 0)}
                      format="currency"
                    />
                    <DiffRow
                      label="未解决异常变化"
                      oldValue={selectedSnapshot.data.anomalies.filter((a) => !a.resolved).length}
                      newValue={compareSnapshot.data.anomalies.filter((a) => !a.resolved).length}
                      format="number"
                    />
                    <DiffRow
                      label="风险报告数量"
                      oldValue={selectedSnapshot.data.reports.length}
                      newValue={compareSnapshot.data.reports.length}
                      format="number"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-green-500/20">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-green-400 mb-1">防覆盖机制说明</div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  系统内置多重防覆盖保护：1) 原始值一旦录入即不可篡改；2) 修改已有结论时自动弹窗确认，旧结论完整保留在审计日志中；
                  3) 所有数据变更强制填写变更原因；4) 每次修改自动记录操作人、时间、前后值对比；5) 定期创建快照保留历史版本。
                  审计人员可通过变更日志完整追溯每一次数据修改，防止旧结论被恶意或误操作覆盖。
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'cyan' | 'amber' | 'green' | 'purple';
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

function SnapshotSelector({
  title,
  snapshots,
  selectedId,
  onSelect,
  compareId,
}: {
  title: string;
  snapshots: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  compareId: string | null;
}) {
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/50">
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {snapshots.map((snapshot) => (
          <button
            key={snapshot.id}
            onClick={() => onSelect(snapshot.id)}
            disabled={snapshot.id === compareId}
            className={cn(
              'w-full p-4 text-left border-b border-slate-700/30 last:border-0 transition-all',
              selectedId === snapshot.id
                ? 'bg-cyan-500/15'
                : snapshot.id === compareId
                ? 'opacity-50 cursor-not-allowed bg-slate-700/10'
                : 'hover:bg-slate-700/30'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className={cn(
                  'text-sm font-medium',
                  selectedId === snapshot.id ? 'text-cyan-300' : 'text-white'
                )}>
                  {snapshot.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(snapshot.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
              {selectedId === snapshot.id && (
                <CheckCircle className="w-5 h-5 text-cyan-400" />
              )}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-slate-400">
              <span>{snapshot.data.loans.length}笔贷款</span>
              <span>{snapshot.data.anomalies.length}个异常</span>
              <span>{snapshot.createdBy}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DiffRow({
  label,
  oldValue,
  newValue,
  format,
}: {
  label: string;
  oldValue: number;
  newValue: number;
  format: 'number' | 'currency';
}) {
  const diff = newValue - oldValue;
  const diffPercent = oldValue > 0 ? (diff / oldValue) * 100 : 0;
  const hasDiff = diff !== 0;

  const formatValue = (val: number) => {
    if (format === 'currency') {
      return `${(val / 100000000).toFixed(4)}亿`;
    }
    return val.toString();
  };

  return (
    <div className={`p-3 rounded-lg ${hasDiff ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-slate-700/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-300">{label}</span>
        {hasDiff && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-mono',
            diff > 0
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          )}>
            {diff > 0 ? '+' : ''}
            {format === 'currency' ? `${(diff / 100000000).toFixed(4)}亿` : diff}
            <span className="opacity-60 ml-1">
              ({diff > 0 ? '+' : ''}{diffPercent.toFixed(1)}%)
            </span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 p-2 bg-slate-800/50 rounded text-sm text-slate-300 font-mono">
          {formatValue(oldValue)}
        </div>
        <ArrowRight className={cn(
          'w-4 h-4 flex-shrink-0',
          hasDiff ? 'text-amber-400' : 'text-slate-600'
        )} />
        <div className={cn(
          'flex-1 p-2 rounded text-sm font-mono',
          hasDiff
            ? diff > 0
              ? 'bg-green-500/10 text-green-300'
              : 'bg-red-500/10 text-red-300'
            : 'bg-slate-800/50 text-slate-300'
        )}>
          {formatValue(newValue)}
        </div>
      </div>
    </div>
  );
}
