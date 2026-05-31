import { useMemo, useState } from 'react';
import { useReviewStore } from '../store/useReviewStore';
import type { RefundItem, RateTable, SettlementAttachment, Anomaly, ManualConfirmation, TimelineEvent } from '../types';
import { StatusTag, AnomalyTypeBadge, FileTypeBadge, ConclusionBadge } from './StatusTag';
import { formatDate, formatDateTime } from '../utils/date';
import { shortHash } from '../utils/hash';
import { ChevronRight, ChevronDown, FileText, Receipt, Link2, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface TimelineViewProps {
  refunds: RefundItem[];
}

export function TimelineView({ refunds }: TimelineViewProps) {
  const { rates, selectedRefundId, selectRefund, getRateById } = useReviewStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const buildTimelineEvents = (refund: RefundItem): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    const rate = getRateById(refund.rateId);

    if (rate) {
      events.push({
        id: `rate_${refund.id}`,
        date: rate.effectiveFrom,
        type: 'rate',
        item: rate,
        refundId: refund.id,
      });
    }

    events.push({
      id: `refund_${refund.id}`,
      date: refund.refundDate,
      type: 'refund',
      item: refund,
      refundId: refund.id,
    });

    refund.attachments.forEach((att) => {
      events.push({
        id: `att_${att.id}`,
        date: att.uploadDate,
        type: 'attachment',
        item: att,
        refundId: refund.id,
      });
    });

    refund.anomalies.forEach((anom) => {
      events.push({
        id: `anom_${anom.id}`,
        date: anom.detectedAt,
        type: 'anomaly',
        item: anom,
        refundId: refund.id,
      });
    });

    refund.confirmations.forEach((conf) => {
      events.push({
        id: `conf_${conf.id}`,
        date: conf.confirmedAt,
        type: 'confirmation',
        item: conf,
        refundId: refund.id,
      });
    });

    return events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  if (refunds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-muted">
        <FileText className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-data-sm">暂无符合条件的记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 overflow-y-auto h-full scrollbar-thin">
      {refunds.map((refund) => {
        const isExpanded = expandedIds.has(refund.id);
        const isSelected = selectedRefundId === refund.id;
        const events = buildTimelineEvents(refund);
        const rate = getRateById(refund.rateId);
        const openAnomalies = refund.anomalies.filter((a) => a.status === 'open');

        return (
          <div
            key={refund.id}
            className={`card transition-colors cursor-pointer ${
              isSelected ? 'border-status-normal/50 ring-1 ring-status-normal/30' : ''
            }`}
            onClick={() => selectRefund(refund.id)}
          >
            <div
              className="p-4 flex items-start gap-4"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(refund.id);
              }}
            >
              <button className="mt-0.5 text-text-muted hover:text-text-primary transition-colors flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-data-sm font-medium text-text-primary">
                        {refund.serialNo}
                      </span>
                      <StatusTag status={refund.status} />
                      {openAnomalies.length > 0 && (
                        <span className="flex items-center gap-1 text-data-xs text-status-pending">
                          <AlertCircle className="w-3 h-3" />
                          {openAnomalies.length}项待确认
                        </span>
                      )}
                    </div>
                    <p className="text-data-sm text-text-secondary truncate">
                      {refund.supplierName}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-mono text-data-sm font-medium text-text-primary">
                        ¥{refund.amount.toFixed(2)}
                      </p>
                      <p className="font-mono text-data-xs text-text-muted">
                        手续费 ¥{refund.feeAmount.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-data-sm text-text-primary">
                        {formatDate(refund.refundDate)}
                      </p>
                      <p className="text-data-xs text-text-muted">
                        归属期 {refund.belongPeriod}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {rate && (
                    <span className="inline-flex items-center gap-1 text-data-xs text-text-muted">
                      <Link2 className="w-3 h-3" />
                      费率：{(rate.rate * 100).toFixed(1)}% ({rate.version})
                    </span>
                  )}
                  {openAnomalies.map((a) => (
                    <AnomalyTypeBadge key={a.id} type={a.type} />
                  ))}
                  {refund.confirmations.map((c) => (
                    <ConclusionBadge key={c.id} conclusion={c.conclusion} />
                  ))}
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-bg-border px-4 py-3">
                <p className="text-data-xs text-text-muted mb-3 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  证据链时间线（共{events.length}条记录）
                </p>
                <div className="relative pl-8">
                  <div className="timeline-line" />
                  {events.map((event, idx) => (
                    <TimelineEventItem
                      key={event.id}
                      event={event}
                      isLast={idx === events.length - 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineEventItem({
  event,
  isLast,
}: {
  event: TimelineEvent;
  isLast: boolean;
}) {
  const iconMap = {
    rate: { icon: Receipt, color: 'text-blue-400 bg-blue-500/20', label: '费率表' },
    refund: { icon: FileText, color: 'text-emerald-400 bg-emerald-500/20', label: '退款记录' },
    attachment: { icon: FileText, color: 'text-purple-400 bg-purple-500/20', label: '结算附件' },
    anomaly: { icon: AlertCircle, color: 'text-status-pending bg-status-pending/20', label: '异常检测' },
    confirmation: { icon: CheckCircle, color: 'text-status-normal bg-status-normal/20', label: '人工确认' },
  };

  const config = iconMap[event.type];
  const Icon = config.icon;

  const renderContent = () => {
    switch (event.type) {
      case 'rate':
        const rate = event.item as RateTable;
        return (
          <div>
            <p className="text-data-sm text-text-primary font-medium">
              费率版本 {rate.version} · {(rate.rate * 100).toFixed(1)}%
            </p>
            <p className="text-data-xs text-text-muted">
              有效期：{formatDate(rate.effectiveFrom)} ~ {formatDate(rate.effectiveTo)}
            </p>
          </div>
        );
      case 'refund':
        const refund = event.item as RefundItem;
        return (
          <div>
            <p className="text-data-sm text-text-primary font-medium">
              退款 ¥{refund.amount.toFixed(2)} · 手续费 ¥{refund.feeAmount.toFixed(2)}
            </p>
            <p className="text-data-xs text-text-muted">
              入账日：{formatDate(refund.entryDate)}
              {refund.writeOffDate ? ` · 核销日：${formatDate(refund.writeOffDate)}` : ' · 未核销'}
            </p>
          </div>
        );
      case 'attachment':
        const att = event.item as SettlementAttachment;
        return (
          <div>
            <div className="flex items-center gap-2">
              <FileTypeBadge type={att.fileType} />
              <p className="text-data-sm text-text-primary font-medium">{att.fileName}</p>
              {att.isLate && (
                <span className="status-tag status-pending">晚到</span>
              )}
            </div>
            <p className="text-data-xs text-text-muted font-mono mt-1">
              HASH: {shortHash(att.hash)}
            </p>
          </div>
        );
      case 'anomaly':
        const anom = event.item as Anomaly;
        return (
          <div>
            <div className="flex items-center gap-2">
              <AnomalyTypeBadge type={anom.type} />
              <span
                className={`text-data-xs ${
                  anom.status === 'open'
                    ? 'text-status-pending'
                    : anom.status === 'confirmed'
                    ? 'text-status-normal'
                    : 'text-status-anomaly'
                }`}
              >
                {anom.status === 'open' ? '待处理' : anom.status === 'confirmed' ? '已确认' : '已驳回'}
              </span>
            </div>
            <p className="text-data-sm text-text-primary mt-1">{anom.description}</p>
            {anom.crossPeriodDays && (
              <p className="text-data-xs text-text-muted">跨期 {anom.crossPeriodDays} 天</p>
            )}
            {anom.pendingDays && (
              <p className="text-data-xs text-text-muted">挂账 {anom.pendingDays} 天</p>
            )}
          </div>
        );
      case 'confirmation':
        const conf = event.item as ManualConfirmation;
        return (
          <div>
            <div className="flex items-center gap-2">
              <ConclusionBadge conclusion={conf.conclusion} />
              <span className="text-data-xs text-text-muted">{conf.operator}</span>
            </div>
            <p className="text-data-sm text-text-primary mt-1">{conf.explanation}</p>
            {conf.reconciliationNote && (
              <p className="text-data-xs text-text-muted mt-1">{conf.reconciliationNote}</p>
            )}
            <p className="text-data-xs text-text-muted font-mono mt-1">
              证据链哈希: {shortHash(conf.evidenceChainHash)}
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`relative pb-4 ${isLast ? '' : ''}`}>
      <div className={`timeline-dot ${config.color.replace('text-', 'bg-').replace('/20', '')}`} />
      <div className="ml-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${config.color}`}>
            <Icon className="w-3 h-3" />
          </span>
          <span className="text-data-xs text-text-muted">{config.label}</span>
          <span className="text-data-xs text-text-muted font-mono">
            {formatDateTime(event.date)}
          </span>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
