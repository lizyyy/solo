import { useState } from 'react';
import { useReviewStore } from '../store/useReviewStore';
import type { ConfirmationConclusion } from '../types';
import { StatusTag, AnomalyTypeBadge, FileTypeBadge, ConclusionBadge } from './StatusTag';
import { formatDate, formatDateTime } from '../utils/date';
import { shortHash } from '../utils/hash';
import { getAnomalyTypeLabel } from '../utils/anomalyDetector';
import { X, FileText, Paperclip, AlertTriangle, CheckCircle, Hash, Link2, User, Calendar } from 'lucide-react';

export function DetailPanel() {
  const { refunds, selectedRefundId, selectRefund, getRateById, addManualConfirmation } =
    useReviewStore();

  const selectedRefund = refunds.find((r) => r.id === selectedRefundId);
  const rate = selectedRefund ? getRateById(selectedRefund.rateId) : undefined;

  if (!selectedRefund) {
    return (
      <div className="w-96 border-l border-bg-border bg-bg-secondary flex flex-col items-center justify-center text-text-muted">
        <FileText className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-data-sm">请选择一条记录查看详情</p>
      </div>
    );
  }

  return (
    <div className="w-96 border-l border-bg-border bg-bg-secondary flex flex-col h-full">
      <div className="p-4 border-b border-bg-border flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-data-sm font-medium text-text-primary">
              {selectedRefund.serialNo}
            </span>
            <StatusTag status={selectedRefund.status} />
          </div>
          <p className="text-data-xs text-text-muted">{selectedRefund.supplierName}</p>
        </div>
        <button
          onClick={() => selectRefund(null)}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4 space-y-4">
          <DetailSection title="基本信息">
            <InfoRow icon={Hash} label="记录ID" value={selectedRefund.id} mono />
            <InfoRow icon={User} label="供应商" value={selectedRefund.supplierName} />
            <InfoRow icon={Calendar} label="退款日期" value={formatDate(selectedRefund.refundDate)} />
            <InfoRow icon={Calendar} label="归属期" value={selectedRefund.belongPeriod} />
            <InfoRow icon={Calendar} label="入账日期" value={formatDate(selectedRefund.entryDate)} />
            <InfoRow
              icon={Calendar}
              label="核销日期"
              value={selectedRefund.writeOffDate ? formatDate(selectedRefund.writeOffDate) : '未核销'}
            />
            <div className="pt-2 border-t border-bg-border mt-2">
              <div className="flex justify-between text-data-sm">
                <span className="text-text-secondary">退款金额</span>
                <span className="font-mono font-medium text-text-primary">
                  ¥{selectedRefund.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-data-sm mt-1">
                <span className="text-text-secondary">手续费金额</span>
                <span className="font-mono font-medium text-text-primary">
                  ¥{selectedRefund.feeAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </DetailSection>

          {rate && (
            <DetailSection title="费率表信息">
              <InfoRow icon={Link2} label="费率ID" value={rate.id} mono />
              <InfoRow
                icon={FileText}
                label="费率类型"
                value={getAnomalyTypeLabel(rate.rateType as any)}
              />
              <InfoRow
                icon={Hash}
                label="费率"
                value={`${(rate.rate * 100).toFixed(1)}%`}
                mono
              />
              <InfoRow icon={Calendar} label="版本" value={rate.version} mono />
              <InfoRow
                icon={Calendar}
                label="有效期"
                value={`${formatDate(rate.effectiveFrom)} ~ ${formatDate(rate.effectiveTo)}`}
              />
            </DetailSection>
          )}

          {selectedRefund.anomalies.length > 0 && (
            <DetailSection
              title={`异常记录 (${selectedRefund.anomalies.filter((a) => a.status === 'open').length}项待处理)`}
            >
              {selectedRefund.anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className="p-3 bg-bg-primary rounded border border-bg-border mb-2 last:mb-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AnomalyTypeBadge type={anomaly.type} />
                    <span
                      className={`text-data-xs ${
                        anomaly.status === 'open'
                          ? 'text-status-pending'
                          : anomaly.status === 'confirmed'
                          ? 'text-status-normal'
                          : 'text-status-anomaly'
                      }`}
                    >
                      {anomaly.status === 'open'
                        ? '待处理'
                        : anomaly.status === 'confirmed'
                        ? '已确认'
                        : '已驳回'}
                    </span>
                    <span className="text-data-xs text-text-muted ml-auto">
                      {formatDateTime(anomaly.detectedAt)}
                    </span>
                  </div>
                  <p className="text-data-sm text-text-primary mb-2">{anomaly.description}</p>
                  {anomaly.crossPeriodDays && (
                    <p className="text-data-xs text-text-muted">跨期天数：{anomaly.crossPeriodDays} 天</p>
                  )}
                  {anomaly.pendingDays && (
                    <p className="text-data-xs text-text-muted">挂账天数：{anomaly.pendingDays} 天</p>
                  )}
                  {anomaly.relatedRefundIds.length > 1 && (
                    <p className="text-data-xs text-text-muted font-mono mt-1">
                      关联记录：{anomaly.relatedRefundIds.join(', ')}
                    </p>
                  )}
                  {anomaly.status === 'open' && (
                    <ManualConfirmForm
                      refundId={selectedRefund.id}
                      anomalyId={anomaly.id}
                      onConfirm={addManualConfirmation}
                    />
                  )}
                </div>
              ))}
            </DetailSection>
          )}

          {selectedRefund.attachments.length > 0 && (
            <DetailSection title={`结算附件 (${selectedRefund.attachments.length})`}>
              {selectedRefund.attachments.map((att) => (
                <div
                  key={att.id}
                  className="p-3 bg-bg-primary rounded border border-bg-border mb-2 last:mb-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-3.5 h-3.5 text-text-muted" />
                    <FileTypeBadge type={att.fileType} />
                    <span className="text-data-sm text-text-primary">{att.fileName}</span>
                    {att.isLate && <span className="status-tag status-pending">晚到</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-data-xs mb-2">
                    <div>
                      <span className="text-text-muted">上传日期：</span>
                      <span className="text-text-secondary">{formatDate(att.uploadDate)}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">复核截止：</span>
                      <span className="text-text-secondary">{formatDate(att.reviewDeadline)}</span>
                    </div>
                  </div>
                  <p className="text-data-xs text-text-muted mb-1">{att.content}</p>
                  <p className="text-data-xs text-text-muted font-mono">
                    HASH: {shortHash(att.hash)}
                  </p>
                </div>
              ))}
            </DetailSection>
          )}

          {selectedRefund.confirmations.length > 0 && (
            <DetailSection title={`人工确认 (${selectedRefund.confirmations.length})`}>
              {selectedRefund.confirmations.map((conf) => (
                <div
                  key={conf.id}
                  className="p-3 bg-bg-primary rounded border border-bg-border mb-2 last:mb-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-3.5 h-3.5 text-status-normal" />
                    <ConclusionBadge conclusion={conf.conclusion} />
                    <span className="text-data-xs text-text-muted">{conf.operator}</span>
                    <span className="text-data-xs text-text-muted ml-auto">
                      {formatDateTime(conf.confirmedAt)}
                    </span>
                  </div>
                  <p className="text-data-sm text-text-primary mb-1">{conf.explanation}</p>
                  {conf.reconciliationNote && (
                    <p className="text-data-xs text-text-secondary mb-2">
                      对账备注：{conf.reconciliationNote}
                    </p>
                  )}
                  <p className="text-data-xs text-text-muted font-mono">
                    证据链哈希: {shortHash(conf.evidenceChainHash)}
                  </p>
                </div>
              ))}
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-data-sm font-medium text-text-primary mb-3 flex items-center gap-1.5">
        <span className="w-1 h-4 bg-status-normal rounded-full"></span>
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
      <span className="text-data-sm text-text-secondary w-20 flex-shrink-0">{label}</span>
      <span className={`text-data-sm text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ManualConfirmForm({
  refundId,
  anomalyId,
  onConfirm,
}: {
  refundId: string;
  anomalyId: string;
  onConfirm: (
    refundId: string,
    anomalyId: string,
    conclusion: ConfirmationConclusion,
    explanation: string,
    reconciliationNote: string
  ) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [conclusion, setConclusion] = useState<ConfirmationConclusion>('valid');
  const [explanation, setExplanation] = useState('');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!explanation.trim()) {
      alert('请填写异常说明');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(refundId, anomalyId, conclusion, explanation, reconciliationNote);
      setIsExpanded(false);
      setExplanation('');
      setReconciliationNote('');
    } catch (error) {
      console.error('提交确认失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="mt-3 w-full btn-secondary text-center"
      >
        处理此异常
      </button>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-bg-border space-y-3">
      <div>
        <label className="text-data-xs text-text-secondary mb-1 block">复核结论</label>
        <div className="flex gap-2">
          {(['valid', 'invalid', 'adjusted'] as ConfirmationConclusion[]).map((c) => (
            <button
              key={c}
              onClick={() => setConclusion(c)}
              className={`flex-1 px-3 py-1.5 text-data-sm rounded border transition-colors ${
                conclusion === c
                  ? c === 'valid'
                    ? 'bg-status-normal/20 border-status-normal/30 text-status-normal'
                    : c === 'invalid'
                    ? 'bg-status-anomaly/20 border-status-anomaly/30 text-status-anomaly'
                    : 'bg-status-pending/20 border-status-pending/30 text-status-pending'
                  : 'bg-bg-primary border-bg-border text-text-secondary hover:border-bg-border'
              }`}
            >
              {c === 'valid' ? '确认有效' : c === 'invalid' ? '确认无效' : '已调整'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-data-xs text-text-secondary mb-1 block">异常说明 *</label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="请详细说明异常原因和处理依据..."
          className="input-field resize-none h-20"
        />
      </div>

      <div>
        <label className="text-data-xs text-text-secondary mb-1 block">对账备注</label>
        <textarea
          value={reconciliationNote}
          onChange={(e) => setReconciliationNote(e.target.value)}
          placeholder="记录与供应商对账的相关信息..."
          className="input-field resize-none h-16"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setIsExpanded(false)}
          className="flex-1 btn-secondary"
          disabled={isSubmitting}
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 btn-primary"
          disabled={isSubmitting || !explanation.trim()}
        >
          {isSubmitting ? '提交中...' : '确认提交'}
        </button>
      </div>

      <p className="text-data-xs text-text-muted">
        提交后将生成证据链哈希，所有操作将被记录到操作日志。
      </p>
    </div>
  );
}
