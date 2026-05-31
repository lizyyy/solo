import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Edit3,
  Undo2,
  Send,
  Lightbulb,
  AlertTriangle,
  Clock,
  User,
  Calendar,
  Tag,
  Database,
  FileText,
  Mail,
  MessageSquare,
  History,
  Plus,
  Loader2,
} from 'lucide-react';
import { useSettlementStore } from '../store/useSettlementStore';
import StatusBadge from '../components/StatusBadge';
import SourceBadge from '../components/SourceBadge';
import AdjustModal from '../components/AdjustModal';
import RollbackModal from '../components/RollbackModal';
import { formatCurrency } from '../utils/amount';
import { formatDateTime } from '../utils/date';
import type { SettlementStatus } from '../types';
import { STATUS_LABELS } from '../types';

export default function SettlementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [materialReason, setMaterialReason] = useState('');
  const [showMaterialInput, setShowMaterialInput] = useState(false);

  const {
    getSettlementById,
    getProcessingSuggestion,
    validateSettlement,
    confirmSettlement,
    requestMaterial,
    addNote,
    initialized,
  } = useSettlementStore();

  const settlement = id ? getSettlementById(id) : undefined;
  const suggestion = id ? getProcessingSuggestion(id) : '';
  const issues = id ? validateSettlement(id) : [];

  const hasCriticalErrors = useMemo(
    () => issues.some(i => i.severity === 'error'),
    [issues]
  );

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="card p-12 text-center">
            <XCircle className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <p className="text-lg text-neutral-600 mb-4">未找到该清分记录</p>
            <button className="btn btn-primary" onClick={() => navigate('/list')}>
              返回列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isFinalState = settlement.status === 'confirmed' || settlement.status === 'manual_adjust';
  const canConfirm = !hasCriticalErrors && !isFinalState;
  const canRollback = isFinalState;

  const handleConfirm = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      confirmSettlement(settlement.id);
      setConfirming(false);
    } catch (e) {
      alert((e as Error).message);
      setConfirming(false);
    }
  };

  const handleRequestMaterial = () => {
    if (!materialReason.trim()) {
      alert('请填写退回原因');
      return;
    }
    requestMaterial(settlement.id, materialReason);
    setShowMaterialInput(false);
    setMaterialReason('');
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNote(settlement.id, newNote);
    setNewNote('');
  };

  const getSuggestionStyle = () => {
    if (suggestion.includes('⚠️')) return 'bg-amber-50 border-amber-200 text-amber-800';
    if (suggestion.includes('🔴')) return 'bg-danger-50 border-danger-200 text-danger-800';
    if (suggestion.includes('✅')) return 'bg-success-50 border-success-200 text-success-800';
    return 'bg-primary-50 border-primary-200 text-primary-800';
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="btn btn-ghost flex items-center gap-2"
                onClick={() => navigate('/list')}
              >
                <ArrowLeft size={16} />
                返回列表
              </button>
              <div className="h-6 w-px bg-neutral-200" />
              <div>
                <h1 className="text-lg font-serif font-semibold text-neutral-900">
                  清分详情 - {settlement.merchantName}
                </h1>
                <p className="text-sm text-neutral-500 font-mono">{settlement.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isFinalState && !showMaterialInput && (
                <>
                  <button
                    className="btn btn-warning flex items-center gap-2"
                    onClick={() => setShowMaterialInput(true)}
                  >
                    <Send size={16} />
                    退回补材料
                  </button>
                  <button
                    className="btn btn-adjust flex items-center gap-2"
                    onClick={() => setAdjustModalOpen(true)}
                  >
                    <Edit3 size={16} />
                    人工改判
                  </button>
                  <button
                    className={`btn ${canConfirm ? 'btn-success' : ''} flex items-center gap-2`}
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                  >
                    <CheckCircle size={16} />
                    {confirming ? '确认提交？' : '确认通过'}
                  </button>
                </>
              )}
              {canRollback && (
                <button
                  className="btn btn-warning flex items-center gap-2"
                  onClick={() => setRollbackModalOpen(true)}
                >
                  <Undo2 size={16} />
                  回退
                </button>
              )}
            </div>
          </div>

          {showMaterialInput && (
            <div className="mt-4 p-4 bg-warning-50 border border-warning-200 rounded-lg">
              <p className="text-sm font-medium text-warning-800 mb-2">
                请填写退回补材料的原因：
              </p>
              <textarea
                value={materialReason}
                onChange={e => setMaterialReason(e.target.value)}
                rows={2}
                className="textarea mb-3"
                placeholder="例如：缺少审批邮件附件、金额差异需确认、交易流水不完整等"
              />
              <div className="flex justify-end gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    setShowMaterialInput(false);
                    setMaterialReason('');
                  }}
                >
                  取消
                </button>
                <button className="btn btn-warning" onClick={handleRequestMaterial}>
                  确认退回
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className={`p-4 border rounded-lg flex items-start gap-3 ${getSuggestionStyle()}`}>
          <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-1">业务处理建议</p>
            <p className="text-sm">{suggestion}</p>
          </div>
        </div>

        {issues.length > 0 && (
          <div className="card">
            <div className="p-4 border-b border-neutral-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
              <h3 className="font-semibold text-neutral-900">数据校验问题</h3>
              <span className="ml-auto text-sm text-neutral-500">
                {issues.filter(i => i.severity === 'error').length} 个错误，
                {issues.filter(i => i.severity === 'warning').length} 个警告
              </span>
            </div>
            <div className="p-4 space-y-3">
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    issue.severity === 'error'
                      ? 'bg-danger-50 border-danger-200'
                      : 'bg-warning-50 border-warning-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                        issue.severity === 'error'
                          ? 'bg-danger-100 text-danger-700'
                          : 'bg-warning-100 text-warning-700'
                      }`}
                    >
                      {issue.severity === 'error' ? '错误' : '警告'}
                    </span>
                    <span className="text-sm text-neutral-600 font-mono">{issue.field}</span>
                  </div>
                  <p className="text-sm text-neutral-800 mt-1">{issue.message}</p>
                  <p className="text-sm text-neutral-600 mt-1">💡 {issue.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="p-4 border-b border-neutral-200 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-neutral-900">基础信息</h3>
          </div>
          <div className="p-4 grid grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-xs text-neutral-500 flex items-center gap-1">
                <Tag size={12} /> 批次号
              </p>
              <p className="font-mono text-sm text-primary-700">{settlement.id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-500 flex items-center gap-1">
                <User size={12} /> 商户名称
              </p>
              <p className="text-sm text-neutral-900">{settlement.merchantName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-500 flex items-center gap-1">
                <Database size={12} /> 数据来源
              </p>
              <SourceBadge source={settlement.source} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-500 flex items-center gap-1">
                <Tag size={12} /> 当前状态
              </p>
              <StatusBadge status={settlement.status} pulse={settlement.status === 'pending'} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-500 flex items-center gap-1">
                <Clock size={12} /> 处理时间
              </p>
              <p className="text-sm text-neutral-700">{formatDateTime(settlement.updatedAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-500 flex items-center gap-1">
                <User size={12} /> 操作人
              </p>
              <p className="text-sm text-neutral-700">{settlement.operator || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-500 flex items-center gap-1">
                <Calendar size={12} /> 数据口径
              </p>
              <p className="text-sm text-neutral-700">{settlement.dataCaliber}</p>
            </div>
            <div className="space-y-1 col-span-2">
              <p className="text-xs text-neutral-500">清分金额</p>
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-bold font-mono text-neutral-900">
                  {formatCurrency(settlement.amount)}
                </p>
                {settlement.originalAmount && (
                  <>
                    <span className="text-sm text-neutral-400 line-through font-mono">
                      {formatCurrency(settlement.originalAmount)}
                    </span>
                    <span className="text-sm text-adjust-600 font-medium">
                      （人工调整 +{formatCurrency(settlement.amount - settlement.originalAmount)}）
                    </span>
                  </>
                )}
              </div>
              {settlement.adjustmentReason && (
                <p className="text-xs text-neutral-500 mt-1">
                  改判原因：{settlement.adjustmentReason}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-neutral-900">收款流水</h3>
              </div>
              <span className="text-sm text-neutral-500">
                共 {settlement.transactions.length} 条
              </span>
            </div>
            <div className="divide-y divide-neutral-100">
              {settlement.transactions.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  <Database className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                  <p className="text-sm">暂无收款流水</p>
                </div>
              ) : (
                settlement.transactions.map(t => (
                  <div key={t.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-mono text-sm text-primary-700">{t.transNo}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{t.channel}</p>
                      </div>
                      <p className="font-mono font-semibold text-success-600">
                        +{formatCurrency(t.amount)}
                      </p>
                    </div>
                    <p className="text-xs text-neutral-500">
                      交易时间：{formatDateTime(t.transTime)}
                    </p>
                    {t.memo && (
                      <p className="text-xs text-neutral-600 mt-1">附言：{t.memo}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-danger-500" />
                <h3 className="font-semibold text-neutral-900">退款申请</h3>
              </div>
              <span className="text-sm text-neutral-500">
                共 {settlement.refundRequests.length} 条
              </span>
            </div>
            <div className="divide-y divide-neutral-100">
              {settlement.refundRequests.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  <XCircle className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                  <p className="text-sm">暂无退款申请</p>
                </div>
              ) : (
                settlement.refundRequests.map(r => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-mono text-sm text-primary-700">{r.requestNo}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">申请人：{r.applicant}</p>
                      </div>
                      <p className="font-mono font-semibold text-danger-600">
                        -{formatCurrency(r.amount)}
                      </p>
                    </div>
                    <p className="text-xs text-neutral-500">
                      申请时间：{formatDateTime(r.requestTime)}
                    </p>
                    {r.reason && (
                      <p className="text-xs text-neutral-600 mt-1">原因：{r.reason}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-neutral-900">审批邮件</h3>
            </div>
            <span className="text-sm text-neutral-500">
              共 {settlement.approvalEmails.length} 封
            </span>
          </div>
          <div className="divide-y divide-neutral-100">
            {settlement.approvalEmails.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <Mail className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                <p className="text-sm">暂无审批邮件</p>
              </div>
            ) : (
              settlement.approvalEmails.map(e => (
                <div key={e.id} className="p-4">
                  <h4 className="font-medium text-neutral-900 mb-2">{e.subject}</h4>
                  <div className="flex items-center gap-4 text-xs text-neutral-500 mb-3">
                    <span>发件人：{e.sender}</span>
                    <span>收件人：{e.receiver}</span>
                    <span>{formatDateTime(e.sentAt)}</span>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-lg text-sm text-neutral-700 leading-relaxed">
                    {e.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b border-neutral-200 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-neutral-900">手写备注</h3>
          </div>
          <div className="p-4 space-y-4">
            {settlement.notes.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4">暂无备注</p>
            ) : (
              settlement.notes.map(n => (
                <div key={n.id} className="p-3 bg-primary-50/50 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
                    <User size={12} />
                    <span>{n.author}</span>
                    <span className="text-neutral-300">·</span>
                    <span>{formatDateTime(n.createdAt)}</span>
                  </div>
                  <p className="text-sm text-neutral-700">{n.content}</p>
                </div>
              ))
            )}
            <div className="flex gap-3 pt-2">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                rows={2}
                className="textarea flex-1"
                placeholder="添加备注，便于后续追溯..."
              />
              <button
                className="btn btn-primary self-end flex items-center gap-2"
                onClick={handleAddNote}
                disabled={!newNote.trim()}
              >
                <Plus size={14} />
                添加
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b border-neutral-200 flex items-center gap-2">
            <History className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-neutral-900">操作日志</h3>
          </div>
          <div className="p-4">
            <ol className="relative border-l-2 border-neutral-200 ml-3 space-y-6">
              {settlement.operationLogs.map(log => (
                <li key={log.id} className="ml-6">
                  <span className="absolute -left-[9px] w-4 h-4 rounded-full bg-primary-600 border-2 border-white" />
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="text-sm font-medium text-neutral-900">{log.action}</span>
                    <span className="text-xs text-neutral-500">
                      {log.fromStatus && (
                        <>
                          {STATUS_LABELS[log.fromStatus]} →{' '}
                        </>
                      )}
                      {STATUS_LABELS[log.toStatus]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 mb-1">
                    <span className="flex items-center gap-1">
                      <User size={12} /> {log.operator}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {formatDateTime(log.operatedAt)}
                    </span>
                  </div>
                  {log.reason && (
                    <p className="text-sm text-neutral-600 bg-neutral-50 px-3 py-2 rounded mt-1">
                      {log.reason}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>

      <AdjustModal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        settlementId={settlement.id}
        currentAmount={settlement.amount}
      />

      <RollbackModal
        isOpen={rollbackModalOpen}
        onClose={() => setRollbackModalOpen(false)}
        settlementId={settlement.id}
        currentStatus={settlement.status}
      />
    </div>
  );
}
