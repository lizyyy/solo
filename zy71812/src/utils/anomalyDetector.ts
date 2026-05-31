import { RefundItem, Anomaly, AnomalyType, AnomalySeverity } from '../types';
import { getAccountingPeriod, daysBetween, isDateAfter, getToday } from './date';

function generateId(): string {
  return 'anom_' + Math.random().toString(36).substring(2, 11);
}

export function detectDuplicates(items: RefundItem[]): Map<string, Anomaly[]> {
  const serialGroups = new Map<string, RefundItem[]>();
  const anomaliesMap = new Map<string, Anomaly[]>();

  items.forEach(item => {
    const group = serialGroups.get(item.serialNo) || [];
    group.push(item);
    serialGroups.set(item.serialNo, group);
  });

  serialGroups.forEach((group, serialNo) => {
    if (group.length >= 2) {
      const relatedIds = group.map(i => i.id);
      group.forEach(item => {
        const anomaly: Anomaly = {
          id: generateId(),
          refundId: item.id,
          type: 'duplicate',
          description: `流水号 ${serialNo} 重复入账，共 ${group.length} 条记录`,
          severity: 'high',
          detectedAt: new Date().toISOString(),
          status: 'open',
          relatedRefundIds: relatedIds,
        };
        const existing = anomaliesMap.get(item.id) || [];
        existing.push(anomaly);
        anomaliesMap.set(item.id, existing);
      });
    }
  });

  return anomaliesMap;
}

export function detectCrossPeriod(item: RefundItem): Anomaly | null {
  const belongPeriod = getAccountingPeriod(item.belongPeriod);
  const entryPeriod = getAccountingPeriod(item.entryDate);

  if (belongPeriod !== entryPeriod) {
    const crossDays = daysBetween(item.belongPeriod, item.entryDate);
    return {
      id: generateId(),
      refundId: item.id,
      type: 'cross_period',
      description: `手续费跨期：归属期 ${belongPeriod}，入账期 ${entryPeriod}`,
      severity: 'medium',
      detectedAt: new Date().toISOString(),
      status: 'open',
      relatedRefundIds: [item.id],
      crossPeriodDays: crossDays,
    };
  }
  return null;
}

export function detectPending(item: RefundItem): Anomaly | null {
  if (!item.writeOffDate) {
    const pendingDays = daysBetween(item.refundDate, getToday());
    if (pendingDays > 30) {
      return {
        id: generateId(),
        refundId: item.id,
        type: 'pending',
        description: `退款挂账：退款日期 ${item.refundDate}，已挂账 ${pendingDays} 天未核销`,
        severity: 'medium',
        detectedAt: new Date().toISOString(),
        status: 'open',
        relatedRefundIds: [item.id],
        pendingDays: pendingDays,
      };
    }
  }
  return null;
}

export function detectLateAttachments(item: RefundItem): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  item.attachments.forEach(attachment => {
    if (isDateAfter(attachment.uploadDate, attachment.reviewDeadline)) {
      const lateDays = daysBetween(attachment.reviewDeadline, attachment.uploadDate);
      anomalies.push({
        id: generateId(),
        refundId: item.id,
        type: 'late_attachment',
        description: `晚到附件：${attachment.fileName}，复核截止日 ${attachment.reviewDeadline}，晚到 ${lateDays} 天`,
        severity: 'low',
        detectedAt: new Date().toISOString(),
        status: 'open',
        relatedRefundIds: [item.id],
      });
    }
  });

  return anomalies;
}

export function runAnomalyDetection(items: RefundItem[]): RefundItem[] {
  const duplicateAnomalies = detectDuplicates(items);

  return items.map(item => {
    const anomalies: Anomaly[] = [];

    const dupAnoms = duplicateAnomalies.get(item.id);
    if (dupAnoms) {
      anomalies.push(...dupAnoms);
    }

    const crossPeriodAnom = detectCrossPeriod(item);
    if (crossPeriodAnom) {
      anomalies.push(crossPeriodAnom);
    }

    const pendingAnom = detectPending(item);
    if (pendingAnom) {
      anomalies.push(pendingAnom);
    }

    const lateAttachAnoms = detectLateAttachments(item);
    anomalies.push(...lateAttachAnoms);

    const hasOpenAnomalies = anomalies.some(a => a.status === 'open');
    const status = hasOpenAnomalies ? 'pending' : item.status;

    return {
      ...item,
      anomalies,
      status,
    };
  });
}

export function getAnomalyTypeLabel(type: AnomalyType): string {
  const labels: Record<AnomalyType, string> = {
    duplicate: '重复入账',
    cross_period: '手续费跨期',
    pending: '退款挂账',
    late_attachment: '晚到附件',
  };
  return labels[type];
}

export function getSeverityLabel(severity: AnomalySeverity): string {
  const labels: Record<AnomalySeverity, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };
  return labels[severity];
}
