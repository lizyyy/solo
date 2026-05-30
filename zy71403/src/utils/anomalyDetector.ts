import type { AnomalyType, ValuationRecord, ShareRecord, SidePocketAsset } from '../types';
import { ANOMALY_LABELS } from '../types';

export interface AnomalyDetectionResult {
  hasAnomaly: boolean;
  anomalies: AnomalyType[];
  details: { type: AnomalyType; message: string }[];
}

export const ANOMALY_RULES: Record<AnomalyType, {
  check: (record: ValuationRecord, shares?: ShareRecord[], assets?: SidePocketAsset[], allRecords?: ValuationRecord[]) => boolean;
  message: string;
  severity: 'warning' | 'error';
}> = {
  split_error: {
    check: (record, shares) => {
      if (!shares) return false;
      const fundShares = shares.filter(s => s.fundId === record.fundId && s.shareDate === record.valuationDate);
      if (fundShares.length === 0) return false;
      
      const share = fundShares[fundShares.length - 1];
      const calculated = share.normalShares + share.sidePocketShares;
      const diff = Math.abs(calculated - share.totalShares) / share.totalShares;
      return diff > 0.00001;
    },
    message: '份额拆分后合计与原份额偏差超过0.001%，请人工复核',
    severity: 'warning',
  },
  
  lock_miss: {
    check: (record, shares, assets) => {
      if (!assets) return false;
      const fundAssets = assets.filter(a => a.fundId === record.fundId);
      if (fundAssets.length === 0) return false;
      
      const valuationDate = new Date(record.valuationDate);
      return fundAssets.some(asset => {
        const lockStart = new Date(asset.lockStartDate);
        const lockEnd = new Date(asset.lockEndDate);
        const isInLockPeriod = valuationDate >= lockStart && valuationDate <= lockEnd;
        return isInLockPeriod && !asset.isLocked;
      });
    },
    message: '侧袋资产在限制期内但未标记限制状态，请确认',
    severity: 'warning',
  },
  
  coverage_over: {
    check: (record) => {
      if (record.normalValue === 0) return false;
      const ratio = record.sidePocketValue / record.normalValue;
      return ratio > 0.5;
    },
    message: '侧袋估值金额超过正常份额估值的50%，需风控审批',
    severity: 'error',
  },
  
  missing_field: {
    check: (record) => {
      return !record.normalValue || !record.sidePocketValue || !record.unitNetValue || 
             record.normalValue === 0 || record.sidePocketValue === 0 || record.unitNetValue === 0;
    },
    message: '估值关键字段缺失，请补充完整数据',
    severity: 'error',
  },
  
  duplicate_submit: {
    check: (record, shares, assets, allRecords) => {
      if (!allRecords) return false;
      const duplicates = allRecords.filter(r => 
        r.fundId === record.fundId && 
        r.valuationDate === record.valuationDate &&
        r.valuationId !== record.valuationId
      );
      return duplicates.length > 0;
    },
    message: '同一基金同一估值日期存在多条记录，请确认版本',
    severity: 'warning',
  },
};

export function detectAnomalies(
  record: ValuationRecord,
  shares?: ShareRecord[],
  assets?: SidePocketAsset[],
  allRecords?: ValuationRecord[]
): AnomalyDetectionResult {
  const anomalies: AnomalyType[] = [];
  const details: { type: AnomalyType; message: string }[] = [];
  
  (Object.keys(ANOMALY_RULES) as AnomalyType[]).forEach(type => {
    const rule = ANOMALY_RULES[type];
    if (rule.check(record, shares, assets, allRecords)) {
      anomalies.push(type);
      details.push({ type, message: rule.message });
    }
  });
  
  return {
    hasAnomaly: anomalies.length > 0,
    anomalies,
    details,
  };
}

export function getAnomalyLabel(type: AnomalyType): string {
  return ANOMALY_LABELS[type] || type;
}

export function getAnomalyColor(type: AnomalyType): string {
  const severity = ANOMALY_RULES[type]?.severity || 'warning';
  return severity === 'error' ? 'rose' : 'amber';
}

export function batchDetectAnomalies(
  records: ValuationRecord[],
  shares?: ShareRecord[],
  assets?: SidePocketAsset[]
): Map<string, AnomalyDetectionResult> {
  const results = new Map<string, AnomalyDetectionResult>();
  
  records.forEach(record => {
    const result = detectAnomalies(record, shares, assets, records);
    results.set(record.valuationId, result);
  });
  
  return results;
}
