import { useState, useEffect } from 'react';
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
  Link as LinkIcon
} from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { AnnotationRecord, RecordStatus } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { AbnormalTypeBadge } from '../components/common/AbnormalTypeBadge';

export default function Workbench() {
  const { records, updateRecordStatus, currentOperator } = useRecordStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remark, setRemark] = useState('');
  const [showHistory, setShowHistory] = useState(false);

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

              <div className="p-4 bg-slate-900 rounded-xl text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">模型输出片段</span>
                  </div>
                  {currentRecord.modelOutput && (
                    <span className="text-xs text-slate-500">
                      {currentRecord.modelOutput.modelName} · 置信度 {(currentRecord.modelOutput.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono">
                  {currentRecord.modelOutput?.outputSnippet || '暂无模型输出数据'}
                </pre>
              </div>
            </div>
          </div>

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
          </button>

          {showHistory && currentRecord.judgmentLogs.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
              <h4 className="text-sm font-medium text-slate-700">操作历史</h4>
              {currentRecord.judgmentLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{log.operator}</span>
                    <span className="text-slate-400">
                      {new Date(log.operatedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {StatusBadge.toString.call ? '' : ''}
                    从 <span className="text-slate-700">{log.fromStatus}</span> 变为
                    <span className="text-slate-700 ml-1">{log.toStatus}</span>
                  </p>
                  {log.remark && (
                    <p className="text-xs text-slate-500 mt-1">备注：{log.remark}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
