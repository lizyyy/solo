import type { Transaction, PerformancePeriod, Enterprise, AnomalyRecord, DetectionData } from './types';

export function detectDuplicateDeduction(transactions: Transaction[]): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const key = `${tx.date}-${tx.amount}-${tx.enterpriseId}`;
    const existing = groups.get(key) || [];
    existing.push(tx);
    groups.set(key, existing);
  }

  for (const [key, group] of groups) {
    if (group.length > 1) {
      const [date, amount, enterpriseId] = key.split('-');
      const enterpriseName = group[0].enterpriseName;
      anomalies.push({
        type: 'duplicate_deduction',
        severity: 'high',
        description: `检测到企业「${enterpriseName}」在 ${date} 有 ${group.length} 笔金额为 ${Number(amount).toLocaleString()} 的重复扣减记录`,
        relatedIds: group.map(tx => tx.id),
        details: {
          date,
          amount: Number(amount),
          enterpriseId,
          enterpriseName,
          transactionCount: group.length,
          transactionIds: group.map(tx => tx.id)
        }
      });
    }
  }

  return anomalies;
}

export function detectPeriodMisalignment(
  transactions: Transaction[],
  periods: PerformancePeriod[] = []
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];

  if (periods.length === 0) {
    return anomalies;
  }

  const periodMap = new Map(periods.map(p => [p.id, p]));

  for (const tx of transactions) {
    if (!tx.periodId) continue;

    const period = periodMap.get(tx.periodId);
    if (!period) continue;

    const txDate = new Date(tx.date);
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);

    if (txDate < startDate || txDate > endDate) {
      anomalies.push({
        type: 'period_misalignment',
        severity: 'medium',
        description: `交易「${tx.id}」日期 ${tx.date} 不在履约期「${period.name}」(${period.startDate} ~ ${period.endDate}) 范围内`,
        relatedIds: [tx.id, period.id],
        details: {
          transactionId: tx.id,
          transactionDate: tx.date,
          periodId: period.id,
          periodName: period.name,
          periodStart: period.startDate,
          periodEnd: period.endDate,
          enterpriseId: tx.enterpriseId,
          enterpriseName: tx.enterpriseName
        }
      });
    }
  }

  return anomalies;
}

export function detectFlowOcclusion(
  transactions: Transaction[],
  enterprises: Enterprise[] = [],
  threshold: number = 0.5
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];

  if (enterprises.length === 0) {
    return anomalies;
  }

  const enterpriseMap = new Map(enterprises.map(e => [e.id, e]));
  const flowsWithPositions = transactions
    .filter(tx => tx.fromEnterpriseId && tx.toEnterpriseId)
    .map(tx => {
      const from = enterpriseMap.get(tx.fromEnterpriseId!);
      const to = enterpriseMap.get(tx.toEnterpriseId!);
      if (!from?.position || !to?.position) return null;
      return { tx, fromPos: from.position, toPos: to.position };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  for (let i = 0; i < flowsWithPositions.length; i++) {
    for (let j = i + 1; j < flowsWithPositions.length; j++) {
      const flowA = flowsWithPositions[i];
      const flowB = flowsWithPositions[j];

      const distance = calculateFlowDistance(
        flowA.fromPos, flowA.toPos,
        flowB.fromPos, flowB.toPos
      );

      if (distance < threshold) {
        anomalies.push({
          type: 'flow_occlusion',
          severity: 'low',
          description: `流线「${flowA.tx.id}」与「${flowB.tx.id}」空间距离过近 (${distance.toFixed(3)})，可能存在视觉遮挡`,
          relatedIds: [flowA.tx.id, flowB.tx.id],
          details: {
            transactionIdA: flowA.tx.id,
            transactionIdB: flowB.tx.id,
            distance,
            threshold,
            fromEnterpriseA: flowA.tx.fromEnterpriseId,
            toEnterpriseA: flowA.tx.toEnterpriseId,
            fromEnterpriseB: flowB.tx.fromEnterpriseId,
            toEnterpriseB: flowB.tx.toEnterpriseId
          }
        });
      }
    }
  }

  return anomalies;
}

function calculateFlowDistance(
  from1: { x: number; y: number; z: number },
  to1: { x: number; y: number; z: number },
  from2: { x: number; y: number; z: number },
  to2: { x: number; y: number; z: number }
): number {
  const mid1 = {
    x: (from1.x + to1.x) / 2,
    y: (from1.y + to1.y) / 2 + 2,
    z: (from1.z + to1.z) / 2
  };
  const mid2 = {
    x: (from2.x + to2.x) / 2,
    y: (from2.y + to2.y) / 2 + 2,
    z: (from2.z + to2.z) / 2
  };

  return Math.sqrt(
    Math.pow(mid1.x - mid2.x, 2) +
    Math.pow(mid1.y - mid2.y, 2) +
    Math.pow(mid1.z - mid2.z, 2)
  );
}

export function detectAllAnomalies(data: DetectionData): AnomalyRecord[] {
  const { transactions, periods = [], enterprises = [] } = data;

  const duplicateAnomalies = detectDuplicateDeduction(transactions);
  const periodAnomalies = detectPeriodMisalignment(transactions, periods);
  const occlusionAnomalies = detectFlowOcclusion(transactions, enterprises);

  return [...duplicateAnomalies, ...periodAnomalies, ...occlusionAnomalies];
}
