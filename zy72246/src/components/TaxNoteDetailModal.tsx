import { useState } from 'react';
import { X, Save, History, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TaxNote, ProcessingStatus } from '@/types';
import { useAppStore, useStatusHistoryByTaxNoteId, useVersionsByTaxNoteId } from '@/store';
import { StatusBadge } from './StatusBadge';
import { ProcessStepIndicator } from './ProcessStepIndicator';
import { getStatusDisplayName, getNextAllowedStatuses } from '@/utils/stateMachine';

interface TaxNoteDetailModalProps {
  taxNote: TaxNote;
  onClose: () => void;
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

  const nextAllowedStatuses = getNextAllowedStatuses(taxNote.processingStatus);

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

  const handleStatusChange = () => {
    if (!selectedStatus || !statusRemark.trim()) {
      alert('请选择目标状态并填写备注');
      return;
    }

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
                <div>
                  <label className="block text-sm text-slate-600 mb-1">柜台流水尾号</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={counterTailNumber}
                      onChange={(e) => setCounterTailNumber(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                  ) : (
                    <p className="text-sm font-mono text-slate-800 bg-white p-2 rounded border border-slate-200">
                      {taxNote.counterTailNumber || '-'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">摘要</label>
                  {editMode ? (
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    onChange={(e) => setSelectedStatus(e.target.value as ProcessingStatus)}
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
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setShowStatusChange(false)}
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
                  disabled={statusHistory.length < 2}
                  className="flex items-center space-x-1 px-3 py-2 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>回滚</span>
                </button>
                <button
                  onClick={() => setShowStatusChange(true)}
                  disabled={nextAllowedStatuses.length === 0}
                  className="flex items-center space-x-1 px-3 py-2 text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>变更状态</span>
                </button>
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center space-x-1 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
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
