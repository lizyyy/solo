import os

content = r"""import { useState } from 'react';
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

function SnapshotDiff({ from, to }: { from: ContentSnapshot; to: ContentSnapshot }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <span className="text-xs font-medium text-rose-600 text-center">改前</span>
        <span className="text-xs font-medium text-emerald-600 text-center">改后</span>
      </div>
      <SnapshotField label="标注员留言" from={from.annotatorMessage} to={to.annotatorMessage} />
      <SnapshotField label="引用链接" from={from.referenceUrl} to={to.referenceUrl} />
      <SnapshotField label="链接状态" from={from.urlStatus ? '正常' : '异常'} to={to.urlStatus ? '正常' : '异常'} />
      <SnapshotField label="机器人判断" from={from.robotJudgment} to={to.robotJudgment} />
      <SnapshotField label="模型输出片段" from={from.modelOutputSnippet} to={to.modelOutputSnippet} />
      <SnapshotField label="模型名称" from={from.modelOutputName} to={to.modelOutputName} />
      <SnapshotField label="模型置信度" from={from.modelOutputConfidence?.toFixed(2)} to={to.modelOutputConfidence?.toFixed(2)} />
      <SnapshotField label="状态" from={StatusLabelMap[from.status]} to={StatusLabelMap[to.status]} />
      <SnapshotField label="异常类型" from={AbnormalTypeLabelMap[from.abnormalType]} to={AbnormalTypeLabelMap[to.abnormalType]} />
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
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const conflictSamples = getConflictSamples();

  const filteredRecords = conflictSamples.filter(record => {
    const matchesSearch = record.annotatorMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.referenceUrl.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.currentStatus === statusFilter;
    const matchesAbnormal = abnormalFilter === 'all' || record.abnormalType === abnormalFilter;
    const matchesModelOutput =
      modelOutputFilter === 'all' ||
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

  const toggleLogExpand = (logId: string) => {
    setExpandedLogs(prev => ({ ...prev, [logId]: !prev[logId] }));
  };

  const stats = {
    total: conflictSamples.length,
    pmReview: conflictSamples.filter(r => r.currentStatus === RecordStatus.PM_REVIEW).length,
    wrongCriteria: conflictSamples.filter(r => r.currentStatus === RecordStatus.WRONG_CRITERIA).length,
    rework: conflictSamples.filter(r => r.currentStatus === RecordStatus.REWORK).length,
    modelOutputMissing: conflictSamples.filter(r => r.modelOutputMissing).length
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">冲突样本表</h1>
        <p className="text-slate-500 mt-1">异常样本汇总，产品经理复核队列</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
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
        <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-5">
          <p className="text-sm text-red-600">暂无模型输出</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{stats.modelOutputMissing}</p>
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
                </select>

                <select
                  value={modelOutputFilter}
                  onChange={(e) => setModelOutputFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                >
                  <option value="all">全部模型输出</option>
                  <option value="missing">模型输出缺失</option>
                  <option value="available">模型输出可用</option>
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
                <>
                  <tr
                    key={record.id}
                    className={record.abnormalType === AbnormalType.URL_404_PASSED ? 'bg-amber-50/50' : 'hover:bg-slate-50'}
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
                        <ChevronDown className={`w-4 h-4 transition-transform ${expandedId === record.id ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {expandedId === record.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={8} className="px-8 py-4">
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
                            <div className={`p-3 rounded-lg border ${record.modelOutputMissing ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                              <p className="text-xs text-slate-500 mb-1">模型输出状态</p>
                              {record.modelOutputMissing ? (
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-red-600">暂无模型输出数据</p>
                                  {record.modelOutput?.filledBy && (
                                    <p className="text-xs text-red-500">
                                      补录人：{record.modelOutput.filledBy}
                                    </p>
                                  )}
                                  {record.modelOutput?.filledAt && (
                                    <p className="text-xs text-red-500">
                                      补录时间：{new Date(record.modelOutput.filledAt).toLocaleString('zh-CN')}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    模型输出可用
                                  </span>
                                  {record.modelOutput && (
                                    <>
                                      <p className="text-sm text-slate-700 mt-1">
                                        {record.modelOutput.outputSnippet}
                                      </p>
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-slate-500">
                                          模型：{record.modelOutput.modelName}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          置信度：{(record.modelOutput.confidence * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <History className="w-4 h-4" />
                              操作日志
                            </h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {record.judgmentLogs.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">暂无操作日志</p>
                              ) : (
                                record.judgmentLogs.map((log, logIndex) => (
                                  <div key={log.id} className="p-3 bg-white rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                          {LogActionLabelMap[log.action] || log.action}
                                        </span>
                                        <span className="font-medium text-slate-700">{log.operator}</span>
                                      </div>
                                      <span className="text-slate-400">
                                        {new Date(log.operatedAt).toLocaleString('zh-CN')}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">
                                      从 <span className="font-medium">{StatusLabelMap[log.fromStatus as RecordStatus]}</span> 变为
                                      <span className="font-medium ml-1">{StatusLabelMap[log.toStatus as RecordStatus]}</span>
                                    </p>
                                    {log.remark && (
                                      <p className="text-xs text-slate-500 mt-1">备注：{log.remark}</p>
                                    )}
                                    {log.diffSummary && log.diffSummary.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {log.diffSummary.map((diff, i) => (
                                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-violet-50 text-violet-700 border border-violet-200">
                                            {diff}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {log.fromSnapshot && log.toSnapshot && (
                                      <div className="mt-2">
                                        <button
                                          onClick={() => toggleLogExpand(log.id)}
                                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                                        >
                                          <ChevronRight className={`w-3 h-3 transition-transform ${expandedLogs[log.id] ? 'rotate-90' : ''}`} />
                                          {expandedLogs[log.id] ? '收起快照对比' : '展开快照对比'}
                                        </button>
                                        {expandedLogs[log.id] && (
                                          <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <SnapshotDiff from={log.fromSnapshot} to={log.toSnapshot} />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    <div className="mt-2 flex justify-end">
                                      <button
                                        onClick={() => rollbackToLog(record.id, logIndex)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        回滚到此版本
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="flex gap-2 pt-2">
                              {record.currentStatus === RecordStatus.PM_REVIEW && (
                                <>
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
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
      </div>
    </div>
  );
}
"""

target = '/Users/lzy/pro/solo/workspaces/zy72516/src/pages/Conflicts.tsx'
with open(target, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
