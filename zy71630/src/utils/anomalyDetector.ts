import type { Loan, Guarantee, AnomalyMark, AnomalyType, TerrainDataPoint } from '@/types';

export function detectMaturityMismatch(loan: Loan): boolean {
  const maturityPatterns: Record<string, { from: number; to: number }> = {
    MAT001: { from: 0, to: 30 },
    MAT002: { from: 30, to: 90 },
    MAT003: { from: 90, to: 180 },
    MAT004: { from: 180, to: 365 },
    MAT005: { from: 365, to: 1095 },
    MAT006: { from: 1095, to: 1825 },
    MAT007: { from: 1825, to: 3650 },
    MAT008: { from: 3650, to: 10950 },
  };

  const pattern = maturityPatterns[loan.maturityBucketCode];
  if (!pattern) return false;

  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(loan.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceCreation > pattern.to || daysSinceCreation < pattern.from * 0.8;
}

export function detectGuaranteeRepeat(guarantees: Guarantee[], loanId: string): boolean {
  const loanGuarantees = guarantees.filter((g) => g.loanId === loanId);
  const guarantorCounts = new Map<string, number>();

  loanGuarantees.forEach((g) => {
    const count = guarantorCounts.get(g.guarantor) || 0;
    guarantorCounts.set(g.guarantor, count + 1);
  });

  return Array.from(guarantorCounts.values()).some((count) => count > 1);
}

export function detectRatingOverride(loan: Loan, originalRating: string): boolean {
  return loan.riskRatingCode !== originalRating;
}

export function detectAllAnomalies(
  loans: Loan[],
  guarantees: Guarantee[]
): Omit<AnomalyMark, 'id' | 'createdAt'>[] {
  const anomalies: Omit<AnomalyMark, 'id' | 'createdAt'>[] = [];

  loans.forEach((loan) => {
    if (detectMaturityMismatch(loan)) {
      anomalies.push({
        loanId: loan.id,
        type: 'maturity_mismatch' as AnomalyType,
        description: `到期桶错位检测：贷款${loan.loanNo}的实际到期情况与分类存在偏差`,
        severity: 2,
        resolved: false,
      });
    }

    if (detectGuaranteeRepeat(guarantees, loan.id)) {
      anomalies.push({
        loanId: loan.id,
        type: 'guarantee_repeat' as AnomalyType,
        description: `担保重复检测：贷款${loan.loanNo}存在同一担保人重复担保情况`,
        severity: 2,
        resolved: false,
      });
    }
  });

  return anomalies;
}

export function calculateTerrainData(
  loans: Loan[],
  riskLevels: Map<string, number>
): TerrainDataPoint[] {
  const dataMap = new Map<string, TerrainDataPoint>();

  loans.forEach((loan) => {
    const key = `${loan.industryCode}-${loan.maturityBucketCode}-${loan.riskRatingCode}`;
    const riskLevel = riskLevels.get(loan.riskRatingCode) || 5;

    const existing = dataMap.get(key);
    if (existing) {
      existing.totalPrincipal += loan.principal;
      existing.loanCount += 1;
      existing.avgRiskLevel =
        (existing.avgRiskLevel * (existing.loanCount - 1) + riskLevel) / existing.loanCount;
      existing.loans.push(loan.id);
    } else {
      dataMap.set(key, {
        industryCode: loan.industryCode,
        maturityCode: loan.maturityBucketCode,
        riskRatingCode: loan.riskRatingCode,
        totalPrincipal: loan.principal,
        loanCount: 1,
        avgRiskLevel: riskLevel,
        anomalyCount: 0,
        loans: [loan.id],
      });
    }
  });

  return Array.from(dataMap.values());
}

export function getAnomalyTypeLabel(type: AnomalyType): string {
  const labels: Record<AnomalyType, string> = {
    maturity_mismatch: '到期桶错位',
    guarantee_repeat: '担保重复',
    rating_override: '风险等级覆盖',
  };
  return labels[type];
}

export function getAnomalyTypeColor(type: AnomalyType): string {
  const colors: Record<AnomalyType, string> = {
    maturity_mismatch: '#F59E0B',
    guarantee_repeat: '#EF4444',
    rating_override: '#8B5CF6',
  };
  return colors[type];
}

export function getSeverityLabel(severity: number): string {
  const labels: Record<number, string> = {
    1: '低',
    2: '中',
    3: '高',
  };
  return labels[severity] || '未知';
}

export function getSeverityColor(severity: number): string {
  const colors: Record<number, string> = {
    1: '#22C55E',
    2: '#F59E0B',
    3: '#EF4444',
  };
  return colors[severity] || '#6B7280';
}

export function getGuaranteeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    mortgage: '抵押',
    pledge: '质押',
    guarantee: '保证',
    credit: '信用',
  };
  return labels[type] || type;
}
