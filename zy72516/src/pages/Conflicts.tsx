import { useState } from 'react';
import { Filter, Search, Check, X, AlertTriangle, History, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { RecordStatus, AbnormalType, StatusLabelMap, AbnormalTypeLabelMap, LogActionLabelMap, ContentSnapshot } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { AbnormalTypeBadge } from '../components/common/AbnormalTypeBadge';

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

export default function Conflicts() {
  const { records, getConflictSamples, batchUpdateStatus, updateRecordStatus, rollbackToLog } = useRecordStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');
  const [abnormalFilter, setAbnormalFilter] = useState<AbnormalType | 'all'>('all');
  const [modelOutputFilter, setModelOutputFilter] = useState<'all' | 'missing' | 'available'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLogIndex, setExpandedLogIndex] = useState<Record<string, number | null>>({});

  const conflictSamples = getConflictSamples();

  const filteredRecords = conflictSamples.filter(record => {
    const matchesSearch = record.annotatorMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.referenceUrl.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.currentStatus === statusFilter;
    const matchesAbnormal = abnormalFilter === 'all' || record.abnormalType === abnormalFilter;
    const matchesModelOutput = modelOutputFilter === 'all' ||
      (modelOutputFilter === 'missing' && record.modelOutputMissing) ||
      (modelOutputFilter === 'available' && !record.modelOutputMissing);
    return matchesSearch && matchesStatus && matchesAbnormal && matchesModelOutput;
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map(r => r.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchAction = (newStatus: RecordStatus) => {
    if (selectedIds.length === 0) return;
    batchUpdateStatus(selectedIds, newStatus, '批量操作');
    setSelectedIds([]);
  };

  const toggleLogSnapshot = (recordId: string, logIdx: number) => {
    setExpandedLogIndex(prev => ({
      ...prev,
      [recordId]: prev[recordId] === logIdx ? null : logIdx
    }));
  };

  const handleRollback = (recordId: string, logIndex: number) => {
    if (confirm(`确定要回滚到第 ${logIndex + 1} 条操作记录吗？`)) {
      rollbackToLog(recordId, logIndex);
    }
  };

  const stats = {
    total: conflictSamples.length,
    pmReview: conflictSamples.filter(r => r.currentStatus === RecordStatus.PM_REVIEW).length,
    wrongCriteria: conflictSamples.filter(r => r.currentStatus === RecordStatus.WRONG_CRITERIA).length,
    rework: conflictSamples.filter(r => r.currentStatus === RecordStatus.REWORK).length,
    url404: conflictSamples.filter(r => r.abnormalType === AbnormalType.URL_404_PASSED).length,
    missingModel: conflictSamples.filter(r => r.modelOutputMissing).length
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">冲突样本表</h1>
        <p className="text-slate-500 mt-1">异常样本汇总，产品经理复核队列</p>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500">冲突样本总数</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-5">
          <p className="text-sm text-amber-600">待产品经理复核</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{stats.pmReview}</p>
        </div>
        <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200 p-5">
          <p className="text-sm text-orange-600">错口径</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{stats.wrongCriteria}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-5">
          <p className="text-sm text-yellow-600">补录返工</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{stats.rework}</p>
        </div>
        <div className="bg-rose-50 rounded-xl shadow-sm border border-rose-200 p-5">
          <p className="text-sm text-rose-600">链接404异常</p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{stats.url404}</p>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl shadow-lg p-5 text-white">
          <p className="text-sm text-white/80">暂无模型输出</p>
          <p className="text-2xl font-bold mt-1">{stats.missingModel}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜索留言或链接..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-72 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                >
                  <option value="all">全部状态</option>
                  <option value={RecordStatus.PM_REVIEW}>待产品经理复核</option>
                  <option value={RecordStatus.WRONG_CRITERIA}>错口径</option>
                  <option value={RecordStatus.REWORK}>补录返工</option>
                </select>

                <select
                  value={abnormalFilter}
                  onChange={(e) => setAbnormalFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                >
                  <option value="all">全部异常类型</option>
                  <option value={AbnormalType.URL_404_PASSED}>引用链接404仍被判通过</option>
                  <option value={AbnormalType.WRONG_CRITERIA}>错口径</option>
                  <option value={AbnormalType.REWORK_NEEDED}>补录返工</option>
                  <option value={AbnormalType.OTHER}>其他异常</option>
                </select>

                <select
                  value={modelOutputFilter}
                  onChange={(e) => setModelOutputFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                >
                  <option value="all">全部模型输出状态</option>
                  <option value="missing">暂无模型输出</option>
                  <option value="available">有模型输出</option>
                </select>
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  已选 {selectedIds.length} 条
                </span>
                <button
                  onClick={() => handleBatchAction(RecordStatus.PASSED)}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                >
                  <Check className="w-3 h-3 inline mr-1" />
                  批量通过
                </button>
                <button
                  onClick={() => handleBatchAction(RecordStatus.REJECTED)}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
                >
                  <X className="w-3 h-3 inline mr-1" />
                  批量驳回
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredRecords.length && filteredRecords.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  行号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  标注员留言
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  模型输出
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  异常类型
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  最后操作人
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  className={record.modelOutputMissing ? 'bg-violet-50/30 hover:bg-violet-50/50' : 'hover:bg-slate-50'}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(record.id)}
                      onChange={() => handleSelect(record.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-4 text-sm font-mono text-slate-700">
                    #{record.originalLineNumber}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700 max-w-md">
                    <p className="line-clamp-2">{record.annotatorMessage}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate font-mono">
                      {record.referenceUrl}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    {record.modelOutputMissing ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-xs font-medium">
                        暂无模型输出
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 max-w-32 truncate block">
                        {record.modelOutput?.outputSnippet.slice(0, 30)}...
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={record.currentStatus} size="sm" />
                  </td>
                  <td className="px-4 py-4">
                    <AbnormalTypeBadge type={record.abnormalType} size="sm" />
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    {record.lastOperator || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500">
                    {new Date(record.updatedAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                    >
                      {expandedId === record.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRecords.length === 0 && (
            <div className="py-16 text-center">
              <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">暂无符合条件的冲突样本</p>
            </div>
          )}
        </div>

        {filteredRecords.map((record) => (
          expandedId === record.id && (
            <div key={'detail-' + record.id} className="bg-slate-50 border-t border-slate-200 px-8 py-5">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">详细信息</h4>
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">标注员留言</p>
                    <p className="text-sm text-slate-700">{record.annotatorMessage}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">引用链接</p>
                    <p className="text-sm font-mono text-slate-700 break-all">{record.referenceUrl}</p>
                    <p className={`text-xs mt-1 ${record.urlStatus ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {record.urlStatus ? '链接有效' : '链接无效 (404)'}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">机器人判断</p>
                    <p className="text-sm text-slate-700">{record.robotJudgment}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${
                    record.modelOutputMissing
                      ? 'bg-violet-50 border-violet-200'
                      : 'bg-slate-900 border-slate-800'
                  }`}>
                    <p className={`text-xs mb-1 ${record.modelOutputMissing ? 'text-violet-500' : 'text-slate-400'}`}>
                      模型输出状态
                    </p>
                    {record.modelOutputMissing ? (
                      <div>
                        <p className="text-sm font-medium text-violet-700">暂无模型输出数据</p>
                        <p className="text-xs text-violet-500 mt-1">请到质检工作台进行补录</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          {record.modelOutput?.modelName} · 置信度 {(record.modelOutput?.confidence || 0) * 100}%
                          {record.modelOutput?.isBackfill && ' · 已补录'}
                        </p>
                        <pre className="text-xs text-slate-200 whitespace-pre-wrap font-mono">
                          {record.modelOutput?.outputSnippet}
                        </pre>
                        {record.modelOutput?.filledBy && (
                          <p className="text-xs text-slate-500 mt-2">
                            补录人：{record.modelOutput.filledBy} · {new Date(record.modelOutput.filledAt || '').toLocaleString('zh-CN')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    操作日志（{record.judgmentLogs.length} 条）
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {record.judgmentLogs.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">暂无操作日志</p>
                    ) : (
                      record.judgmentLogs.map((log, logIdx) => (
                        <div key={log.id} className="p-3 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">
                              {LogActionLabelMap[log.action] || log.action}
                            </span>
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

                          {log.remark && (
                            <p className="text-xs text-slate-500 mb-2">备注：{log.remark}</p>
                          )}

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => toggleLogSnapshot(record.id, logIdx)}
                              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                            >
                              {expandedLogIndex[record.id] === logIdx ? (
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
                              <RotateCcw className="w-3 h-3" />
                              回滚到此版本
                            </button>
                          </div>

                          {expandedLogIndex[record.id] === logIdx && (
                            <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                              <SnapshotCompare from={log.fromSnapshot} to={log.toSnapshot} />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {record.currentStatus === RecordStatus.PM_REVIEW && (
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => updateRecordStatus(record.id, RecordStatus.REVIEW_PASSED, '冲突表复核通过')}
                        className="flex-1 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                      >
                        复核通过
                      </button>
                      <button
                        onClick={() => updateRecordStatus(record.id, RecordStatus.REVIEW_REJECTED, '冲突表复核驳回')}
                        className="flex-1 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700"
                      >
                        复核驳回
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
