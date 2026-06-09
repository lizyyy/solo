import { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ThermometerSun,
  FileEdit,
  Gauge,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';
import type { ManualReviewRecord, TemperatureUnit } from '../types';
import { cn } from '../lib/utils';

interface ManualReviewModalProps {
  open: boolean;
  onClose: () => void;
  reviewId?: string;
  thresholdId?: string;
}

const reviewTypeConfig: Record<
  ManualReviewRecord['reviewType'],
  { label: string; icon: LucideIcon; color: string }
> = {
  unit_mix: {
    label: '℃/K 单位混用复核',
    icon: ThermometerSun,
    color: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
  },
  remark_change: {
    label: '备注修改复核',
    icon: FileEdit,
    color: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  },
  value_anomaly: {
    label: '数值异常复核',
    icon: Gauge,
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  other: {
    label: '其他复核',
    icon: AlertCircle,
    color: 'bg-industrial-500/20 text-industrial-300 border-industrial-500/30',
  },
};

const formatUnit = (unit?: TemperatureUnit) => {
  if (!unit) return '-';
  return unit === 'Celsius' ? '℃' : 'K';
};

const ManualReviewModal = ({
  open,
  onClose,
  reviewId,
  thresholdId,
}: ManualReviewModalProps) => {
  const {
    manualReviews,
    thresholds,
    getManualReviewByThresholdId,
    processManualReview,
    verifyConsistency,
  } = useThresholdStore();

  const [reason, setReason] = useState('');
  const [modifiedValue, setModifiedValue] = useState('');
  const [modifiedUnit, setModifiedUnit] = useState<TemperatureUnit | ''>('');

  const review = useMemo<ManualReviewRecord | null>(() => {
    if (!open) return null;

    let found: ManualReviewRecord | undefined;

    if (reviewId) {
      found = manualReviews.find((r) => r.id === reviewId);
    }

    if (!found && thresholdId) {
      found = getManualReviewByThresholdId(thresholdId);
    }

    if (found) return found;

    if (thresholdId) {
      const threshold = thresholds.find((t) => t.id === thresholdId);
      if (threshold) {
        return {
          id: `temp-review-${thresholdId}`,
          thresholdId,
          reviewType: threshold.hasUnitMix ? 'unit_mix' : 'other',
          originalValue: String(threshold.originalImportedValue ?? threshold.value),
          originalUnit: threshold.originalImportedUnit ?? threshold.unit,
          modifiedValue: String(threshold.value),
          modifiedUnit: threshold.unit,
          decision: 'pending',
          reason: '',
          reviewedBy: 'system',
          createdAt: new Date().toISOString(),
        };
      }
    }

    return null;
  }, [open, reviewId, thresholdId, manualReviews, getManualReviewByThresholdId, thresholds]);

  const effectiveThresholdId = review?.thresholdId || thresholdId;

  const consistencyResult = useMemo(() => {
    if (!open || !effectiveThresholdId) return null;
    return verifyConsistency(effectiveThresholdId);
  }, [open, effectiveThresholdId, verifyConsistency]);

  useEffect(() => {
    if (open && review) {
      setReason(review.reason || '');
      setModifiedValue(review.modifiedValue || '');
      setModifiedUnit(review.modifiedUnit || '');
    }
  }, [open, review]);

  useEffect(() => {
    if (!open) {
      setReason('');
      setModifiedValue('');
      setModifiedUnit('');
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!review || !reason.trim()) return;
    processManualReview(review.id, 'confirmed', {
      reason: reason.trim(),
      modifiedValue: modifiedValue || undefined,
      modifiedUnit: modifiedUnit || undefined,
    });
    onClose();
  };

  const handleReject = () => {
    if (!review || !reason.trim()) return;
    processManualReview(review.id, 'rejected', {
      reason: reason.trim(),
    });
    onClose();
  };

  const isConfirmDisabled = !reason.trim() || review?.decision !== 'pending';

  const reviewType = review ? reviewTypeConfig[review.reviewType] : null;
  const ReviewTypeIcon = reviewType?.icon || AlertCircle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={review?.decision === 'pending' ? onClose : undefined}
      />
      <div className="relative w-full max-w-2xl bg-industrial-600 rounded-2xl border border-industrial-500 shadow-2xl overflow-hidden animate-in">
        <div className="px-6 py-4 border-b border-industrial-500 bg-industrial-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {reviewType && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border',
                  reviewType.color
                )}
              >
                <ReviewTypeIcon className="w-4 h-4" />
                {reviewType.label}
              </span>
            )}
            {review && review.decision !== 'pending' && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border',
                  review.decision === 'confirmed'
                    ? 'bg-success-500/20 text-success-400 border-success-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                )}
              >
                {review.decision === 'confirmed' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    已通过
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    已驳回
                  </>
                )}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-industrial-400 hover:text-white hover:bg-industrial-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {!review ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-warning-400 mx-auto mb-3" />
              <p className="text-industrial-300">未找到复核记录</p>
              <p className="text-industrial-400 text-sm mt-1">
                请检查 reviewId 或 thresholdId 是否正确
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-industrial-700/50 rounded-xl p-4 border border-industrial-500">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-warning-400" />
                    <span className="text-industrial-300 text-sm font-medium">原始值</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-industrial-400 text-xs mb-1">数值</p>
                      <p className="text-white font-mono text-lg">{review.originalValue}</p>
                    </div>
                    <div>
                      <p className="text-industrial-400 text-xs mb-1">单位</p>
                      <p className="text-white font-mono">{formatUnit(review.originalUnit)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-industrial-700/50 rounded-xl p-4 border border-primary-500/30 relative">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 hidden md:block">
                    <ArrowRight className="w-5 h-5 text-primary-400" />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-primary-400" />
                    <span className="text-primary-400 text-sm font-medium">
                      {review.decision === 'pending' ? '修改值（可编辑）' : '修改值'}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-industrial-400 text-xs mb-1">数值</p>
                      {review.decision === 'pending' ? (
                        <input
                          type="text"
                          value={modifiedValue}
                          onChange={(e) => setModifiedValue(e.target.value)}
                          placeholder={review.modifiedValue || '输入修改后数值...'}
                          className="w-full bg-industrial-800 border border-industrial-500 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500 transition-colors"
                        />
                      ) : (
                        <p className="text-white font-mono text-lg">
                          {review.modifiedValue || '-'}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-industrial-400 text-xs mb-1">单位</p>
                      {review.decision === 'pending' ? (
                        <select
                          value={modifiedUnit}
                          onChange={(e) =>
                            setModifiedUnit(e.target.value as TemperatureUnit | '')
                          }
                          className="w-full bg-industrial-800 border border-industrial-500 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500 transition-colors"
                        >
                          <option value="">选择单位...</option>
                          <option value="Celsius">℃ (摄氏度)</option>
                          <option value="Kelvin">K (开尔文)</option>
                        </select>
                      ) : (
                        <p className="text-white font-mono">
                          {formatUnit(review.modifiedUnit)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-industrial-300 text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning-400" />
                    审核原因
                    {review.decision === 'pending' && (
                      <span className="text-red-400 text-xs">* 必填</span>
                    )}
                  </label>
                </div>
                {review.decision === 'pending' ? (
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="请填写审核原因，例如：核查设备铭牌序列号 SN20240115002，确认使用开尔文..."
                    rows={3}
                    className={cn(
                      'w-full bg-industrial-800 border rounded-lg px-4 py-3 text-white placeholder-industrial-400 focus:outline-none transition-colors resize-none',
                      reason.trim()
                        ? 'border-industrial-500 focus:border-primary-500'
                        : 'border-red-500/50 focus:border-red-500'
                    )}
                  />
                ) : (
                  <div className="bg-industrial-800 rounded-lg px-4 py-3 border border-industrial-500">
                    <p className="text-white whitespace-pre-wrap">{review.reason}</p>
                    {review.reviewedBy && (
                      <p className="text-industrial-400 text-xs mt-2">
                        — {review.reviewedBy}
                        {review.reviewedAt && ` · ${new Date(review.reviewedAt).toLocaleString('zh-CN')}`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {consistencyResult && (
                <div
                  className={cn(
                    'rounded-xl p-4 border',
                    consistencyResult.ok
                      ? 'bg-success-500/10 border-success-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {consistencyResult.ok ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-success-400" />
                        <span className="text-success-400 font-medium">一致性校验通过</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        <span className="text-red-400 font-medium">
                          一致性校验发现 {consistencyResult.issues.length} 个问题
                        </span>
                      </>
                    )}
                  </div>
                  {!consistencyResult.ok && (
                    <ul className="space-y-1.5">
                      {consistencyResult.issues.map((issue, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-red-300 text-sm"
                        >
                          <span className="text-red-400 mt-0.5">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {review && review.decision === 'pending' && (
          <div className="px-6 py-4 border-t border-industrial-500 bg-industrial-700/30 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-industrial-300 hover:text-white hover:bg-industrial-600 rounded-lg transition-colors font-medium"
            >
              取消
            </button>
            <button
              onClick={handleReject}
              disabled={isConfirmDisabled}
              className={cn(
                'px-5 py-2.5 rounded-lg font-medium transition-colors inline-flex items-center gap-2',
                isConfirmDisabled
                  ? 'bg-red-500/20 text-red-400/50 cursor-not-allowed'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
              )}
            >
              <XCircle className="w-4 h-4" />
              驳回
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className={cn(
                'px-5 py-2.5 rounded-lg font-medium transition-colors inline-flex items-center gap-2',
                isConfirmDisabled
                  ? 'bg-primary-500/30 text-primary-300/50 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20'
              )}
            >
              <CheckCircle className="w-4 h-4" />
              确认通过
            </button>
          </div>
        )}

        {review && review.decision !== 'pending' && (
          <div className="px-6 py-4 border-t border-industrial-500 bg-industrial-700/30 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-industrial-600 text-white hover:bg-industrial-500 rounded-lg transition-colors font-medium"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualReviewModal;
