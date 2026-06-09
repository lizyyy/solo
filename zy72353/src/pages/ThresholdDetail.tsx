import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  AlertTriangle,
  Cpu,
  Tag,
  User,
  Clock,
  Box,
  FileText,
  Package,
  Download,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertOctagon,
  UserCheck,
} from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';
import HistoryTimeline from '../components/HistoryTimeline';
import WorkflowProgress from '../components/WorkflowProgress';
import ManualReviewModal from '../components/ManualReviewModal';
import { cn } from '../lib/utils';

const ThresholdDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    thresholds,
    getDeviceById,
    getThresholdHistory,
    updateThreshold,
    currentRole,
    getReportByThresholdId,
    getBatchById,
    getManualReviewByThresholdId,
    verifyConsistency,
    exportThreshold,
    exportReport,
    workflowTasks,
    advanceWorkflow,
  } = useThresholdStore();

  const threshold = thresholds.find((t) => t.id === id);
  const device = threshold ? getDeviceById(threshold.deviceId) : undefined;
  const history = id ? getThresholdHistory(id) : [];
  const report = id ? getReportByThresholdId(id) : undefined;
  const batch = threshold?.importBatchId ? getBatchById(threshold.importBatchId) : undefined;
  const review = id ? getManualReviewByThresholdId(id) : undefined;
  const consistency = id ? verifyConsistency(id) : null;

  const workflowTask = useMemo(
    () => workflowTasks.find((t) => t.thresholdId === id),
    [workflowTasks, id]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editRemark, setEditRemark] = useState(threshold?.remark || '');
  const [editReason, setEditReason] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'warning' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  if (!threshold) {
    return (
      <div className="text-center py-16">
        <p className="text-industrial-300 text-lg">未找到该阈值数据</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-primary-400 hover:text-primary-300"
        >
          返回列表
        </button>
      </div>
    );
  }

  const handleSave = () => {
    if (id) {
      updateThreshold(
        id,
        { remark: editRemark },
        editReason || '修改备注',
        { createManualReview: true, reviewType: 'remark_change' }
      );
      setIsEditing(false);
      setEditReason('');
      showToast('备注已修改，已提交教练复核');
    }
  };

  const handleAdvance = () => {
    if (!workflowTask) return;
    if (
      threshold.hasUnitMix &&
      review &&
      review.decision === 'pending'
    ) {
      const ok = window.confirm(
        '⚠️ 存在未复核的单位混用，按流程应先交教练复核，是否仍推进？'
      );
      if (!ok) return;
    }
    advanceWorkflow(workflowTask.id);
    showToast('工作流已推进');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatUnit = (unit: string) => {
    return unit === 'Celsius' ? '℃' : 'K';
  };

  const currentStep = threshold.status === 'approved' ? 'report' :
    threshold.status === 'reviewing' ? 'coach_review' : 'engineer_review';

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={cn(
            'fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-xl border animate-pulse',
            toast.type === 'success'
              ? 'bg-success-500/20 text-success-400 border-success-500/30'
              : 'bg-warning-500/20 text-warning-400 border-warning-500/30'
          )}
        >
          {toast.msg}
        </div>
      )}

      {consistency && (
        <div
          className={cn(
            'rounded-xl border p-4',
            consistency.ok
              ? 'bg-success-500/10 border-success-500/30'
              : 'bg-warning-500/10 border-warning-500/30'
          )}
        >
          <div className="flex items-start gap-3">
            {consistency.ok ? (
              <CheckCircle className="w-5 h-5 text-success-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertOctagon className="w-5 h-5 text-warning-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={cn(
                  'font-semibold',
                  consistency.ok ? 'text-success-400' : 'text-warning-400'
                )}
              >
                {consistency.ok ? '状态一致 ✓' : `一致性检查发现 ${consistency.issues.length} 个问题`}
              </p>
              {!consistency.ok && (
                <ul className="mt-2 space-y-1">
                  {consistency.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-warning-300">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-industrial-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回列表
        </button>
        <div className="h-6 w-px bg-industrial-500" />
        <h1 className="text-2xl font-bold text-white">阈值详情</h1>
        {threshold.hasUnitMix && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-warning-500/20 text-warning-400 border border-warning-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            单位混用 - 待复核
          </span>
        )}
      </div>

      <WorkflowProgress currentStep={currentStep as any} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">基本信息</h2>
              <div className="flex items-center gap-2">
                {!isEditing && currentRole === 'engineer' && (
                  <button
                    onClick={() => {
                      setEditRemark(threshold.remark);
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-1.5 text-primary-400 hover:text-primary-300 text-sm"
                  >
                    <Edit3 className="w-4 h-4" />
                    编辑备注
                  </button>
                )}
                {workflowTask && workflowTask.status !== 'completed' && (
                  <button
                    onClick={handleAdvance}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    推进工作流
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-industrial-400 text-sm block mb-1.5">阈值名称</label>
                <p className="text-white font-medium">{threshold.name}</p>
              </div>
              <div>
                <label className="text-industrial-400 text-sm block mb-1.5">阈值数值</label>
                <p className="text-white font-mono text-xl">
                  {threshold.value}
                  <span className="text-industrial-300 text-lg ml-1">
                    {formatUnit(threshold.unit)}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-industrial-400 text-sm block mb-1.5">关联设备</label>
                <p className="text-white">{device?.name || '-'}</p>
                <p className="text-industrial-400 text-sm">{device?.model || '-'}</p>
              </div>
              <div>
                <label className="text-industrial-400 text-sm block mb-1.5">当前状态</label>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
                  threshold.status === 'approved' ? "bg-success-500/20 text-success-400 border-success-500/30" :
                  threshold.status === 'reviewing' ? "bg-primary-500/20 text-primary-400 border-primary-500/30" :
                  "bg-warning-500/20 text-warning-400 border-warning-500/30"
                )}>
                  {threshold.status === 'approved' ? '已通过' :
                   threshold.status === 'reviewing' ? '复核中' : '待处理'}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-industrial-500">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-industrial-400 text-sm">备注信息</label>
                {review?.reviewType === 'remark_change' && review.decision === 'pending' && (
                  <span className="text-xs text-warning-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    上一次修改待教练复核
                  </span>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={editRemark}
                    onChange={(e) => setEditRemark(e.target.value)}
                    className="w-full bg-industrial-700 border border-industrial-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500"
                    rows={3}
                    placeholder="输入备注信息..."
                  />
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full bg-industrial-700 border border-industrial-500 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
                    placeholder="修改原因（可选）"
                  />
                  <p className="text-xs text-industrial-400">
                    💡 每次备注修改都会触发教练复核流程
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      保存并提交复核
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-industrial-700 hover:bg-industrial-500 text-industrial-300 rounded-lg text-sm"
                    >
                      <X className="w-4 h-4" />
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-white">{threshold.remark}</p>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-industrial-500 grid grid-cols-2 gap-6">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-industrial-400" />
                <span className="text-industrial-400">创建人：</span>
                <span className="text-white">{threshold.createdBy}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-industrial-400" />
                <span className="text-industrial-400">更新时间：</span>
                <span className="text-white">{formatDate(threshold.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-400" />
                <h2 className="text-lg font-semibold text-white">导入批次信息</h2>
              </div>
            </div>
            {batch ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-industrial-700/50 rounded-lg p-4">
                  <p className="text-industrial-400 text-xs mb-1">批次号</p>
                  <p className="text-white font-mono font-medium">{batch.batchNo}</p>
                </div>
                <div className="bg-industrial-700/50 rounded-lg p-4">
                  <p className="text-industrial-400 text-xs mb-1">来源 / 格式</p>
                  <p className="text-white">
                    {batch.source === 'file' ? '文件导入' :
                     batch.source === 'sample' ? '采样数据' : '手工录入'}
                    {batch.format ? ` · ${batch.format.toUpperCase()}` : ''}
                  </p>
                </div>
                <div className="bg-industrial-700/50 rounded-lg p-4">
                  <p className="text-industrial-400 text-xs mb-1">文件名</p>
                  <p className="text-white">{batch.fileName || '-'}</p>
                </div>
                <div className="bg-industrial-700/50 rounded-lg p-4">
                  <p className="text-industrial-400 text-xs mb-1">导入时间 / 导入人</p>
                  <p className="text-white text-sm">{formatDate(batch.importedAt)}</p>
                  <p className="text-industrial-400 text-xs">{batch.importedBy}</p>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <Package className="w-10 h-10 text-industrial-500 mx-auto mb-2" />
                <p className="text-industrial-400">未关联批次</p>
              </div>
            )}
          </div>

          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary-400" />
                <h2 className="text-lg font-semibold text-white">人工审核记录</h2>
              </div>
            </div>
            {review ? (
              <div>
                <div
                  className={cn(
                    'rounded-lg p-4 border',
                    review.decision === 'confirmed'
                      ? 'bg-success-500/10 border-success-500/30'
                      : review.decision === 'rejected'
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-warning-500/10 border-warning-500/30'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {review.decision === 'confirmed' ? (
                        <CheckCircle className="w-5 h-5 text-success-400" />
                      ) : review.decision === 'rejected' ? (
                        <XCircle className="w-5 h-5 text-red-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-warning-400" />
                      )}
                      <span
                        className={cn(
                          'font-semibold',
                          review.decision === 'confirmed'
                            ? 'text-success-400'
                            : review.decision === 'rejected'
                            ? 'text-red-400'
                            : 'text-warning-400'
                        )}
                      >
                        {review.decision === 'confirmed'
                          ? '复核通过 - 已确认'
                          : review.decision === 'rejected'
                          ? '复核拒绝'
                          : '待人工复核'}
                      </span>
                      <span className="text-xs text-industrial-400 bg-industrial-700/50 px-2 py-0.5 rounded">
                        {review.reviewType === 'unit_mix'
                          ? '单位混用'
                          : review.reviewType === 'remark_change'
                          ? '备注变更'
                          : review.reviewType === 'value_anomaly'
                          ? '数值异常'
                          : '其他'}
                      </span>
                    </div>
                    {review.decision === 'pending' && (
                      <button
                        onClick={() => setShowReviewModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-warning-500 hover:bg-warning-600 text-white rounded-lg text-sm font-medium"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        立即复核
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-industrial-400 text-xs mb-1">原始值</p>
                      <p className="text-white font-mono">
                        {review.originalValue}
                        {review.originalUnit ? ` ${formatUnit(review.originalUnit)}` : ''}
                      </p>
                    </div>
                    {review.modifiedValue !== undefined && (
                      <div>
                        <p className="text-industrial-400 text-xs mb-1">确认值</p>
                        <p className="text-white font-mono">
                          {review.modifiedValue}
                          {review.modifiedUnit ? ` ${formatUnit(review.modifiedUnit)}` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="bg-industrial-700/30 rounded p-3 mb-3">
                    <p className="text-industrial-400 text-xs mb-1">复核说明</p>
                    <p className="text-white text-sm">{review.reason}</p>
                  </div>
                  {review.decision !== 'pending' && (
                    <div className="flex items-center gap-4 text-xs pt-2 border-t border-white/10">
                      <div className="flex items-center gap-1.5 text-industrial-300">
                        <User className="w-3.5 h-3.5" />
                        {review.reviewedBy}
                      </div>
                      <div className="flex items-center gap-1.5 text-industrial-400">
                        <Clock className="w-3.5 h-3.5" />
                        {review.reviewedAt ? formatDate(review.reviewedAt) : '-'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : threshold.hasUnitMix ? (
              <div className="py-6 text-center bg-warning-500/5 rounded-lg border border-warning-500/20">
                <AlertTriangle className="w-10 h-10 text-warning-400 mx-auto mb-2" />
                <p className="text-warning-400 font-medium mb-2">待人工复核</p>
                <p className="text-industrial-400 text-sm mb-3">存在单位混用，需教练确认铭牌单位</p>
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-warning-500 hover:bg-warning-600 text-white rounded-lg text-sm font-medium mx-auto"
                >
                  <UserCheck className="w-4 h-4" />
                  打开人工复核
                </button>
              </div>
            ) : (
              <div className="py-6 text-center">
                <CheckCircle className="w-10 h-10 text-industrial-500 mx-auto mb-2" />
                <p className="text-industrial-400">暂无人工复核记录</p>
              </div>
            )}
          </div>

          {threshold.calculationModel && (
            <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-5 h-5 text-primary-400" />
                <h2 className="text-lg font-semibold text-white">计算模型</h2>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-industrial-400 text-sm block mb-1.5">模型名称</label>
                  <p className="text-white font-mono">{threshold.calculationModel}</p>
                </div>
                <div>
                  <label className="text-industrial-400 text-sm block mb-1.5">版本号</label>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-success-400" />
                    <span className="text-white font-mono">{threshold.modelVersion}</span>
                  </div>
                </div>
              </div>
              {threshold.tradeOffReason && (
                <div className="mt-4 pt-4 border-t border-industrial-500">
                  <label className="text-industrial-400 text-sm block mb-1.5">取舍理由</label>
                  <p className="text-white bg-industrial-700/50 rounded-lg p-3">
                    {threshold.tradeOffReason}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <h2 className="text-lg font-semibold text-white mb-6">历史变更记录</h2>
            <HistoryTimeline records={history} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-5 h-5 text-primary-400" />
              <h3 className="text-white font-semibold">数据导出</h3>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  exportThreshold(threshold.id);
                  showToast('阈值数据已导出');
                }}
                className="flex items-center gap-2 w-full px-4 py-3 bg-primary-500/20 hover:bg-primary-500/30 border border-primary-500/30 text-primary-400 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                导出此阈值
              </button>
              {report && (
                <button
                  onClick={() => {
                    exportReport(report.id);
                    showToast('报告已导出');
                  }}
                  className="flex items-center gap-2 w-full px-4 py-3 bg-success-500/20 hover:bg-success-500/30 border border-success-500/30 text-success-400 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  如果有报告也导出报告
                </button>
              )}
            </div>
            {(threshold.exportTraceId || report?.exportTraceId) && (
              <div className="mt-4 pt-4 border-t border-industrial-500">
                <p className="text-industrial-400 text-xs mb-1">导出追踪 ID</p>
                {threshold.exportTraceId && (
                  <p className="text-white text-xs font-mono bg-industrial-700/50 p-2 rounded mb-1 break-all">
                    阈值: {threshold.exportTraceId}
                  </p>
                )}
                {report?.exportTraceId && (
                  <p className="text-white text-xs font-mono bg-industrial-700/50 p-2 rounded break-all">
                    报告: {report.exportTraceId}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Box className="w-5 h-5 text-primary-400" />
              <h3 className="text-white font-semibold">设备铭牌参数</h3>
            </div>
            {device ? (
              <div className="space-y-4">
                <div className="bg-industrial-700/50 rounded-lg p-4">
                  <p className="text-industrial-400 text-xs mb-1">设备名称</p>
                  <p className="text-white font-medium">{device.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-industrial-700/50 rounded-lg p-3">
                    <p className="text-industrial-400 text-xs mb-1">型号</p>
                    <p className="text-white text-sm">{device.model}</p>
                  </div>
                  <div className="bg-industrial-700/50 rounded-lg p-3">
                    <p className="text-industrial-400 text-xs mb-1">制造商</p>
                    <p className="text-white text-sm">{device.manufacturer}</p>
                  </div>
                </div>
                <div className="bg-primary-500/10 rounded-lg p-4 border border-primary-500/30">
                  <p className="text-primary-400 text-xs mb-1">额定温度</p>
                  <p className="text-white font-mono text-xl">
                    {device.nameplateParams.ratedTemperature}
                    <span className="text-industrial-300 text-lg ml-1">
                      {formatUnit(device.nameplateParams.temperatureUnit)}
                    </span>
                  </p>
                  <p className="text-industrial-400 text-xs mt-1">
                    序列号：{device.nameplateParams.serialNumber}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-industrial-400 text-sm">暂无设备信息</p>
            )}
          </div>

          {report && (
            <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-success-400" />
                <h3 className="text-white font-semibold">交接报告</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-industrial-400 text-xs mb-1">内容摘要</p>
                  <p className="text-white text-sm">{report.content}</p>
                </div>
                <div>
                  <p className="text-industrial-400 text-xs mb-1">留存原因</p>
                  <p className="text-white text-sm">{report.retentionReason}</p>
                </div>
                {report.missingMaterials.length > 0 && (
                  <div>
                    <p className="text-industrial-400 text-xs mb-2">缺少材料</p>
                    <ul className="space-y-1">
                      {report.missingMaterials.map((m, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-warning-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="pt-3 border-t border-industrial-500">
                  <p className="text-industrial-400 text-xs mb-1">下一步行动</p>
                  <p className="text-white text-sm">{report.nextAction}</p>
                  <p className="text-primary-400 text-xs mt-1">
                    对接人：{report.assigneeRole === 'engineer' ? '设备工程师 何工' : '训练教练'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-industrial-600 rounded-xl border border-industrial-500 p-6">
            <h3 className="text-white font-semibold mb-4">快捷操作</h3>
            <div className="space-y-2">
              <Link
                to={`/visualization?highlight=${threshold.id}`}
                className="flex items-center gap-2 w-full px-4 py-3 bg-industrial-700 hover:bg-industrial-500 text-white rounded-lg transition-colors"
              >
                <Box className="w-4 h-4" />
                查看 3D 可视化
              </Link>
              <Link
                to="/workflow"
                className="flex items-center gap-2 w-full px-4 py-3 bg-industrial-700 hover:bg-industrial-500 text-white rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                查看工作流
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ManualReviewModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        thresholdId={id}
      />
    </div>
  );
};

export default ThresholdDetail;
