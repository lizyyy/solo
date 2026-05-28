import type { Product, NetValue, Valuation, Redemption, VersionRecord, CustomerScript } from '../types';

export const mockProducts: Product[] = [
  {
    id: 'p001',
    name: '稳盈精选1号',
    code: 'WYJX001',
    manager: '张明',
    establishDate: '2023-01-15',
    scale: 50000000,
    status: 'normal',
    latestNetValue: 0.95,
    latestDrawdownRate: -5.0,
    warningLine: 0.88,
    stopLossLine: 0.85,
    anomalies: [],
    lastUpdated: '2026-05-27T10:30:00Z',
  },
  {
    id: 'p002',
    name: '成长优选2号',
    code: 'CZYE002',
    manager: '李华',
    establishDate: '2023-03-20',
    scale: 80000000,
    status: 'warning',
    latestNetValue: 0.89,
    latestDrawdownRate: -11.0,
    warningLine: 0.88,
    stopLossLine: 0.85,
    anomalies: [
      {
        type: 'date_mismatch',
        description: '估值日期与净值日期相差3天',
        level: 'high',
        detectedAt: '2026-05-27T09:00:00Z',
      },
    ],
    lastUpdated: '2026-05-27T11:00:00Z',
  },
  {
    id: 'p003',
    name: '稳健增值3号',
    code: 'WJZZ003',
    manager: '王芳',
    establishDate: '2023-06-10',
    scale: 120000000,
    status: 'warning',
    latestNetValue: 0.87,
    latestDrawdownRate: -13.0,
    warningLine: 0.88,
    stopLossLine: 0.85,
    anomalies: [
      {
        type: 'warning_line_changed',
        description: '预警线从0.90调整为0.88',
        level: 'medium',
        detectedAt: '2026-05-26T14:00:00Z',
      },
      {
        type: 'redemption_suspended',
        description: '产品处于暂停赎回状态',
        level: 'high',
        detectedAt: '2026-05-25T08:00:00Z',
      },
    ],
    lastUpdated: '2026-05-27T08:00:00Z',
  },
  {
    id: 'p004',
    name: '科技创新4号',
    code: 'KJES004',
    manager: '陈强',
    establishDate: '2023-09-01',
    scale: 35000000,
    status: 'normal',
    latestNetValue: 1.02,
    latestDrawdownRate: 2.0,
    warningLine: 0.88,
    stopLossLine: 0.85,
    anomalies: [],
    lastUpdated: '2026-05-27T09:30:00Z',
  },
  {
    id: 'p005',
    name: '平衡配置5号',
    code: 'PHPZ005',
    manager: '刘洋',
    establishDate: '2024-01-05',
    scale: 65000000,
    status: 'stop_loss',
    latestNetValue: 0.84,
    latestDrawdownRate: -16.0,
    warningLine: 0.88,
    stopLossLine: 0.85,
    anomalies: [
      {
        type: 'redemption_suspended',
        description: '产品已触发止损线，暂停赎回',
        level: 'high',
        detectedAt: '2026-05-20T10:00:00Z',
      },
    ],
    lastUpdated: '2026-05-27T07:00:00Z',
  },
];

export const generateNetValues = (productId: string): NetValue[] => {
  const values: NetValue[] = [];
  let netValue = 1.0;
  const startDate = new Date('2026-01-01');

  for (let i = 0; i < 20; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i * 7);
    
    const change = (Math.random() - 0.55) * 0.04;
    netValue = Math.max(0.7, netValue + change);
    const drawdown = ((netValue - 1) * 100);

    values.push({
      id: `nv-${productId}-${i}`,
      productId,
      valueDate: date.toISOString().split('T')[0],
      netValue: parseFloat(netValue.toFixed(4)),
      accumulatedValue: parseFloat((netValue * 1.02).toFixed(4)),
      drawdownRate: parseFloat(drawdown.toFixed(2)),
      source: '净值系统',
    });
  }

  return values;
};

