export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Enterprise {
  id: string;
  name: string;
  industry: string;
  color: string;
  position: Position3D;
  scale: number;
}

export interface Period {
  id: string;
  name: string;
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
}

export interface QuotaData {
  enterpriseId: string;
  periodId: string;
  totalQuota: number;
  usedQuota: number;
  remainingQuota: number;
  gap: number;
}

export interface Transaction {
  id: string;
  fromEnterpriseId: string;
  toEnterpriseId: string;
  periodId: string;
  amount: number;
  price: number;
  totalValue: number;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

export type IssueType = 'quota_duplicate_deduction' | 'period_misalignment' | 'flow_line_occlusion';

export interface Issue {
  id: string;
  type: IssueType;
  title: string;
  description: string;
  enterpriseId: string;
  relatedTransactionId?: string;
  periodId?: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved' | 'investigating';
  createdAt: string;
}

export interface InitialData {
  enterprises: Enterprise[];
  periods: Period[];
  quotas: QuotaData[];
  transactions: Transaction[];
  issues: Issue[];
}

const INDUSTRY_CONFIG: Record<string, { color: string; angleRange: [number, number] }> = {
  '制造业': { color: '#3B82F6', angleRange: [0, 72] },
  '能源': { color: '#EF4444', angleRange: [72, 144] },
  '科技': { color: '#10B981', angleRange: [144, 216] },
  '化工': { color: '#F59E0B', angleRange: [216, 288] },
  '物流': { color: '#8B5CF6', angleRange: [288, 360] },
};

const ENTERPRISE_NAMES: Record<string, string[]> = {
  '制造业': ['华信制造', '鼎盛重工', '恒远机电', '东方精密'],
  '能源': ['绿能集团', '华电新能源', '恒泰电力'],
  '科技': ['智联科技', '创新数字', '未来网络'],
  '化工': ['恒信化工', '盛达材料', '金源化学'],
  '物流': ['顺通物流', '全球供应链'],
};

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

function generatePosition3D(industry: string, index: number, totalInIndustry: number): Position3D {
  const config = INDUSTRY_CONFIG[industry];
  const [startAngle, endAngle] = config.angleRange;
  const angleSpan = endAngle - startAngle;
  const angleStep = totalInIndustry > 1 ? angleSpan / (totalInIndustry + 1) : angleSpan / 2;
  const angleDeg = startAngle + angleStep * (index + 1);
  const angleRad = (angleDeg * Math.PI) / 180;

  const radius = randomInRange(8, 12);
  const x = radius * Math.cos(angleRad);
  const z = radius * Math.sin(angleRad);
  const y = randomInRange(-1, 1);

  return { x, y, z };
}

export function generateEnterprises(): Enterprise[] {
  const enterprises: Enterprise[] = [];
  const industries = Object.keys(INDUSTRY_CONFIG);

  industries.forEach((industry) => {
    const names = ENTERPRISE_NAMES[industry];
    const count = Math.min(names.length, Math.floor(randomInRange(2, 4)));

    for (let i = 0; i < count; i++) {
      const position = generatePosition3D(industry, i, count);
      enterprises.push({
        id: generateId('ent'),
        name: names[i],
        industry,
        color: INDUSTRY_CONFIG[industry].color,
        position,
        scale: randomInRange(0.8, 1.5),
      });
    }
  });

  return enterprises;
}

export function generatePeriods(): Period[] {
  const periods: Period[] = [];
  const baseYear = 2024;

  for (let q = 1; q <= 3; q++) {
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    const startDate = `${baseYear}-${startMonth.toString().padStart(2, '0')}-01`;
    const endDate = q % 2 === 1
      ? `${baseYear}-${endMonth.toString().padStart(2, '0')}-31`
      : `${baseYear}-${endMonth.toString().padStart(2, '0')}-30`;

    periods.push({
      id: `period_${baseYear}Q${q}`,
      name: `${baseYear}Q${q}`,
      year: baseYear,
      quarter: q,
      startDate,
      endDate,
    });
  }

  return periods;
}

export function generateGaps(enterprises: Enterprise[], periods: Period[]): QuotaData[] {
  const quotas: QuotaData[] = [];

  enterprises.forEach((enterprise) => {
    const baseQuota = Math.floor(randomInRange(5000, 20000));

    periods.forEach((period) => {
      const variation = randomInRange(0.7, 1.3);
      const totalQuota = Math.floor(baseQuota * variation);
      const usedRatio = randomInRange(0.8, 1.2);
      const usedQuota = Math.floor(totalQuota * usedRatio);
      const remainingQuota = totalQuota - usedQuota;
      const gap = usedQuota > totalQuota ? usedQuota - totalQuota : 0;

      quotas.push({
        enterpriseId: enterprise.id,
        periodId: period.id,
        totalQuota,
        usedQuota,
        remainingQuota,
        gap,
      });
    });
  });

  return quotas;
}

export function generateTransactions(enterprises: Enterprise[], periods: Period[]): Transaction[] {
  const transactions: Transaction[] = [];
  const count = Math.floor(randomInRange(15, 25));

  for (let i = 0; i < count; i++) {
    const fromIndex = Math.floor(Math.random() * enterprises.length);
    let toIndex = Math.floor(Math.random() * enterprises.length);
    while (toIndex === fromIndex) {
      toIndex = Math.floor(Math.random() * enterprises.length);
    }

    const period = periods[Math.floor(Math.random() * periods.length)];
    const amount = Math.floor(randomInRange(100, 5000));
    const price = randomInRange(40, 80);
    const totalValue = Math.round(amount * price * 100) / 100;

    const date = new Date(period.startDate);
    date.setDate(date.getDate() + Math.floor(randomInRange(0, 60)));

    const statuses: Array<'completed' | 'pending' | 'failed'> = ['completed', 'completed', 'completed', 'pending', 'failed'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    transactions.push({
      id: generateId('txn'),
      fromEnterpriseId: enterprises[fromIndex].id,
      toEnterpriseId: enterprises[toIndex].id,
      periodId: period.id,
      amount,
      price,
      totalValue,
      timestamp: date.toISOString(),
      status,
    });
  }

  return transactions.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function generateIssues(enterprises: Enterprise[], transactions: Transaction[]): Issue[] {
  const issues: Issue[] = [];
  const count = Math.floor(randomInRange(3, 5));
  const issueTemplates: Array<{
    type: IssueType;
    title: (entName: string) => string;
    description: (entName: string, details: string) => string;
  }> = [
    {
      type: 'quota_duplicate_deduction',
      title: (name) => `${name} - 配额重复扣除`,
      description: (name, details) => `企业 ${name} 在交易 ${details} 中发现配额被重复扣除，涉及金额约 ${Math.floor(randomInRange(5, 50))} 吨碳配额。`,
    },
    {
      type: 'period_misalignment',
      title: (name) => `${name} - 履约期错位`,
      description: (name, details) => `企业 ${name} 的交易 ${details} 时间与履约期不匹配，可能影响合规计算。`,
    },
    {
      type: 'flow_line_occlusion',
      title: (name) => `${name} - 流线遮挡`,
      description: (name, details) => `企业 ${name} 的交易流线 ${details} 与其他交易路径发生视觉遮挡，建议优化3D布局。`,
    },
  ];

  for (let i = 0; i < count; i++) {
    const template = issueTemplates[i % issueTemplates.length];
    const enterprise = enterprises[Math.floor(Math.random() * enterprises.length)];
    const transaction = transactions[Math.floor(Math.random() * transactions.length)];
    const severities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
    const statuses: Array<'open' | 'resolved' | 'investigating'> = ['open', 'resolved', 'investigating'];

    const issueDate = new Date(transaction.timestamp);
    issueDate.setDate(issueDate.getDate() + Math.floor(randomInRange(1, 10)));

    issues.push({
      id: generateId('issue'),
      type: template.type,
      title: template.title(enterprise.name),
      description: template.description(enterprise.name, transaction.id.substring(0, 12)),
      enterpriseId: enterprise.id,
      relatedTransactionId: transaction.id,
      periodId: transaction.periodId,
      severity: severities[Math.floor(Math.random() * severities.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      createdAt: issueDate.toISOString(),
    });
  }

  return issues;
}

export function generateInitialData(): InitialData {
  const enterprises = generateEnterprises();
  const periods = generatePeriods();
  const quotas = generateGaps(enterprises, periods);
  const transactions = generateTransactions(enterprises, periods);
  const issues = generateIssues(enterprises, transactions);

  return {
    enterprises,
    periods,
    quotas,
    transactions,
    issues,
  };
}
