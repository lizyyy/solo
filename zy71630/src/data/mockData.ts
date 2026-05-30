import type {
  Loan,
  IndustryTag,
  MaturityBucket,
  RiskRating,
  Guarantee,
  RiskReport,
  AnomalyMark,
  DataSnapshot,
  GuaranteeType,
  AnomalyType,
} from '@/types';

const INDUSTRIES: Omit<IndustryTag, 'displayOrder'>[] = [
  { code: 'IND001', name: '制造业' },
  { code: 'IND002', name: '批发零售业' },
  { code: 'IND003', name: '房地产业' },
  { code: 'IND004', name: '基础设施建设' },
  { code: 'IND005', name: '金融业' },
  { code: 'IND006', name: '信息技术' },
  { code: 'IND007', name: '医疗健康' },
  { code: 'IND008', name: '教育培训' },
  { code: 'IND009', name: '能源化工' },
  { code: 'IND010', name: '交通运输' },
  { code: 'IND011', name: '农林牧渔' },
  { code: 'IND012', name: '住宿餐饮' },
];

const MATURITY_BUCKETS: Omit<MaturityBucket, 'displayOrder'>[] = [
  { code: 'MAT001', name: '1个月内', monthFrom: 0, monthTo: 1 },
  { code: 'MAT002', name: '1-3个月', monthFrom: 1, monthTo: 3 },
  { code: 'MAT003', name: '3-6个月', monthFrom: 3, monthTo: 6 },
  { code: 'MAT004', name: '6-12个月', monthFrom: 6, monthTo: 12 },
  { code: 'MAT005', name: '1-3年', monthFrom: 12, monthTo: 36 },
  { code: 'MAT006', name: '3-5年', monthFrom: 36, monthTo: 60 },
  { code: 'MAT007', name: '5-10年', monthFrom: 60, monthTo: 120 },
  { code: 'MAT008', name: '10年以上', monthFrom: 120, monthTo: 360 },
];

const RISK_RATINGS: Omit<RiskRating, 'displayOrder'>[] = [
  { code: 'AAA', name: 'AAA', riskLevel: 1, color: '#22C55E' },
  { code: 'AA', name: 'AA', riskLevel: 2, color: '#4ADE80' },
  { code: 'A', name: 'A', riskLevel: 3, color: '#86EFAC' },
  { code: 'BBB', name: 'BBB', riskLevel: 4, color: '#EAB308' },
  { code: 'BB', name: 'BB', riskLevel: 5, color: '#FACC15' },
  { code: 'B', name: 'B', riskLevel: 6, color: '#F97316' },
  { code: 'CCC', name: 'CCC', riskLevel: 7, color: '#FB923C' },
  { code: 'CC', name: 'CC', riskLevel: 8, color: '#EF4444' },
  { code: 'C', name: 'C', riskLevel: 9, color: '#DC2626' },
  { code: 'D', name: 'D', riskLevel: 10, color: '#991B1B' },
];

const SURNAMES = ['张', '李', '王', '刘', '陈', '杨', '黄', '赵', '周', '吴', '徐', '孙', '马', '胡', '朱'];
const GIVEN_NAMES = ['伟', '芳', '娜', '敏', '静', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明'];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).substr(2, 6)}`;
}

function generateName(): string {
  return randomChoice(SURNAMES) + randomChoice(GIVEN_NAMES) + (Math.random() > 0.5 ? randomChoice(GIVEN_NAMES) : '');
}

function generateLoanNo(): string {
  return `LN${new Date().getFullYear()}${String(randomBetween(100000, 999999))}`;
}

export function generateIndustryTags(): IndustryTag[] {
  return INDUSTRIES.map((item, idx) => ({
    ...item,
    displayOrder: idx + 1,
  }));
}

export function generateMaturityBuckets(): MaturityBucket[] {
  return MATURITY_BUCKETS.map((item, idx) => ({
    ...item,
    displayOrder: idx + 1,
  }));
}

export function generateRiskRatings(): RiskRating[] {
  return RISK_RATINGS.sort((a, b) => a.riskLevel - b.riskLevel);
}

export function generateLoans(count: number): Loan[] {
  const loans: Loan[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    loans.push({
      id: generateId('LOAN'),
      customerName: generateName(),
      loanNo: generateLoanNo(),
      principal: randomBetween(10, 5000) * 10000,
      industryCode: randomChoice(INDUSTRIES).code,
      maturityBucketCode: randomChoice(MATURITY_BUCKETS).code,
      riskRatingCode: randomChoice(RISK_RATINGS).code,
      createdAt: now,
      updatedAt: now,
    });
  }

  return loans;
}

export function generateGuarantees(loans: Loan[]): Guarantee[] {
  const guarantees: Guarantee[] = [];
  const guaranteeTypes: GuaranteeType[] = ['mortgage', 'pledge', 'guarantee', 'credit'];
  const guarantorNames = ['创新担保有限公司', '诚信融资担保', '恒大置业', '万科企业', '碧桂园控股', '中投保'];

  loans.forEach((loan) => {
    const count = randomBetween(1, 3);
    const usedGuarantors: string[] = [];

    for (let i = 0; i < count; i++) {
      const type = randomChoice(guaranteeTypes);
      const guarantor = randomChoice(guarantorNames);
      const isRepeated = usedGuarantors.includes(guarantor) && Math.random() > 0.5;

      guarantees.push({
        id: generateId('GUAR'),
        loanId: loan.id,
        type,
        amount: type === 'credit' ? 0 : loan.principal * randomBetween(50, 100) / 100,
        guarantor,
        isRepeated,
      });

      usedGuarantors.push(guarantor);
    }
  });

  return guarantees;
}