export const mockValuations: Valuation[] = [
  { id: 'v1', productId: 'p001', valuationDate: '2026-05-23', holdingName: '贵州茅台', holdingRatio: 15.5, marketValue: 7750000, source: '估值表' },
  { id: 'v2', productId: 'p001', valuationDate: '2026-05-23', holdingName: '招商银行', holdingRatio: 12.3, marketValue: 6150000, source: '估值表' },
  { id: 'v3', productId: 'p001', valuationDate: '2026-05-23', holdingName: '宁德时代', holdingRatio: 10.8, marketValue: 5400000, source: '估值表' },
  { id: 'v4', productId: 'p001', valuationDate: '2026-05-23', holdingName: '现金', holdingRatio: 61.4, marketValue: 30700000, source: '估值表' },
];

export const mockRedemptions: Record<string, Redemption> = {
  p001: { id: 'r1', productId: 'p001', effectiveDate: '2026-01-01', status: 'normal', source: '申赎表' },
  p002: { id: 'r2', productId: 'p002', effectiveDate: '2026-01-01', status: 'normal', source: '申赎表' },
  p003: { id: 'r3', productId: 'p003', effectiveDate: '2026-05-20', status: 'suspended', description: '因净值波动较大，暂停赎回', source: '申赎表' },
  p004: { id: 'r4', productId: 'p004', effectiveDate: '2026-01-01', status: 'normal', source: '申赎表' },
  p005: { id: 'r5', productId: 'p005', effectiveDate: '2026-05-20', status: 'suspended', description: '触发止损线，暂停赎回', source: '申赎表' },
};

export const mockVersionHistory: VersionRecord[] = [
  {
    id: 'vh1',
    productId: 'p003',
    versionNumber: 'v1.3',
    operationType: 'update',
    operator: '客服-小王',
    beforeData: { scriptContent: '旧话术内容' },
    afterData: { scriptContent: '新话术内容（已更新）' },
    diffSummary: '更新了客户话术，补充市场分析',
    createdAt: '2026-05-27T14:30:00Z',
  },
  {
    id: 'vh2',
    productId: 'p003',
    versionNumber: 'v1.2',
    operationType: 'import',
    operator: '系统',
    beforeData: { netValue: 0.88 },
    afterData: { netValue: 0.87 },
    diffSummary: '导入最新净值数据，净值下跌1.14%',
    createdAt: '2026-05-26T18:00:00Z',
  },
  {
    id: 'vh3',
    productId: 'p003',
    versionNumber: 'v1.1',
    operationType: 'update',
    operator: '风控-李总',
    beforeData: { warningLine: 0.90 },
    afterData: { warningLine: 0.88 },
    diffSummary: '调整预警线从0.90至0.88',
    createdAt: '2026-05-26T14:00:00Z',
  },
  {
    id: 'vh4',
    productId: 'p003',
    versionNumber: 'v1.0',
    operationType: 'create',
    operator: '系统',
    beforeData: {},
    afterData: { productId: 'p003', status: 'normal' },
    diffSummary: '产品初始化',
    createdAt: '2026-05-01T00:00:00Z',
  },
];

export const mockScripts: Record<string, CustomerScript[]> = {
  normal: [
    {
      productId: '',
      type: 'normal',
      title: '净值正常波动说明',
      content: '尊敬的投资者：您好！本周产品净值出现正常波动，主要受市场整体环境影响。基金经理已根据市场情况对持仓进行了优化调整，我们对后续市场表现保持谨慎乐观。如有任何疑问，欢迎随时与我们联系。',
      lastModified: '2026-05-20T10:00:00Z',
      modifiedBy: '系统',
    },
  ],
  warning: [
    {
      productId: '',
      type: 'warning',
      title: '接近预警线说明',
      content: '尊敬的投资者：您好！本周产品净值波动较大，已接近预警线。我们已加强风控措施，密切关注市场变化，基金经理正在积极调整投资组合以控制风险。请您放心，我们会及时向您通报最新情况。',
      lastModified: '2026-05-20T10:00:00Z',
      modifiedBy: '系统',
    },
  ],
  special: [
    {
      productId: '',
      type: 'special',
      title: '特殊情况说明',
      content: '尊敬的投资者：您好！针对近期产品情况，我们在此向您说明如下：1. 由于市场剧烈波动，产品净值受到一定影响；2. 我们已启动应急机制，加强风险管控；3. 基金经理正在积极应对，力争尽快企稳回升。感谢您的理解与支持。',
      lastModified: '2026-05-20T10:00:00Z',
      modifiedBy: '系统',
    },
  ],
};
