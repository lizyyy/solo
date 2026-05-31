import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Undo2,
  CheckCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  Send,
  History,
  FileText,
} from 'lucide-react';
import { useRedemptionStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import MaterialCard from '@/components/MaterialCard';
import ConflictAlert from '@/components/ConflictAlert';
import RemarkTimeline from '@/components/RemarkTimeline';
import StatusChangeModal from '@/components/StatusChangeModal';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  detectConflicts,
  getMaterialByType,
  getMaterialStatusText,
  hasConflicts,
  hasAllMaterials,
  exportToCSV,
  downloadCSV,
  getExportFilename,
  getStatusLabel,
} from '@/utils';
import type { RedemptionStatus, MaterialType } from '@/types';
import { STATUS_LABELS } from '@/data/constants';

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById, changeStatus, rollbackStatus, addRemark, initialize } = useRedemptionStore();

  const [redemption, setRedemption] = useState(getById(id || ''));
  const [newRemark, setNewRemark] = useState('');
  const [showStatusModal, setShowStatusModal] = useState<{
    open: boolean;
    targetStatus: RedemptionStatus | null;
    title: string;
  }>({ open: false, targetStatus: null, title: '' });
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [activeTab, setActiveTab] = useState<'materials' | 'remarks' | 'logs'>('materials');

  useEffect(() => {
    initialize();
    if (id) {
      setRedemption(getById(id));
    }
  }, [id, getById, initialize]);

  useEffect(() => {
    if (id) {
      const interval = setInterval(() => {
        setRedemption(getById(id));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [id, getById]);

  const conflicts = useMemo(() => {
    if (!redemption) return [];
    return detectConflicts(redemption.materials);
  }, [redemption]);

  const materialTypes: MaterialType[] = ['receipt', 'refund', 'email', 'import'];

  if (!redemption) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>未找到该记录</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-4">
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const handleAddRemark = () => {
    if (!newRemark.trim()) return;
    addRemark(redemption.id, newRemark.trim());
    setNewRemark('');
  };

  const handleStatusChange = (status: RedemptionStatus, reason: string) => {
    changeStatus(redemption.id, status, reason);
  };

  const handleRollback = () => {
    if (!rollbackReason.trim()) {
      alert('请填写回退原因');
      return;
    }
    rollbackStatus(redemption.id, rollbackReason.trim());
    setShowRollbackModal(false);
    setRollbackReason('');
  };

  const handleExportSingle = () => {
    const content = exportToCSV([redemption], 'all');
    if (content) {
      downloadCSV(content, `基金赎回预约排队_${redemption.fundCode}_${formatDate(new Date().toISOString(), 'yyyyMMdd')}.csv`);
    }
  };

  const openStatusModal = (targetStatus: RedemptionStatus, title: string) => {
    setShowStatusModal({ open: true, targetStatus, title });
  };

  const canConfirm = redemption.status !== 'confirmed';
  const canPending = redemption.status !== 'pending';
  const canManual = redemption.status !== 'manual';
  const canRollback = !!redemption.previousStatus;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-primary-700 font-display flex items-center gap-3">
                  {redemption.fundCode}
                  <span className="text-base text-gray-600 font-normal">{redemption.fundName}</span>
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <StatusBadge status={redemption.status} />
                  <span className="text-sm text-gray-500">
                    申请金额：<span className="font-medium text-currency">{formatCurrency(redemption.applyAmount)}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canRollback && (
                <button
                  onClick={() => setShowRollbackModal(true)}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  <Undo2 className="w-4 h-4" />
                  回退到{getStatusLabel(redemption.previousStatus!)}
                </button>
              )}
              <button
                onClick={handleExportSingle}
                className="btn-secondary flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                导出本条
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-6 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">申请日期</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(redemption.applyDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">预计到账日</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(redemption.expectArriveDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">申请人</p>
              <p className="text-sm font-medium text-gray-900">{redemption.applicant}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">材料情况</p>
              <p className={`text-sm font-medium ${
                !hasAllMaterials(redemption.materials)
                  ? 'text-status-pending'
                  : hasConflicts(redemption.materials)
                  ? 'text-status-manual'
                  : 'text-status-confirmed'
              }`}>
                {getMaterialStatusText(redemption.materials)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">基金赎回预约排队原因</p>
              <p className="text-sm font-medium text-primary-700">{redemption.queueReason}</p>
            </div>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="mb-6">
            <ConflictAlert conflicts={conflicts} />
          </div>
        )}

        <div className="flex gap-3 mb-4">
          {(['materials', 'remarks', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                activeTab === tab
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {tab === 'materials' && <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" />材料对照</span>}
              {tab === 'remarks' && <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" />备注记录 ({redemption.remarks.length})</span>}
              {tab === 'logs' && <span className="flex items-center gap-1.5"><History className="w-4 h-4" />操作日志 ({redemption.operationLogs.length})</span>}
            </button>
          ))}
        </div>

        {activeTab === 'materials' && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {materialTypes.map((type) => (
              <MaterialCard
                key={type}
                material={getMaterialByType(redemption.materials, type)}
                type={type}
                hasConflict={hasConflicts(redemption.materials)}
              />
            ))}
          </div>
        )}

        {activeTab === 'remarks' && (
          <div className="card mb-6">
            <div className="p-4">
              <div className="flex gap-3 mb-6">
                <textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="补充一条备注，比如：刚和渠道通完电话，确认金额无误..."
                  className="textarea-field flex-1 h-20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleAddRemark();
                    }
                  }}
                />
                <button
                  onClick={handleAddRemark}
                  disabled={!newRemark.trim()}
                  className="btn-primary self-end flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  保存
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-4">提示：按 Ctrl+Enter 快速保存</p>
              <RemarkTimeline remarks={redemption.remarks} />
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="card mb-6">
            <div className="p-4">
              <div className="relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {redemption.operationLogs.map((log) => (
                    <div key={log.id} className="relative pl-8">
                      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center ${
                        log.action === 'confirm' ? 'bg-green-100' :
                        log.action === 'pending' ? 'bg-amber-100' :
                        log.action === 'manual' ? 'bg-orange-100' :
                        'bg-gray-100'
                      }`}>
                        {log.action === 'confirm' && <CheckCircle className="w-3 h-3 text-green-600" />}
                        {log.action === 'pending' && <Clock className="w-3 h-3 text-amber-600" />}
                        {log.action === 'manual' && <AlertTriangle className="w-3 h-3 text-orange-600" />}
                        {log.action === 'rollback' && <Undo2 className="w-3 h-3 text-gray-600" />}
                      </div>
                      <div className="bg-gray-50 rounded p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-primary-700">{log.operator}</span>
                            <span className="text-xs text-gray-400">
                              {log.action === 'rollback'
                                ? `回退：${STATUS_LABELS[log.fromStatus!]} → ${STATUS_LABELS[log.toStatus]}`
                                : `改判：${log.fromStatus ? STATUS_LABELS[log.fromStatus] + ' → ' : ''}${STATUS_LABELS[log.toStatus]}`
                              }
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          <span className="text-gray-400">原因：</span>
                          {log.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-primary-700">状态改判</h3>
            <p className="text-sm text-gray-500 mt-1">
              根据核对结果，选择合适的状态。改判时请务必填写原因，方便后续追溯。
            </p>
          </div>
          <div className="p-4 flex items-center gap-4">
            <button
              onClick={() => openStatusModal('confirmed', '确认为"已确认"状态')}
              disabled={!canConfirm}
              className="btn-success flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex-1 py-3"
            >
              <CheckCircle className="w-4 h-4" />
              材料齐全，确认入账
            </button>
            <button
              onClick={() => openStatusModal('pending', '标记为"待补材料"状态')}
              disabled={!canPending}
              className="btn-warning flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex-1 py-3"
            >
              <Clock className="w-4 h-4" />
              缺凭证，先挂起待补
            </button>
            <button
              onClick={() => openStatusModal('manual', '标记为"人工改判"状态')}
              disabled={!canManual}
              className="btn-danger flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex-1 py-3"
            >
              <AlertTriangle className="w-4 h-4" />
              有冲突，人工改判
            </button>
          </div>
        </div>
      </main>

      {showStatusModal.open && showStatusModal.targetStatus && (
        <StatusChangeModal
          isOpen={showStatusModal.open}
          onClose={() => setShowStatusModal({ open: false, targetStatus: null, title: '' })}
          onConfirm={handleStatusChange}
          currentStatus={redemption.status}
          targetStatus={showStatusModal.targetStatus}
          title={showStatusModal.title}
        />
      )}

      {showRollbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-md shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-lg text-primary-700">
                回退到{getStatusLabel(redemption.previousStatus!)}
              </h3>
              <button
                onClick={() => setShowRollbackModal(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <Undo2 className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">当前状态：</span>
                  <span className="font-medium">{STATUS_LABELS[redemption.status]}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-gray-500">回退到：</span>
                  <span className="font-medium text-primary-600">
                    {STATUS_LABELS[redemption.previousStatus!]}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  回退原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="请说明回退原因，如：发现之前判断有误、收到新的凭证材料等"
                  className="textarea-field h-24"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button onClick={() => setShowRollbackModal(false)} className="btn-secondary">
                取消
              </button>
              <button onClick={handleRollback} className="btn-primary">
                确认回退
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
