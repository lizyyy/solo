import { useState, useMemo } from 'react';
import {
  BarChart3, PieChart, AlertTriangle, CheckCircle, XCircle,
  FileText, Download, History, Link as LinkIcon,
  FileQuestion, ArrowRight, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import {
  RecordStatus, AbnormalType, StatusLabelMap, AbnormalTypeLabelMap,
  LogActionLabelMap, ContentSnapshot, AnnotationRecord
} from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { AbnormalTypeBadge } from '../components/common/AbnormalTypeBadge';
import {
  exportDetailedReport, exportToCsv, exportToJson, defaultExportFields
} from '../utils/exportUtil';

type TabKey = 'overview' | 'consistency' | 'history' | 'traceability';

interface ConsistencyIssue {
  recordId: string;
  lineNumber: number;
  issue: string;
  type: 'status_mismatch' | 'model_output_mismatch' | 'url_404_state';
}

function SnapshotField({ label, from, to }: { label: string; from: string | undefined; to: string | undefined }) {
  const changed = from !== to;
  return (
    <div className="py-1.5 border-b border-slate-100 last:border-b-0">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className={changed ? 'bg-rose-50 text-rose-700 rounded px-1' : 'text-slate-700'}>
          {from ?? '-'}
        </span>
        <span className={changed ? 'bg-emerald-50 text-emerald-700 rounded px-1' : 'text-slate-700'}>
          {to ?? '-'}
        </span>
      </div>
    </div>
  );
}

function SnapshotCompare({ from, to }: { from?: ContentSnapshot; to?: ContentSnapshot }) {
  if (!from || !to) {
    return <p className="text-sm text-slate-400 text-center py-4">无快照数据</p>;
  }
  return (
    <div className="space-y-0.5">
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pb-1 border-b border-slate-100">
        <span>改前</span>
        <span>改后</span>
      </div>
      <SnapshotField label="状态" from={StatusLabelMap[from.status]} to={StatusLabelMap[to.status]} />
      <SnapshotField label="异常类型" from={AbnormalTypeLabelMap[from.abnormalType]} to={AbnormalTypeLabelMap[to.abnormalType]} />
      <SnapshotField label="标注员留言" from={from.annotatorMessage.slice(0, 50)} to={to.annotatorMessage.slice(0, 50)} />
      <SnapshotField label="引用链接" from={from.referenceUrl.slice(0, 40)} to={to.referenceUrl.slice(0, 40)} />
      <SnapshotField label="机器人判断" from={from.robotJudgment} to={to.robotJudgment} />
      <SnapshotField label="模型输出" from={from.modelOutputSnippet?.slice(0, 30)} to={to.modelOutputSnippet?.slice(0, 30)} />
    </div>
  );
}

const statusBarColors: Record<RecordStatus, string> = {
  [RecordStatus.PENDING]: 'bg-slate-400',
  [RecordStatus.PASSED]: 'bg-emerald-500',
  [RecordStatus.REJECTED]: 'bg-rose-500',
  [RecordStatus.REWORK]: 'bg-amber-500',
  [RecordStatus.WRONG_CRITERIA]: 'bg-orange-500',
  [RecordStatus.PM_REVIEW]: 'bg-amber-600',
  [RecordStatus.REVIEW_PASSED]: 'bg-teal-500',
  [RecordStatus.REVIEW_REJECTED]: 'bg-red-500'
};

const abnormalBarColors: Record<AbnormalType, string> = {
  [AbnormalType.NONE]: 'bg-slate-400',
  [AbnormalType.URL_404_PASSED]: 'bg-amber-500',
  [AbnormalType.WRONG_CRITERIA]: 'bg-orange-500',
  [AbnormalType.REWORK_NEEDED]: 'bg-yellow-500',
  [AbnormalType.OTHER]: 'bg-purple-500'
};

export default function Report() {
  const { records, clearAll, initMockData, rollbackToLog } = useRecordStore();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [expandedLogs, setExpandedLogs] = useState<Record<string, number | null>>({});

  const stats = useMemo(() => {
    const byStatus: Record<RecordStatus, number> = {} as Record<RecordStatus, number>;
    Object.values(RecordStatus).forEach(s => { byStatus[s] = 0; });
    const byAbnormalType: Record<AbnormalType, number> = {} as Record<AbnormalType, number>;
    Object.values(AbnormalType).forEach(t => { byAbnormalType[t] = 0; });

    records.forEach(r => {
      byStatus[r.currentStatus]++;
      byAbnormalType[r.abnormalType]++;
    });

    const modelOutputMissing = records.filter(r => r.modelOutputMissing).length;
    const url404 = records.filter(r => r.abnormalType === AbnormalType.URL_404_PASSED).length;
    const totalOps = records.reduce((sum, r) => sum + r.judgmentLogs.length, 0);
    const avgOperations = records.length > 0 ? totalOps / records.length : 0;
    const passedCount = records.filter(r =>
      r.currentStatus === RecordStatus.PASSED || r.currentStatus === RecordStatus.REVIEW_PASSED
    ).length;
    const passRate = records.length > 0 ? (passedCount / records.length) * 100 : 0;

    return { total: records.length, byStatus, byAbnormalType, modelOutputMissing, url404, avgOperations, passRate };
  }, [records]);

  const alignmentCheck = useMemo(() => {
    const issues: ConsistencyIssue[] = [];

    records.forEach(record => {
      const lastLog = record.judgmentLogs[record.judgmentLogs.length - 1];
      if (lastLog?.toSnapshot && lastLog.toSnapshot.status !== record.currentStatus) {
        issues.push({
          recordId: record.id,
          lineNumber: record.originalLineNumber,
          issue: `最后日志状态为${StatusLabelMap[lastLog.toSnapshot.status]}，但当前状态为${StatusLabelMap[record.currentStatus]}`,
          type: 'status_mismatch'
        });
      }

      if (record.originalSnapshot.modelOutputSnippet && record.modelOutputMissing) {
        issues.push({
          recordId: record.id,
          lineNumber: record.originalLineNumber,
          issue: '原始快照有模型输出但当前标记为缺失',
          type: 'model_output_mismatch'
        });
      }

      if (record.abnormalType === AbnormalType.URL_404_PASSED) {
        const reviewStatuses: RecordStatus[] = [RecordStatus.PM_REVIEW, RecordStatus.REVIEW_PASSED, RecordStatus.REVIEW_REJECTED];
        if (!reviewStatuses.includes(record.currentStatus)) {
          issues.push({
            recordId: record.id,
            lineNumber: record.originalLineNumber,
            issue: `链接404异常但状态为${StatusLabelMap[record.currentStatus]}，应进入复核流程`,
            type: 'url_404_state'
          });
        }
      }
    });

    const totalChecks = records.length * 3;
    const passedChecks = totalChecks - issues.length;
    const passRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;

    return { totalChecks, passedChecks, issues, passRate };
  }, [records]);

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？此操作不可恢复。')) {
      clearAll();
      initMockData();
    }
  };

  const toggleRecord = (id: string) => {
    setExpandedRecords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLogSnapshot = (recordId: string, logIdx: number) => {
    setExpandedLogs(prev => ({
      ...prev,
      [recordId]: prev[recordId] === logIdx ? null : logIdx
    }));
  };

  const handleRollback = (recordId: string, logIndex: number) => {
    if (confirm(`确定要回滚到第 ${logIndex + 1} 条操作记录吗？`)) {
      rollbackToLog(recordId, logIndex);
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: '总览' },
    { key: 'consistency', label: '数据一致性核对' },
    { key: 'history', label: '改前改后历史' },
    { key: 'traceability', label: '原始材料追溯' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">复盘报告</h1>
          <p className="text-slate-500 mt-1">核对暂无模型输出数据、导出明细、改前改后历史和最终复盘</p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-100 border border-rose-200"
        >
          <RefreshCw className="w-4 h-4" />
          重置数据
        </button>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <p className="text-sm text-slate-500">总记录数</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>

        <div className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <p className="text-sm text-emerald-600">通过率</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{stats.passRate.toFixed(1)}%</p>
        </div>

        <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-sm text-amber-600">待产品经理复核</p>
          </div>
          <p className="text-2xl font-bold text-amber-700">{stats.byStatus[RecordStatus.PM_REVIEW]}</p>
        </div>

        <div className="bg-rose-50 rounded-xl shadow-sm border border-rose-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <LinkIcon className="w-4 h-4 text-rose-500" />
            <p className="text-sm text-rose-600">链接404异常</p>
          </div>
          <p className="text-2xl font-bold text-rose-700">{stats.url404}</p>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <FileQuestion className="w-4 h-4 text-white/80" />
            <p className="text-sm text-white/80">暂无模型输出</p>
          </div>
          <p className="text-2xl font-bold">{stats.modelOutputMissing}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <History className="w-4 h-4 text-slate-400" />
            <p className="text-sm text-slate-500">平均操作次数</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.avgOperations.toFixed(1)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                状态分布
              </h3>
              <div className="space-y-3">
                {(Object.entries(StatusLabelMap) as [RecordStatus, string][]).map(([status, label]) => {
                  const count = stats.byStatus[status];
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{label}</span>
                        <span className="font-medium text-slate-900">{count}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${statusBarColors[status]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                异常类型分布
              </h3>
              <div className="space-y-3">
                {(Object.entries(AbnormalTypeLabelMap) as [AbnormalType, string][]).map(([type, label]) => {
                  const count = stats.byAbnormalType[type];
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-600">{label}</span>
                        <span className="font-medium text-slate-900">{count}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${abnormalBarColors[type]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
              <h3 className="text-sm font-semibold text-amber-800 mb-4 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                404专项复核
              </h3>
              {records.filter(r => r.abnormalType === AbnormalType.URL_404_PASSED).length === 0 ? (
                <p className="text-sm text-amber-600">暂无404异常记录</p>
              ) : (
                <div className="space-y-2">
                  {records.filter(r => r.abnormalType === AbnormalType.URL_404_PASSED).map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-200">
                      <div>
                        <p className="text-sm font-medium text-slate-700">#{r.originalLineNumber}</p>
                        <p className="text-xs text-slate-500 truncate max-w-xs">{r.referenceUrl}</p>
                      </div>
                      <StatusBadge status={r.currentStatus} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-violet-50 rounded-xl border border-violet-200 p-6">
              <h3 className="text-sm font-semibold text-violet-800 mb-4 flex items-center gap-2">
                <FileQuestion className="w-4 h-4" />
                暂无模型输出补录进度
              </h3>
              <div className="mb-3">
                <span className="text-sm text-violet-600">
                  已补录 {records.filter(r => !r.modelOutputMissing && r.modelOutput?.isBackfill).length} / 总数 {stats.modelOutputMissing + records.filter(r => !r.modelOutputMissing && r.modelOutput?.isBackfill).length}
                </span>
              </div>
              {records.filter(r => r.modelOutputMissing).length === 0 ? (
                <p className="text-sm text-violet-600">所有记录均已补录模型输出</p>
              ) : (
                <div className="space-y-2">
                  {records.filter(r => r.modelOutputMissing).map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-violet-200">
                      <div>
                        <p className="text-sm font-medium text-slate-700">#{r.originalLineNumber}</p>
                        <p className="text-xs text-slate-500 truncate max-w-xs">{r.annotatorMessage.slice(0, 40)}</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-xs font-medium">
                        待补录
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'consistency' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-sm text-slate-500">总核对项</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{alignmentCheck.totalChecks}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-200 p-5">
              <p className="text-sm text-emerald-600">通过项</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{alignmentCheck.passedChecks}</p>
            </div>
            <div className="bg-rose-50 rounded-xl shadow-sm border border-rose-200 p-5">
              <p className="text-sm text-rose-600">问题项</p>
              <p className="text-2xl font-bold text-rose-700 mt-1">{alignmentCheck.issues.length}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">一致率</h3>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${alignmentCheck.passRate}%` }}
              />
            </div>
            <p className="text-sm text-slate-500 mt-2">{alignmentCheck.passRate.toFixed(1)}%</p>
          </div>

          {alignmentCheck.issues.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">问题列表</h3>
              {alignmentCheck.issues.map((issue, idx) => (
                <div key={idx} className="bg-rose-50 rounded-lg border border-rose-200 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <span className="text-sm font-medium text-rose-800">行 #{issue.lineNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                      {issue.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-rose-700">{issue.issue}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">数据源说明</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                单一数据源：所有状态与快照均存储于 Zustand 状态管理，确保数据一致性
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                状态与快照核对：每次操作均记录改前/改后快照，可追溯任意时间点数据
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                原始材料保留：每条记录保留原始导入时的完整快照，不可篡改
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                本地持久化：数据通过 localStorage 持久化，页面刷新不丢失
              </li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {records.slice(0, 20).map(record => {
            const isExpanded = expandedRecords.has(record.id);
            return (
              <div key={record.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button
                  onClick={() => toggleRecord(record.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-sm font-mono text-slate-700">#{record.originalLineNumber}</span>
                    <span className="text-sm text-slate-600 truncate max-w-md">
                      {record.annotatorMessage.slice(0, 50)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={record.currentStatus} size="sm" />
                    <span className="text-xs text-slate-400">{record.judgmentLogs.length} 条操作</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {record.judgmentLogs.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">暂无操作日志</p>
                      ) : (
                        record.judgmentLogs.map((log, logIdx) => (
                          <div key={log.id} className="bg-white rounded-lg border border-slate-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className="text-sm font-medium text-slate-700">
                                  {LogActionLabelMap[log.action] || log.action}
                                </span>
                              </div>
                              <span className="text-xs text-slate-400">
                                {new Date(log.operatedAt).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mb-2">操作人：{log.operator}</p>

                            {log.diffSummary && log.diffSummary.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {log.diffSummary.map((d, idx) => (
                                  <span key={idx} className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                                    {d}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => toggleLogSnapshot(record.id, logIdx)}
                                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                              >
                                {expandedLogs[record.id] === logIdx ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                                改前/改后快照
                              </button>
                              <button
                                onClick={() => handleRollback(record.id, logIdx)}
                                className="ml-auto text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                回滚到此版本
                              </button>
                            </div>

                            {expandedLogs[record.id] === logIdx && (
                              <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                                <SnapshotCompare from={log.fromSnapshot} to={log.toSnapshot} />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'traceability' && (
        <div className="space-y-6">
          <div className="flex gap-3">
            <button
              onClick={() => exportToCsv(records, defaultExportFields)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </button>
            <button
              onClick={() => exportToJson(records)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileText className="w-4 h-4" />
              导出JSON
            </button>
            <button
              onClick={() => exportDetailedReport(records)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
            >
              <FileText className="w-4 h-4" />
              导出复盘报告
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">行号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">原始标注员留言</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">原始引用链接</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">原始链接状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">原始模型输出</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">当前状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作次数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">#{record.originalLineNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{record.originalSnapshot.annotatorMessage}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 max-w-xs truncate">{record.originalSnapshot.referenceUrl}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${record.originalSnapshot.urlStatus ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {record.originalSnapshot.urlStatus ? '有效' : '无效(404)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                        {record.originalSnapshot.modelOutputSnippet || '暂无'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={record.currentStatus} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{record.judgmentLogs.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">原始材料说明</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                原始材料为首次导入时记录的完整快照，包含所有字段的初始值
              </li>
              <li className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                后续任何修改均不会影响原始快照数据，确保可追溯性
              </li>
              <li className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                导出数据包含完整的改前改后历史，可用于离线审计
              </li>
              <li className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                原始模型输出字段保留首次导入时的值，补录操作会记录在操作日志中
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
