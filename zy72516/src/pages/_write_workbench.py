import os

content = r"""import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  History,
  Bot,
  User,
  MessageSquare,
  Link as LinkIcon,
  Plus,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import {
  AnnotationRecord,
  RecordStatus,
  LogAction,
  LogActionLabelMap,
  StatusLabelMap,
  ContentSnapshot
} from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { AbnormalTypeBadge } from '../components/common/AbnormalTypeBadge';

export default function Workbench() {
  const { records, updateRecordStatus, currentOperator, fillModelOutput, rollbackToLog } = useRecordStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remark, setRemark] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showFillModal, setShowFillModal] = useState(false);
  const [fillModelName, setFillModelName] = useState('');
  const [fillOutputSnippet, setFillOutputSnippet] = useState('');
  const [fillConfidence, setFillConfidence] = useState(0.8);
  const [expandedSnapshot, setExpandedSnapshot] = useState<Record<string, 'from' | 'to' | null>>({});

  const pendingRecords = records.filter(r =>
    r.currentStatus === RecordStatus.PENDING ||
    r.currentStatus === RecordStatus.PM_REVIEW
  );

  const currentRecord: AnnotationRecord | undefined = pendingRecords[currentIndex];

  useEffect(() => {
    setCurrentIndex(0);
  }, [records.length]);

  const handleAction = (newStatus: RecordStatus) => {
    if (!currentRecord) return;
    updateRecordStatus(currentRecord.id, newStatus, remark);
    setRemark('');
    if (currentIndex < pendingRecords.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(pendingRecords.length - 1, prev + 1));
  };

  const handleFillSubmit = () => {
    if (!currentRecord || !fillModelName.trim() || !fillOutputSnippet.trim()) return;
    fillModelOutput(currentRecord.id, {
      modelName: fillModelName.trim(),
      outputSnippet: fillOutputSnippet.trim(),
      confidence: fillConfidence
    });
    setShowFillModal(false);
    setFillModelName('');
    setFillOutputSnippet('');
    setFillConfidence(0.8);
  };

  const handleRollback = (logIndex: number) => {
    if (!currentRecord) return;
    if (!window.confirm(`确认回滚到第 ${logIndex + 1} 条操作记录？此操作将恢复该记录到操作前的状态。`)) return;
    rollbackToLog(currentRecord.id, logIndex);
  };

  const toggleSnapshot = (logId: string, type: 'from' | 'to') => {
    setExpandedSnapshot(prev => {
      const current = prev[logId];
      if (current === type) return { ...prev, [logId]: null };
      return { ...prev, [logId]: type };
    });
  };

  const renderSnapshot = (snapshot: ContentSnapshot, label: string) => (
    <div className="mt-2 p-3 rounded-lg text-xs space-y-1" style={{
      backgroundColor: label === '改前' ? 'rgba(251, 191, 36, 0.08)',
      border: '1px solid rgba(251, 191, 36, 0.25)'
    }}>
      <p className="font-semibold text-amber-700 mb-1">{label}快照</p>
      <p><span className="text-slate-500">状态：</span><span className="text-slate-700">{StatusLabelMap[snapshot.status] || snapshot.status}</span></p>
      <p><span className="text-slate-500">异常类型：</span><span className="text-slate-700">{snapshot.abnormalType}</span></p>
      <p><span className="text-slate-500">标注员留言：</span><span className="text-slate-700">{snapshot.annotatorMessage}</span></p>
      <p><span className="text-slate-500">机器人判断：</span><span className="text-slate-700">{snapshot.robotJudgment}</span></p>
      <p><span className="text-slate-500">引用链接：</span><span className="text-slate-700 break-all">{snapshot.referenceUrl}</span></p>
      <p><span className="text-slate-500">链接状态：</span><span className={snapshot.urlStatus ? 'text-emerald-600' : 'text-rose-600'}>{snapshot.urlStatus ? '正常' : '异常'}</span></p>
      {snapshot.modelOutputSnippet && (
        <>
          <p><span className="text-slate-500">模型名称：</span><span className="text-slate-700">{snapshot.modelOutputName}</span></p>
          <p><span className="text-slate-500">模型输出：</span><span className="text-slate-700">{snapshot.modelOutputSnippet}</span></p>
          <p><span className="text-slate-500">置信度：</span><span className="text-slate-700">{snapshot.modelOutputConfidence != null ? `${(snapshot.modelOutputConfidence * 100).toFixed(1)}%` : '无'}</span></p>
        </>
      )}
    </div>
  );

  if (pendingRecords.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">质检工作台</h1>
          <p className="text-slate-500 mt-1">补看模型输出片段，进行人工判断</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">太棒了！</h2>
          <p className="text-slate-500">当前没有待处理的记录，请稍后再来查看。</p>
        </div>
      </div>
    );
  }

  if (!currentRecord) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">质检工作台</h1>
          <p className="text-slate-500 mt-1">
            当前进度：{currentIndex + 1} / {pendingRecords.length} 条待处理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === pendingRecords.length - 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-mono font-bold text-slate-700">
                  {currentRecord.originalLineNumber}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">原始行号 #{currentRecord.originalLineNumber}</p>
                  <p className="text-xs text-slate-400">
                    导入于 {new Date(currentRecord.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={currentRecord.currentStatus} />
                <AbnormalTypeBadge type={currentRecord.abnormalType} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">标注员留言</span>
                </div>
                <p className="text-slate-900">{currentRecord.annotatorMessage}</p>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700">机器人原始判断</span>
                </div>
                <p className="text-blue-900 font-medium">{currentRecord.robotJudgment}</p>
              </div>

              <div className={`p-4 rounded-xl text-white ${currentRecord.modelOutputMissing ? 'bg-slate-900 border-2 border-amber-500' : 'bg-slate-900'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">模型输出片段</span>
                  </div>
                  {currentRecord.modelOutput && !currentRecord.modelOutputMissing && (
                    <span className="text-xs text-slate-500">
                      {currentRecord.modelOutput.modelName} · 置信度 {(currentRecord.modelOutput.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {currentRecord.modelOutputMissing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.4)' }}>
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-amber-300 text-sm font-medium">暂无模型输出数据 - 待补录</span>
                    </div>
                    <button
                      onClick={() => setShowFillModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      补录模型输出
                    </button>
                  </div>
                ) : (
                  <>
                    <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono">
                      {currentRecord.modelOutput?.outputSnippet || '暂无模型输出数据'}
                    </pre>
                    {currentRecord.modelOutput?.isBackfill && currentRecord.modelOutput.filledBy && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">补录</span>
                          <span>补录人：{currentRecord.modelOutput.filledBy}</span>
                          {currentRecord.modelOutput.filledAt && (
                            <span>· {new Date(currentRecord.modelOutput.filledAt).toLocaleString('zh-CN')}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {showFillModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">补录模型输出</h3>
                  <button
                    onClick={() => { setShowFillModal(false); setFillModelName(''); setFillOutputSnippet(''); setFillConfidence(0.8); }}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">模型名称</label>
                    <input
                      type="text"
                      value={fillModelName}
                      onChange={e => setFillModelName(e.target.value)}
                      placeholder="例如：GPT-4、Claude-3 等"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">输出片段</label>
                    <textarea
                      value={fillOutputSnippet}
                      onChange={e => setFillOutputSnippet(e.target.value)}
                      placeholder="请输入模型输出的文本片段..."
                      rows={5}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">置信度</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={fillConfidence}
                        onChange={e => setFillConfidence(parseFloat(e.target.value) || 0)}
                        className="w-28 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                      />
                      <span className="text-sm text-slate-500">{(fillConfidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setShowFillModal(false); setFillModelName(''); setFillOutputSnippet(''); setFillConfidence(0.8); }}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleFillSubmit}
                    disabled={!fillModelName.trim() || !fillOutputSnippet.trim()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    确认补录
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">处理人：{currentOperator}</span>
            </div>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="填写判断备注（选填）..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">引用链接检查</h3>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
              <LinkIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-slate-700 truncate font-mono">
                  {currentRecord.referenceUrl}
                </p>
                <p className={`text-xs font-medium mt-0.5 ${
                  currentRecord.urlStatus ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {currentRecord.urlStatus ? '链接有效' : '链接无效 (404)'}
                </p>
              </div>
            </div>
            {currentRecord.abnormalType === 'url_404_passed' && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    <strong>边界规则触发：</strong>引用链接404但机器人仍判通过，需产品经理复核，不得直接归为正常
                  </p>
                </div>
              </div>
            )}
            {currentRecord.modelOutputMissing && !currentRecord.urlStatus && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-300 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700">
                    <strong>双重异常：</strong>引用链接404 + 暂无模型输出数据，必须先补录模型输出再进行判断
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">操作</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleAction(RecordStatus.PASSED)}
                disabled={currentRecord.abnormalType === 'url_404_passed'}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                标记通过
              </button>

              {currentRecord.abnormalType === 'url_404_passed' && (
                <>
                  <button
                    onClick={() => handleAction(RecordStatus.REVIEW_PASSED)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    产品经理复核通过
                  </button>
                  <button
                    onClick={() => handleAction(RecordStatus.REVIEW_REJECTED)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    产品经理复核驳回
                  </button>
                </>
              )}

              <button
                onClick={() => handleAction(RecordStatus.REJECTED)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
                驳回
              </button>

              <button
                onClick={() => handleAction(RecordStatus.WRONG_CRITERIA)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                标记错口径
              </button>

              <button
                onClick={() => handleAction(RecordStatus.REWORK)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                标记补录返工
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <History className="w-4 h-4" />
            查看操作日志
            {showHistory ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </button>

          {showHistory && currentRecord.judgmentLogs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
              <h4 className="text-sm font-medium text-slate-700">操作历史</h4>
              {currentRecord.judgmentLogs.map((log, index) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">{log.operator}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{
                        backgroundColor: log.action === LogAction.ROLLBACK ? 'rgba(239, 68, 68, 0.1)' :
                          log.action === LogAction.MODEL_OUTPUT_FILL ? 'rgba(251, 191, 36, 0.1)' :
                          'rgba(99, 102, 241, 0.1)',
                        color: log.action === LogAction.ROLLBACK ? '#dc2626' :
                          log.action === LogAction.MODEL_OUTPUT_FILL ? '#d97706' :
                          '#4f46e5'
                      }}>
                        {LogActionLabelMap[log.action] || log.action}
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {new Date(log.operatedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    从 <span className="font-medium text-slate-700">{StatusLabelMap[log.fromStatus] || log.fromStatus}</span>
                    {' \u2192 '}
                    <span className="font-medium text-slate-700">{StatusLabelMap[log.toStatus] || log.toStatus}</span>
                  </p>
                  {log.remark && (
                    <p className="text-xs text-slate-500 mt-1">备注：{log.remark}</p>
                  )}
                  {log.diffSummary && log.diffSummary.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {log.diffSummary.map((diff, i) => (
                        <p key={i} className="text-xs text-slate-500 pl-2 border-l-2 border-slate-300">{diff}</p>
                      ))}
                    </div>
                  )}
                  {(log.fromSnapshot || log.toSnapshot) && (
                    <div className="mt-2 flex items-center gap-2">
                      {log.fromSnapshot && (
                        <button
                          onClick={() => toggleSnapshot(log.id, 'from')}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200"
                        >
                          <Eye className="w-3 h-3" />
                          查看改前
                          {expandedSnapshot[log.id] === 'from' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                      {log.toSnapshot && (
                        <button
                          onClick={() => toggleSnapshot(log.id, 'to')}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
                        >
                          <Eye className="w-3 h-3" />
                          查看改后
                          {expandedSnapshot[log.id] === 'to' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  )}
                  {expandedSnapshot[log.id] === 'from' && log.fromSnapshot && renderSnapshot(log.fromSnapshot, '改前')}
                  {expandedSnapshot[log.id] === 'to' && log.toSnapshot && renderSnapshot(log.toSnapshot, '改后')}
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => handleRollback(index)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-rose-600 hover:bg-rose-50 transition-colors border border-rose-200"
                    >
                      <RotateCcw className="w-3 h-3" />
                      回滚到此版本
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
"""

target = os.path.join(os.path.dirname(__file__), 'Workbench.tsx')
with open(target, 'w', encoding='utf-8') as f:
    f.write(content.lstrip('\n'))

print(f"Written {len(content)} chars to {target}")
