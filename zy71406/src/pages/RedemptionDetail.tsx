import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Send,
  Download,
  Database,
  FileSpreadsheet,
  Edit3,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import StatusBadge from '@/components/StatusBadge';
import ConflictBadge from '@/components/ConflictBadge';
import { formatDate, formatDateTime, formatNumber, formatMoney } from '@/utils/format';
import { STATUS_TRANSITIONS, type ApplicationStatus } from '@/types';
import { cn } from '@/lib/utils';

export default function RedemptionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    getApplicationById,
    getPositionForApplication,
    getAnnouncementForApplication,
    getConflictRecordsForApplication,
    getStatusLogsForApplication,
    updateApplicationStatus,
    updateConflictJudgment,
    currentOperator,
    exportData,
  } = useStore();

  const [statusRemark, setStatusRemark] = useState('');
  const [showStatusModal, setShowStatusModal] = useState<ApplicationStatus | null>(null);
  const [judgmentInputs, setJudgmentInputs] = useState<Record<string, string>>({});

  const application = id ? getApplicationById(id) : undefined;
  const position = id ? getPositionForApplication(id) : undefined;
  const announcement = id ? getAnnouncementForApplication(id) : undefined;
  const conflictRecords = id ? getConflictRecordsForApplication(id) : [];
  const statusLogs = id ? getStatusLogsForApplication(id) : [];

  const availableTransitions = useMemo(() => {
    if (!application) return [];
    return STATUS_TRANSITIONS[application.applicationStatus] || [];
  }, [application]);

  const handleStatusChange = (newStatus: ApplicationStatus) => {
    if (!id) return;
    const success = updateApplicationStatus(id, newStatus, statusRemark || undefined);
    if (success) {
      setShowStatusModal(null);
      setStatusRemark('');
    }
  };

  const handleJudgmentSubmit = (conflictId: string) => {
    const judgment = judgmentInputs[conflictId];
    if (!judgment?.trim()) return;
    updateConflictJudgment(conflictId, judgment.trim(), currentOperator);
    setJudgmentInputs((prev) => ({ ...prev, [conflictId]: '' }));
  };

  const handleExport = () => {
    if (!application) return;
    const item = {
      applicationId: application.applicationId,
      bondCode: application.bondCode,
      bondName: position?.bondName || '',
      customerId: application.customerId,
      customerName: application.customerName,
      positionQuantity: position?.positionQuantity || 0,
      applyQuantity: application.applyQuantity,
      announcementExerciseDate: announcement?.exerciseDate || '',
      applyExerciseDate: application.applyExerciseDate,
      applicationStatus: application.applicationStatus,
      isWithdrawn: application.isWithdrawn,
      conflicts: conflictRecords.map((c) => c.conflictType),
      latestAnnouncementVersion: announcement?.versionNo || 'V1.0',
      lastUpdateTime: application.updateTime,
    };
    exportData([item]);
  };

  if (!application || !position || !announcement) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-neutral-500">
        <FileText className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg">未找到该申请记录</p>
        <button
          onClick={() => navigate('/redemption-list')}
          className="mt-4 btn-accent gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          返回名单
        </button>
      </div>
    );
  }

  const isDateMismatch = conflictRecords.some((c) => c.conflictType === 'exercise_date_mismatch');
  const isPositionInsufficient = conflictRecords.some((c) => c.conflictType === 'insufficient_position');
  const isWithdrawnConflict = conflictRecords.some((c) => c.conflictType === 'withdrawn_still_in_list');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/redemption-list')}
            className="p-2 text-neutral-500 hover:text-primary-700 hover:bg-neutral-100 rounded transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-display font-semibold text-primary-900">
              {position.bondName}
              <span className="ml-3 text-lg font-mono text-neutral-500 font-normal">
                {position.bondCode}
              </span>
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              客户：{application.customerName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={application.applicationStatus} />
          <button onClick={handleExport} className="btn-outline gap-2">
            <Download className="w-4 h-4" />
            导出详情
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-200">
            <Database className="w-5 h-5 text-primary-600" />
            <h3 className="font-medium text-neutral-800">客户持仓（主信息）</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">债券代码</span>
              <span className="font-mono text-sm text-primary-700">{position.bondCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">债券名称</span>
              <span className="text-sm font-medium">{position.bondName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">客户名称</span>
              <span className="text-sm" title={position.customerName}>
                {position.customerName.length > 10
                  ? `${position.customerName.slice(0, 10)}...`
                  : position.customerName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">持仓数量</span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  isPositionInsufficient && 'text-conflict-position font-medium'
                )}
              >
                {formatNumber(position.positionQuantity)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">持仓日期</span>
              <span className="font-mono text-sm tabular-nums">
                {formatDate(position.positionDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">持仓来源</span>
              <span className="text-sm">{position.positionSource}</span>
            </div>
          </div>
        </div>

        <div className={cn('card p-5', isDateMismatch && 'ring-2 ring-conflict-date/30')}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-accent-600" />
              <h3 className="font-medium text-neutral-800">回售公告</h3>
            </div>
            <span className="font-mono text-xs text-neutral-500">
              {announcement.versionNo}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">公告编号</span>
              <span className="font-mono text-xs">{announcement.announcementId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">行权日</span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  isDateMismatch && 'text-conflict-date font-medium'
                )}
              >
                {formatDate(announcement.exerciseDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">行权价格</span>
              <span className="font-mono tabular-nums">
                {formatMoney(announcement.exercisePrice)} 元
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">公告日期</span>
              <span className="font-mono text-sm tabular-nums">
                {formatDate(announcement.announcementDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">版本数量</span>
              <span className="font-mono text-sm">{announcement.versions.length} 个</span>
            </div>
            {isDateMismatch && (
              <div className="mt-2 p-2 bg-conflict-date/10 border border-conflict-date/20 rounded">
                <p className="text-xs text-conflict-date">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  公告行权日与申请不一致
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            'card p-5',
            isWithdrawnConflict && 'ring-2 ring-conflict-withdrawn/30'
          )}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-accent-600" />
              <h3 className="font-medium text-neutral-800">行权申请</h3>
            </div>
            <StatusBadge status={application.applicationStatus} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">申请编号</span>
              <span className="font-mono text-xs">{application.applicationId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">申请数量</span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  isPositionInsufficient && 'text-conflict-position font-medium'
                )}
              >
                {formatNumber(application.applyQuantity)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">申请行权日</span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  isDateMismatch && 'text-conflict-date font-medium'
                )}
              >
                {formatDate(application.applyExerciseDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">是否撤回</span>
              <span
                className={cn(
                  'text-sm',
                  application.isWithdrawn
                    ? 'text-conflict-withdrawn font-medium'
                    : 'text-success-600'
                )}
              >
                {application.isWithdrawn ? '是' : '否'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">创建时间</span>
              <span className="font-mono text-xs tabular-nums">
                {formatDateTime(application.createTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">更新时间</span>
              <span className="font-mono text-xs tabular-nums">
                {formatDateTime(application.updateTime)}
              </span>
            </div>
            {isWithdrawnConflict && (
              <div className="mt-2 p-2 bg-conflict-withdrawn/10 border border-conflict-withdrawn/20 rounded">
                <p className="text-xs text-conflict-withdrawn">
                  <XCircle className="w-3 h-3 inline mr-1" />
                  申请已撤回但仍在名单中
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {conflictRecords.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 bg-neutral-50 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-conflict-date" />
                  <h3 className="font-medium text-neutral-800">冲突留痕</h3>
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-conflict-date/10 text-conflict-date">
                    {conflictRecords.length} 项
                  </span>
                </div>
              </div>
              <div className="divide-y divide-neutral-200">
                {conflictRecords.map((record) => (
                  <div key={record.conflictId} className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <ConflictBadge type={record.conflictType} />
                      <span className="text-xs text-neutral-400 font-mono tabular-nums">
                        {formatDateTime(record.createTime)}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-700 mb-2">{record.conflictDetail}</p>
                    <div className="bg-accent-50 border border-accent-200 rounded p-3 mb-3">
                      <p className="text-xs text-accent-700">
                        <span className="font-medium">系统建议：</span>
                        {record.systemSuggestion}
                      </p>
                    </div>
                    {record.manualJudgment ? (
                      <div className="bg-success-500/5 border border-success-500/20 rounded p-3">
                        <p className="text-xs text-success-600">
                          <span className="font-medium">人工判断：</span>
                          {record.manualJudgment}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          处理人：{record.operator} · {formatDateTime(record.createTime)}
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={judgmentInputs[record.conflictId] || ''}
                          onChange={(e) =>
                            setJudgmentInputs((prev) => ({
                              ...prev,
                              [record.conflictId]: e.target.value,
                            }))
                          }
                          placeholder="请输入人工判断意见..."
                          className="flex-1 input-field text-sm"
                        />
                        <button
                          onClick={() => handleJudgmentSubmit(record.conflictId)}
                          disabled={!judgmentInputs[record.conflictId]?.trim()}
                          className="btn-accent gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                          提交
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-5 py-4 bg-neutral-50 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-600" />
                <h3 className="font-medium text-neutral-800">状态流转</h3>
              </div>
            </div>
            <div className="p-5">
              <div className="relative">
                {statusLogs.map((log, index) => (
                  <div key={log.logId} className="flex gap-4 pb-6 last:pb-0">
                    <div className="relative flex flex-col items-center">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white z-10',
                          index === statusLogs.length - 1
                            ? 'border-accent-500 bg-accent-50'
                            : 'border-neutral-300'
                        )}
                      >
                        {log.toStatus === 'withdrawn' ? (
                          <XCircle
                            className={cn(
                              'w-4 h-4',
                              index === statusLogs.length - 1
                                ? 'text-conflict-withdrawn'
                                : 'text-neutral-400'
                            )}
                          />
                        ) : log.toStatus === 'exercised' ? (
                          <CheckCircle2
                            className={cn(
                              'w-4 h-4',
                              index === statusLogs.length - 1
                                ? 'text-success-600'
                                : 'text-neutral-400'
                            )}
                          />
                        ) : (
                          <Clock
                            className={cn(
                              'w-4 h-4',
                              index === statusLogs.length - 1
                                ? 'text-accent-500'
                                : 'text-neutral-400'
                            )}
                          />
                        )}
                      </div>
                      {index < statusLogs.length - 1 && (
                        <div className="w-0.5 h-full bg-neutral-200 absolute top-8" />
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={log.toStatus} />
                        {log.fromStatus && (
                          <span className="text-xs text-neutral-400">
                            ← {log.fromStatus}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 mb-1">
                        <User className="w-3 h-3 inline mr-1" />
                        {log.operator}
                      </p>
                      <p className="text-xs text-neutral-400 font-mono tabular-nums">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {formatDateTime(log.changeTime)}
                      </p>
                      {log.remark && (
                        <p className="text-sm text-neutral-500 mt-2 bg-neutral-50 p-2 rounded">
                          {log.remark}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {availableTransitions.length > 0 && (
                <div className="mt-6 pt-6 border-t border-neutral-200">
                  <p className="text-sm text-neutral-500 mb-3">可操作状态变更：</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTransitions.map((status) => (
                      <button
                        key={status}
                        onClick={() => setShowStatusModal(status)}
                        className={cn(
                          'btn gap-2',
                          status === 'withdrawn' ? 'btn-danger' : 'btn-accent'
                        )}
                      >
                        {status === 'withdrawn' ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        标记为
                        {status === 'confirmed' && '已确认'}
                        {status === 'exercised' && '已行权'}
                        {status === 'withdrawn' && '已撤回'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 bg-neutral-50 border-b border-neutral-200">
              <h3 className="font-medium text-neutral-800">公告版本历史</h3>
            </div>
            <div className="divide-y divide-neutral-200 max-h-80 overflow-y-auto scrollbar-thin">
              {announcement.versions.map((version, index) => (
                <div key={version.versionId} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-medium text-primary-700">
                      {version.versionNo}
                    </span>
                    {index === announcement.versions.length - 1 && (
                      <span className="tag bg-accent-100 text-accent-700 border-accent-300 text-xs">
                        当前版本
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mb-2">
                    发布日期：{formatDate(version.publishDate)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    操作人：{version.operator}
                  </p>
                  {Object.keys(version.contentDiff).length > 0 && (
                    <div className="mt-2 p-2 bg-neutral-50 rounded text-xs">
                      <p className="text-neutral-500 mb-1">变更内容：</p>
                      {Object.entries(version.contentDiff).map(([key, value]) => (
                        <div key={key} className="text-neutral-600">
                          <span className="font-medium">{key}：</span>
                          <span className="line-through text-neutral-400">
                            {String(value.old)}
                          </span>{' '}
                          → <span className="text-accent-600">{String(value.new)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
              <h3 className="text-lg font-medium text-neutral-900">
                确认状态变更
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-neutral-600 mb-4">
                即将将申请状态变更为{' '}
                <StatusBadge status={showStatusModal} />
              </p>
              <div className="mb-4">
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                  备注（可选）
                </label>
                <textarea
                  value={statusRemark}
                  onChange={(e) => setStatusRemark(e.target.value)}
                  placeholder="请输入变更原因..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              {showStatusModal === 'withdrawn' && (
                <div className="bg-conflict-withdrawn/5 border border-conflict-withdrawn/20 rounded p-3 mb-4">
                  <p className="text-xs text-conflict-withdrawn">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    撤回操作不可逆，请谨慎操作
                  </p>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowStatusModal(null);
                    setStatusRemark('');
                  }}
                  className="btn-outline"
                >
                  取消
                </button>
                <button
                  onClick={() => handleStatusChange(showStatusModal)}
                  className={cn(
                    'btn',
                    showStatusModal === 'withdrawn' ? 'btn-danger' : 'btn-accent'
                  )}
                >
                  确认变更
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