export function generateRiskReports(loans: Loan[]): RiskReport[] {
  return loans.map((loan) => {
    const rawValue = `原始评级：${loan.riskRatingCode}，敞口：${(loan.principal / 10000).toFixed(0)}万元`;
    const needAdjust = Math.random() > 0.6;
    const adjustReason = needAdjust
      ? randomChoice([
          '考虑行业下行趋势，下调一级',
          '担保能力不足，风险上调',
          '企业经营改善，上调评级',
          '现金流紧张，风险等级调整',
          '重组贷款，风险重新评估',
        ])
      : '';
    const adjustedValue = needAdjust
      ? `修正评级：${adjustRating(loan.riskRatingCode)}，敞口：${(loan.principal / 10000).toFixed(0)}万元`
      : rawValue;
    const conclusion = needAdjust
      ? `最终结论：${adjustRating(loan.riskRatingCode)}，${randomChoice(['重点关注', '加强监控', '正常管理', '风险缓释'])}`
      : `最终结论：${loan.riskRatingCode}，正常管理`;

    return {
      id: generateId('RPT'),
      loanId: loan.id,
      rawValue,
      adjustedValue,
      conclusion,
      adjustReason,
      createdAt: new Date().toISOString(),
      createdBy: '风控分析师',
    };
  });
}

function adjustRating(code: string): string {
  const idx = RISK_RATINGS.findIndex((r) => r.code === code);
  const adjustment = randomBetween(-2, 2);
  const newIdx = Math.max(0, Math.min(RISK_RATINGS.length - 1, idx + adjustment));
  return RISK_RATINGS[newIdx].code;
}

export function generateAnomalies(loans: Loan[], guarantees: Guarantee[]): AnomalyMark[] {
  const anomalies: AnomalyMark[] = [];
  const now = new Date().toISOString();

  loans.forEach((loan) => {
    if (Math.random() > 0.7) {
      const anomalyType = randomChoice<AnomalyType>(['maturity_mismatch', 'guarantee_repeat', 'rating_override']);
      const severity = randomBetween(1, 3) as 1 | 2 | 3;

      let description = '';
      switch (anomalyType) {
        case 'maturity_mismatch':
          description = `到期桶错位：贷款实际到期日与分类桶${MATURITY_BUCKETS.find((m) => m.code === loan.maturityBucketCode)?.name}存在偏差，相差${randomBetween(15, 90)}天`;
          break;
        case 'guarantee_repeat':
          const repeatGuar = guarantees.find((g) => g.loanId === loan.id && g.isRepeated);
          description = repeatGuar
            ? `担保重复：担保人「${repeatGuar.guarantor}」已为多笔贷款提供担保，合计敞口${(repeatGuar.amount * 3 / 10000).toFixed(0)}万元`
            : `担保重复检测：该笔贷款担保人存在交叉担保风险`;
          break;
        case 'rating_override':
          description = `风险等级覆盖：人工干预将评级从${adjustRating(loan.riskRatingCode)}调整为${loan.riskRatingCode}，需复核调整依据`;
          break;
      }

      anomalies.push({
        id: generateId('ANOM'),
        loanId: loan.id,
        type: anomalyType,
        description,
        severity,
        resolved: Math.random() > 0.8,
        createdAt: now,
      });
    }
  });

  return anomalies;
}

export function generateSnapshots(
  loans: Loan[],
  reports: RiskReport[],
  anomalies: AnomalyMark[]
): DataSnapshot[] {
  const snapshots: DataSnapshot[] = [];
  const baseDate = new Date();

  for (let i = 5; i >= 1; i--) {
    const snapshotDate = new Date(baseDate);
    snapshotDate.setDate(snapshotDate.getDate() - i * 7);

    const modifiedLoans = loans.map((loan) => ({
      ...loan,
      principal: loan.principal * (1 + (Math.random() - 0.5) * 0.1 * i),
    }));

    snapshots.push({
      id: generateId('SNAP'),
      name: `${i * 7}天前快照`,
      createdAt: snapshotDate.toISOString(),
      data: {
        loans: modifiedLoans,
        reports,
        anomalies: anomalies.filter(() => Math.random() > 0.1 * i),
      },
      createdBy: '系统自动',
    });
  }

  return snapshots;
}

export function generateAllMockData() {
  const industryTags = generateIndustryTags();
  const maturityBuckets = generateMaturityBuckets();
  const riskRatings = generateRiskRatings();
  const loans = generateLoans(500);
  const guarantees = generateGuarantees(loans);
  const reports = generateRiskReports(loans);
  const anomalies = generateAnomalies(loans, guarantees);
  const snapshots = generateSnapshots(loans, reports, anomalies);

  return {
    industryTags,
    maturityBuckets,
    riskRatings,
    loans,
    guarantees,
    reports,
    anomalies,
    snapshots,
    auditLogs: [],
  };
}
