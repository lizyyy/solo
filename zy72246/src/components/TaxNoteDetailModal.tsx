import { useState } from 'react';
import { X, Save, History, RotateCcw, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TaxNote, ProcessingStatus, ProcessStep, BalanceChangeRecord } from '@/types';
import { useAppStore, useStatusHistoryByTaxNoteId, useVersionsByTaxNoteId } from '@/store';
import { StatusBadge } from './StatusBadge';
import { ProcessStepIndicator } from './ProcessStepIndicator';
import { getStatusDisplayName, getNextAllowedStatuses } from '@/utils/stateMachine';
import { checkBalanceUpdatePrerequisite } from '@/utils/boundaryRules';
import { generateUUID } from '@/utils/versionControl';

interface TaxNoteDetailModalProps {
  taxNote: TaxNote;
  onClose: () => void;
}

function getNextAction(step: ProcessStep, status: ProcessingStatus): { title: string; description: string; targetStatus?: ProcessingStatus } {
  if (status === ProcessingStatus.REVERSAL_PENDING_REVIEW) {
    return { title: '此记录需先经风控复核', description: '请前往风控复核页面处理' };
  }
  switch (step) {
    case ProcessStep.STEP_1_IMPORT:
      return { title: '补看柜台流水尾号', description: '请输入柜台流水尾号，完成后将状态变更为"补看完成"', targetStatus: ProcessingStatus.SUPPLEMENT_COMPLETED };
    case ProcessStep.STEP_2_SUPPLEMENT:
      return { title: '确认余额更新', description: '系统将检查前置条件并自动生成余额变更记录，完成后状态变更为"余额已更新"', targetStatus: ProcessingStatus.BALANCE_UPDATED };
    case ProcessStep.STEP_3_BALANCE:
      return { title: '填写摘要', description: '请填写摘要信息，完成后将状态变更为"待负责人审阅"', targetStatus: ProcessingStatus.PENDING_APPROVAL };
    case ProcessStep.STEP_4_SUMMARY:
      if (status === ProcessingStatus.PENDING_APPROVAL) {
        return { title: '等待负责人审阅', description: '摘要已提交，等待负责人审阅通过' };
      }
      if (status === ProcessingStatus.COMPLETED) {
        return { title: '已完成', description: '此记录所有流程已完成' };
      }
      return { title: '标记为已完成', description: '确认无误后可标记为已完成', targetStatus: ProcessingStatus.COMPLETED };
    default:
      return { title: '未知步骤', description: '' };
  }
}

