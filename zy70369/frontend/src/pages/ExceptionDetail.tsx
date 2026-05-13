import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  FileText,
  CreditCard,
  Package,
  Truck,
  Ticket,
  Clock,
  History,
  User,
  X,
  ChevronRight
} from 'lucide-react';
import { exceptionApi, exportApi } from '../services/api';
import type {
  ExceptionDetail as ExceptionDetailType,
  ActionType,
  ArbitrationAction
} from '../types';
import {
  EXCEPTION_TYPE_LABELS,
  ACTION_TYPE_LABELS,
  ACTION_STATUS_LABELS,
  EVIDENCE_TYPE_LABELS
} from '../types';

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatAmount(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

const evidenceIcons: Record<string, any> = {
  PAYMENT: CreditCard,
  INVENTORY: Package,
  LOGISTICS: Truck,
  DISCOUNT: Ticket
};

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  actionType: ActionType;
  highRisk: boolean;
}

function ActionModal({ isOpen, onClose, onConfirm, actionType, highRisk }: ActionModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            确认执行{ACTION_TYPE_LABELS[actionType]}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {highRisk && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700">
                这是一个高风险操作，执行后可能无法撤销。请确认已核查所有相关证据。
              </p>
            </div>
          </div>
        )}

        {actionType === 'CLOSE' && (
          <div className="space-y-2 mb-4">
            <label className="block text-sm font-medium text-gray-700">
              关闭原因
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入关闭原因..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium text-sm transition-colors ${
              highRisk
                ? 'bg-danger-600 hover:bg-danger-700'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
}

interface ResolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (resolution: string, reason: string) => void;
}

function ResolveModal({ isOpen, onClose, onConfirm }: ResolveModalProps) {
  const [resolution, setResolution] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const resolutions = [
    { value: '退款完成', label: '退款完成' },
    { value: '补发成功', label: '补发成功' },
    { value: '优惠补偿', label: '优惠补偿' },
    { value: '订单关闭', label: '订单关闭' },
    { value: '继续履约', label: '继续履约' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">完成仲裁</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              处理方案
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">请选择处理方案</option>
              {resolutions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              仲裁原因
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入仲裁原因..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(resolution, reason)}
            disabled={!resolution}
            className="flex-1 px-4 py-2.5 bg-success-600 hover:bg-success-700 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm transition-colors"
          >
            确认完成
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExceptionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ExceptionDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    actionType: ActionType;
    highRisk: boolean;
  } | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const getOperatorId = () => {
    return localStorage.getItem('currentOperatorId') || '';
  };

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await exceptionApi.getDetail(id);
      setDetail(data);
    } catch (error: any) {
      console.error('获取异常详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleLock = async () => {
    if (!id) return;
    try {
      await exceptionApi.lock(id, getOperatorId());
      setMessage({ type: 'success', text: '订单锁定成功' });
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '锁定失败' });
    }
  };

  const handleUnlock = async () => {
    if (!id) return;
    try {
      await exceptionApi.unlock(id, getOperatorId());
      setMessage({ type: 'success', text: '订单解锁成功' });
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '解锁失败' });
    }
  };

  const handleExecuteAction = async (actionType: ActionType, highRisk: boolean) => {
    setActionModal({ isOpen: true, actionType, highRisk });
  };

  const confirmAction = async (reason?: string) => {
    if (!id || !actionModal) return;

    try {
      const result = await exceptionApi.executeAction(
        id,
        actionModal.actionType,
        getOperatorId(),
        undefined,
        reason
      );
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message
      });
      setActionModal(null);
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '执行失败' });
      setActionModal(null);
    }
  };

  const handleRetry = async (action: ArbitrationAction) => {
    if (!id) return;
    try {
      const result = await exceptionApi.retryAction(id, action.id, getOperatorId());
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message
      });
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '重试失败' });
    }
  };

  const handleResolve = async (resolution: string, reason: string) => {
    if (!id) return;
    try {
      await exceptionApi.resolve(id, resolution, reason, getOperatorId());
      setMessage({ type: 'success', text: '仲裁完成' });
      setResolveModalOpen(false);
      fetchData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || '完成失败' });
    }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      window.open(`/api/export/arbitration/${id}/details`, '_blank');
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">未找到异常订单</p>
      </div>
    );
  }

  const { exception, evidences, actions, timeline, evidence_gaps } = detail;
  const isLocked = !!exception.locked_by;
  const isLockedByMe = exception.locked_by === getOperatorId();
  const isResolved = exception.status === 'RESOLVED';
  const canEdit = !isResolved && (isLockedByMe || !isLocked);

  const highRiskActions: ActionType[] = ['REFUND', 'ROLLBACK_FAILED'];

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-success-100 text-success-700'
              : 'bg-danger-100 text-danger-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/exceptions')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          返回列表
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            导出详情
          </button>

          {!isResolved && (
            <>
              {!isLocked ? (
                <button
                  onClick={handleLock}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  锁定处理
                </button>
              ) : isLockedByMe ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg">
                    <Lock className="w-4 h-4 inline mr-1" />
                    已锁定
                  </span>
                  <button
                    onClick={handleUnlock}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                  >
                    <Unlock className="w-4 h-4" />
                    解锁
                  </button>
                </div>
              ) : (
                <span className="text-sm text-danger-700 bg-danger-50 px-3 py-1.5 rounded-lg">
                  <Lock className="w-4 h-4 inline mr-1" />
                  已被 {exception.operator_name} 锁定
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">订单号</div>
          <div className="text-lg font-semibold text-gray-900">{exception.order_no}</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">异常类型</div>
          <div className="text-lg font-semibold text-gray-900">
            {EXCEPTION_TYPE_LABELS[exception.exception_type]}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">订单金额</div>
          <div className="text-lg font-semibold text-gray-900">
            {formatAmount(exception.total_amount)}
          </div>
        </div>
      </div>

      {(evidence_gaps && evidence_gaps.length > 0) || exception.evidence_gap ? (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-warning-800 mb-1">证据缺口</div>
              <p className="text-sm text-warning-700">
                {exception.evidence_gap ||
                  evidence_gaps?.map((g) => EVIDENCE_TYPE_LABELS[g] || g).join('、')}
              </p>
              <p className="text-xs text-warning-600 mt-2">
                注意：证据缺失时无法执行退款、回滚失败等高风险动作
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                证据清单
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {evidences.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无证据</p>
              ) : (
                evidences.map((evidence) => {
                  const Icon = evidenceIcons[evidence.evidence_type] || FileText;
                  return (
                    <div
                      key={evidence.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Icon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {EVIDENCE_TYPE_LABELS[evidence.evidence_type] ||
                                evidence.evidence_type}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDate(evidence.created_at)}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            evidence.is_valid
                              ? 'bg-success-100 text-success-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {evidence.is_valid ? '有效' : '无效'}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                          {JSON.stringify(evidence.evidence_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-600" />
                订单时间线
              </h3>
            </div>
            <div className="p-4">
              {timeline.length === 0 ? (
                <p className="text-gray-500 text-center py-8">暂无时间线</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-4">
                    {timeline.map((event, index) => (
                      <div key={event.id} className="relative pl-14">
                        <div className="absolute left-4 w-4 h-4 rounded-full bg-primary-500 border-4 border-white shadow"></div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900">
                              {event.event_type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(event.created_at)}
                            </span>
                          </div>
                          {event.event_data?.message && (
                            <p className="text-sm text-gray-600">
                              {event.event_data.message}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <User className="w-3 h-3" />
                            {event.operator_name || event.operator}
                          </div>
                          {event.event_data?.retry_available && (
                            <p className="text-xs text-danger-600 mt-1">
                              该操作可重试
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">仲裁动作</h3>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={() => handleExecuteAction('REFUND', true)}
                disabled={!canEdit}
                className="w-full flex items-center justify-between px-4 py-3 bg-danger-50 text-danger-700 rounded-lg hover:bg-danger-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="font-medium">退款</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleExecuteAction('RESEND', false)}
                disabled={!canEdit}
                className="w-full flex items-center justify-between px-4 py-3 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="font-medium">补发</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleExecuteAction('CLOSE', false)}
                disabled={!canEdit}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="font-medium">关闭</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleExecuteAction('CONTINUE_FULFILLMENT', false)}
                disabled={!canEdit}
                className="w-full flex items-center justify-between px-4 py-3 bg-success-50 text-success-700 rounded-lg hover:bg-success-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="font-medium">继续履约</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleExecuteAction('ROLLBACK_FAILED', true)}
                disabled={!canEdit}
                className="w-full flex items-center justify-between px-4 py-3 bg-warning-50 text-warning-700 rounded-lg hover:bg-warning-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="font-medium">回滚失败</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {!isResolved && isLockedByMe && (
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => setResolveModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-success-600 text-white rounded-lg hover:bg-success-700 font-medium transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  完成仲裁
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">执行记录</h3>
            </div>
            <div className="p-4 space-y-3">
              {actions.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">暂无执行记录</p>
              ) : (
                actions.map((action) => (
                  <div
                    key={action.id}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {ACTION_TYPE_LABELS[action.action_type]}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          action.status === 'SUCCESS'
                            ? 'bg-success-100 text-success-700'
                            : action.status === 'FAILED'
                            ? 'bg-danger-100 text-danger-700'
                            : 'bg-warning-100 text-warning-700'
                        }`}
                      >
                        {ACTION_STATUS_LABELS[action.status]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>
                        执行人：{action.executed_by_name || action.executed_by}
                      </div>
                      <div>
                        执行时间：
                        {action.executed_at
                          ? formatDate(action.executed_at)
                          : '-'}
                      </div>
                      {action.retry_count > 0 && (
                        <div className="text-warning-600">
                          重试次数：{action.retry_count}
                        </div>
                      )}
                    </div>
                    {action.last_error && (
                      <div className="mt-2 text-xs text-danger-600 bg-danger-50 rounded p-2">
                        {action.last_error}
                      </div>
                    )}
                    {action.status === 'FAILED' && canEdit && (
                      <button
                        onClick={() => handleRetry(action)}
                        className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-primary-50 text-primary-700 rounded hover:bg-primary-100 text-xs font-medium transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        重试
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {isResolved && (
            <div className="bg-success-50 border border-success-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-success-600" />
                <span className="font-medium text-success-800">仲裁已完成</span>
              </div>
              <div className="text-sm text-success-700 space-y-1">
                <div>处理方案：{exception.resolution}</div>
                <div>仲裁原因：{exception.resolution_reason}</div>
                <div>
                  完成时间：
                  {exception.resolved_at ? formatDate(exception.resolved_at) : '-'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {actionModal && (
        <ActionModal
          isOpen={actionModal.isOpen}
          onClose={() => setActionModal(null)}
          onConfirm={confirmAction}
          actionType={actionModal.actionType}
          highRisk={actionModal.highRisk}
        />
      )}

      <ResolveModal
        isOpen={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        onConfirm={handleResolve}
      />
    </div>
  );
}