export function TaxNoteDetailModal({ taxNote, onClose }: TaxNoteDetailModalProps) {
  const dispatch = useAppStore(state => state.dispatch);
  const currentUser = useAppStore(state => state.currentUser);
  const versions = useVersionsByTaxNoteId(taxNote.id);
  const statusHistory = useStatusHistoryByTaxNoteId(taxNote.id);

  const [editMode, setEditMode] = useState(false);
  const [currentRemark, setCurrentRemark] = useState(taxNote.currentRemark);
  const [counterTailNumber, setCounterTailNumber] = useState(taxNote.counterTailNumber);
  const [summary, setSummary] = useState(taxNote.summary);
  const [editReason, setEditReason] = useState('');
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ProcessingStatus | null>(null);
  const [statusRemark, setStatusRemark] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [showRollback, setShowRollback] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');

  const nextAllowedStatuses = getNextAllowedStatuses(taxNote.processingStatus);
  const isReversalPending = taxNote.processingStatus === ProcessingStatus.REVERSAL_PENDING_REVIEW;
  const nextAction = getNextAction(taxNote.currentStep, taxNote.processingStatus);

  const isHighlightedField = (fieldName: string) => {
    if (!editMode) return false;
    if (fieldName === 'counterTailNumber' && taxNote.currentStep === ProcessStep.STEP_1_IMPORT) return true;
    if (fieldName === 'summary' && taxNote.currentStep === ProcessStep.STEP_3_BALANCE) return true;
    return false;
  };

  const handleSave = () => {
    if (!editReason.trim()) {
      alert('请填写修改原因');
      return;
    }

    dispatch({
      type: 'UPDATE_TAX_NOTE',
      payload: {
        id: taxNote.id,
        updates: {
          currentRemark,
          counterTailNumber,
          summary,
        },
        reason: editReason,
      },
    });

    setEditMode(false);
    setEditReason('');
  };

  const handleGuidedAction = () => {
    if (nextAction.targetStatus === ProcessingStatus.SUPPLEMENT_COMPLETED) {
      if (!counterTailNumber.trim()) {
        setBlockedReason('请先填写柜台流水尾号');
        return;
      }
      setBlockedReason('');
      dispatch({
        type: 'CHANGE_STATUS',
        payload: {
          id: taxNote.id,
          toStatus: ProcessingStatus.SUPPLEMENT_COMPLETED,
          remark: `补看柜台流水尾号: ${counterTailNumber}`,
        },
      });
    } else if (nextAction.targetStatus === ProcessingStatus.BALANCE_UPDATED) {
      const check = checkBalanceUpdatePrerequisite(taxNote);
      if (!check.canProceed) {
        setBlockedReason(check.reason);
        return;
      }
      setBlockedReason('');

      const balanceChange: BalanceChangeRecord = {
        id: generateUUID(),
        taxNoteId: taxNote.id,
        previousBalance: taxNote.currentAmount,
        changeAmount: taxNote.currentAmount,
        newBalance: 0,
        changeType: taxNote.currentAmount === 0 ? 'REVERSAL' : 'TAX',
        changeDate: new Date().toISOString(),
        remark: `余额更新: ${taxNote.stockCode} ${taxNote.tradeDate}`,
        generatedBy: currentUser,
        generatedAt: new Date().toISOString(),
        version: taxNote.version + 1,
      };

      dispatch({
        type: 'GENERATE_BALANCE_CHANGE',
        payload: {
          balanceChange,
          taxNoteUpdates: {
            id: taxNote.id,
            updates: {
              processingStatus: ProcessingStatus.BALANCE_UPDATED,
              currentStep: ProcessStep.STEP_3_BALANCE,
            },
            reason: '确认余额更新，生成余额变更记录',
          },
        },
      });
    } else if (nextAction.targetStatus === ProcessingStatus.PENDING_APPROVAL) {
      if (!summary.trim()) {
        setBlockedReason('请先填写摘要信息');
        return;
      }
      setBlockedReason('');
      dispatch({
        type: 'CHANGE_STATUS',
        payload: {
          id: taxNote.id,
          toStatus: ProcessingStatus.PENDING_APPROVAL,
          remark: `提交摘要: ${summary}`,
        },
      });
    } else if (nextAction.targetStatus === ProcessingStatus.COMPLETED) {
      setBlockedReason('');
      dispatch({
        type: 'CHANGE_STATUS',
        payload: {
          id: taxNote.id,
          toStatus: ProcessingStatus.COMPLETED,
          remark: '标记为已完成',
        },
      });
    }
  };

  const handleStatusChange = () => {
    if (!selectedStatus || !statusRemark.trim()) {
      alert('请选择目标状态并填写备注');
      return;
    }

    if (selectedStatus === ProcessingStatus.BALANCE_UPDATED) {
      const check = checkBalanceUpdatePrerequisite(taxNote);
      if (!check.canProceed) {
        setBlockedReason(check.reason);
        return;
      }
    }
    setBlockedReason('');

    dispatch({
      type: 'CHANGE_STATUS',
      payload: {
        id: taxNote.id,
        toStatus: selectedStatus,
        remark: statusRemark,
      },
    });

    setShowStatusChange(false);
    setSelectedStatus(null);
    setStatusRemark('');
  };

  const handleRollback = () => {
    if (!rollbackReason.trim()) {
      alert('请填写回滚原因');
      return;
    }

    dispatch({
      type: 'ROLLBACK_STATUS',
      payload: {
        id: taxNote.id,
        reason: rollbackReason,
      },
    });

    setShowRollback(false);
    setRollbackReason('');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: "'Noto Serif SC', serif" }}>
              税费率备注详情
            </h2>
            <p className="text-sm text-slate-500">
              {taxNote.stockCode} {taxNote.stockName} · {taxNote.tradeDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isReversalPending && (
            <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-base font-bold text-orange-800">此记录需先经风控复核，请前往风控复核页面处理</h3>
                  <p className="text-sm text-orange-700 mt-1">
                    该记录为冲正待复核状态，状态变更和编辑操作已被禁用。
                  </p>
                  <Link
                    to="/review"
                    className="inline-flex items-center space-x-1 mt-2 px-4 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
                  >
                    <span>前往风控复核页面</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className={`rounded-lg p-4 ${isReversalPending ? 'bg-slate-50 opacity-60' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-start space-x-3">
                {isReversalPending ? (
                  <AlertTriangle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                ) : taxNote.processingStatus === ProcessingStatus.COMPLETED ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <ArrowRight className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{nextAction.title}</h3>
                  <p className="text-sm text-slate-600 mt-0.5">{nextAction.description}</p>
                  {blockedReason && (
                    <div className="mt-2 px-3 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700 font-medium">
                      ⛔ {blockedReason}
                    </div>
                  )}
                </div>
              </div>
              {nextAction.targetStatus && !isReversalPending && (
                <button
                  onClick={handleGuidedAction}
                  className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  {nextAction.title}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <StatusBadge status={taxNote.processingStatus} />
              <ProcessStepIndicator currentStep={taxNote.currentStep} />
              <span className="text-sm text-slate-500">版本: v{taxNote.version}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                to={`/history/${taxNote.id}`}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded transition-colors"
              >
                <History className="w-4 h-4" />
                <span>历史变更</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-slate-500 mb-3">原始信息（不可修改）</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">原始行号:</span>
                  <span className="font-mono font-medium text-slate-800">{taxNote.originalLineNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">流水号:</span>
                  <span className="font-mono text-slate-800">{taxNote.serialNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">原始税费金额:</span>
                  <span className="font-mono text-slate-800">HK$ {taxNote.originalAmount.toFixed(2)}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-600">原始备注:</span>
                  <p className="mt-1 text-slate-800 bg-white p-2 rounded border border-slate-200 font-mono text-xs">
                    {taxNote.originalRemark}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-700 mb-3">当前信息（可修改）</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">当前备注</label>
                  {editMode ? (
                    <textarea
                      value={currentRemark}
                      onChange={(e) => setCurrentRemark(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm text-slate-800 bg-white p-2 rounded border border-slate-200">
                      {taxNote.currentRemark}
                    </p>
                  )}
                </div>
                <div className={isHighlightedField('counterTailNumber') ? 'ring-2 ring-blue-400 ring-offset-2 rounded-lg p-2 -m-2' : ''}>
                  <label className="block text-sm text-slate-600 mb-1">
                    柜台流水尾号
                    {isHighlightedField('counterTailNumber') && (
                      <span className="ml-2 text-xs text-blue-600 font-medium">← 当前步骤重点填写</span>
                    )}
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      value={counterTailNumber}
                      onChange={(e) => setCounterTailNumber(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono ${isHighlightedField('counterTailNumber') ? 'border-blue-400 bg-blue-50' : 'border-slate-300'}`}
                    />
                  ) : (
                    <p className="text-sm font-mono text-slate-800 bg-white p-2 rounded border border-slate-200">
                      {taxNote.counterTailNumber || '-'}
                    </p>
                  )}
                </div>
                <div className={isHighlightedField('summary') ? 'ring-2 ring-blue-400 ring-offset-2 rounded-lg p-2 -m-2' : ''}>
                  <label className="block text-sm text-slate-600 mb-1">
                    摘要
                    {isHighlightedField('summary') && (
                      <span className="ml-2 text-xs text-blue-600 font-medium">← 当前步骤重点填写</span>
                    )}
                  </label>
                  {editMode ? (
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isHighlightedField('summary') ? 'border-blue-400 bg-blue-50' : 'border-slate-300'}`}
                      rows={2}
                      placeholder="给负责人看的摘要信息"
                    />
                  ) : (
                    <p className="text-sm text-slate-800 bg-white p-2 rounded border border-slate-200">
                      {taxNote.summary || '-'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {editMode && (
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <label className="block text-sm font-medium text-amber-800 mb-2">
                修改原因 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="请填写本次修改的原因，将记入历史版本"
              />
            </div>
          )}

          {showStatusChange && (
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="text-sm font-medium text-purple-800 mb-3">状态变更</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">目标状态</label>
                  <select
                    value={selectedStatus || ''}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value as ProcessingStatus);
                      setBlockedReason('');
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">请选择</option>
                    {nextAllowedStatuses.map(status => (
                      <option key={status} value={status}>
                        {getStatusDisplayName(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">变更备注 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={statusRemark}
                    onChange={(e) => setStatusRemark(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="请填写状态变更原因"
                  />
                </div>
              </div>
              {blockedReason && (
                <div className="mt-3 px-3 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700 font-medium">
                  ⛔ {blockedReason}
                </div>
              )}
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => { setShowStatusChange(false); setBlockedReason(''); }}
                  className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleStatusChange}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                >
                  确认变更
                </button>
              </div>
            </div>
          )}

          {showRollback && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h4 className="text-sm font-medium text-red-800 mb-3">状态回滚</h4>
              <p className="text-sm text-red-700 mb-3">
                将回滚到上一个状态，此操作将被记录。
              </p>
              <div className="mb-4">
                <label className="block text-sm text-slate-600 mb-1">回滚原因 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-red-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="请填写回滚原因"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowRollback(false)}
                  className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleRollback}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  确认回滚
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">状态流转历史</h3>
            <div className="space-y-2">
              {statusHistory.slice(0, 5).map((history, index) => (
                <div key={history.id} className="flex items-start space-x-3 text-sm">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500">
                        {history.fromStatus ? getStatusDisplayName(history.fromStatus) : '初始'}
                      </span>
                      <span className="text-slate-400">→</span>
                      <StatusBadge status={history.toStatus} className="text-xs" />
                    </div>
                    <p className="text-slate-600 mt-0.5">{history.remark}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {history.operatedBy} · {formatDate(history.operatedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">近期变更记录</h3>
            <div className="space-y-2">
              {versions.slice(0, 3).map((version) => (
                <div key={version.id} className="flex items-start space-x-3 text-sm bg-slate-50 p-3 rounded">
                  <div className="flex-shrink-0 w-12 text-center">
                    <span className="text-xs font-mono bg-slate-200 px-2 py-0.5 rounded">
                      v{version.versionNumber}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{version.fieldName}</span>
                      <span className="text-xs text-slate-400">
                        {version.changedBy} · {formatDate(version.changedAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-start space-x-2 text-xs">
                      <span className="text-red-600 line-through bg-red-50 px-1.5 py-0.5 rounded">
                        {version.oldValue || '(空)'}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        {version.newValue || '(空)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{version.changeReason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500">
            创建人: {taxNote.createdBy} · {formatDate(taxNote.createdAt)}
            <span className="mx-2">|</span>
            最后更新: {taxNote.updatedBy} · {formatDate(taxNote.updatedAt)}
          </div>
          <div className="flex items-center space-x-2">
            {!editMode ? (
              <>
                <button
                  onClick={() => setShowRollback(true)}
                  disabled={statusHistory.length < 2 || isReversalPending}
                  className="flex items-center space-x-1 px-3 py-2 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>回滚</span>
                </button>
                <button
                  onClick={() => setShowStatusChange(true)}
                  disabled={nextAllowedStatuses.length === 0 || isReversalPending}
                  className="flex items-center space-x-1 px-3 py-2 text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>变更状态</span>
                </button>
                <button
                  onClick={() => setEditMode(true)}
                  disabled={isReversalPending}
                  className="flex items-center space-x-1 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>编辑</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setCurrentRemark(taxNote.currentRemark);
                    setCounterTailNumber(taxNote.counterTailNumber);
                    setSummary(taxNote.summary);
                    setEditReason('');
                  }}
                  className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center space-x-1 px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>保存</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
