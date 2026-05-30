import {
  Batch,
  Material,
  Holding,
  TargetWeight,
  PriceQuote,
  RebalanceConfig,
  DEFAULT_CONFIG,
} from '@/types';

export const generateSampleBatch = (): Batch => ({
  id: 'batch_demo_001',
  name: '客户A组合再平衡',
  clientId: 'CLIENT_001',
  status: 'completed',
  createdAt: new Date(Date.now() - 86400000),
  updatedAt: new Date(),
  createdBy: '投顾张三',
  currentVersion: 2,
});

export const generateSampleHoldings = (materialId: string = 'mat_holding_001'): Holding[] => {
  const baseDate = new Date();
  const holdings: Holding[] = [
    {
      id: 'hold_001',
      materialId,
      symbol: '600519',
      name: '贵州茅台',
      quantity: 300,
      costBasis: 1650,
      marketPrice: 1850,
      purchaseDate: new Date(baseDate.getTime() - 400 * 86400000),
      holdingDays: 400,
      marketValue: 300 * 1850,
      costValue: 300 * 1650,
      unrealizedGain: 300 * (1850 - 1650),
      unrealizedGainPct: (1850 - 1650) / 1650,
      currentWeight: 0,
    },
    {
      id: 'hold_002',
      materialId,
      symbol: '000858',
      name: '五粮液',
      quantity: 1000,
      costBasis: 145,
      marketPrice: 168,
      purchaseDate: new Date(baseDate.getTime() - 200 * 86400000),
      holdingDays: 200,
      marketValue: 1000 * 168,
      costValue: 1000 * 145,
      unrealizedGain: 1000 * (168 - 145),
      unrealizedGainPct: (168 - 145) / 145,
      currentWeight: 0,
    },
    {
      id: 'hold_003',
      materialId,
      symbol: '601318',
      name: '中国平安',
      quantity: 5000,
      costBasis: 52,
      marketPrice: 45,
      purchaseDate: new Date(baseDate.getTime() - 100 * 86400000),
      holdingDays: 100,
      marketValue: 5000 * 45,
      costValue: 5000 * 52,
      unrealizedGain: 5000 * (45 - 52),
      unrealizedGainPct: (45 - 52) / 52,
      currentWeight: 0,
    },
    {
      id: 'hold_004',
      materialId,
      symbol: '000333',
      name: '美的集团',
      quantity: 2000,
      costBasis: 58,
      marketPrice: 65,
      purchaseDate: new Date(baseDate.getTime() - 15 * 86400000),
      holdingDays: 15,
      marketValue: 2000 * 65,
      costValue: 2000 * 58,
      unrealizedGain: 2000 * (65 - 58),
      unrealizedGainPct: (65 - 58) / 58,
      currentWeight: 0,
    },
    {
      id: 'hold_005',
      materialId,
      symbol: '600036',
      name: '招商银行',
      quantity: 8000,
      costBasis: 32,
      marketPrice: 38,
      purchaseDate: new Date(baseDate.getTime() - 500 * 86400000),
      holdingDays: 500,
      marketValue: 8000 * 38,
      costValue: 8000 * 32,
      unrealizedGain: 8000 * (38 - 32),
      unrealizedGainPct: (38 - 32) / 32,
      currentWeight: 0,
    },
    {
      id: 'hold_006',
      materialId,
      symbol: '002594',
      name: '比亚迪',
      quantity: 500,
      costBasis: 220,
      marketPrice: 280,
      purchaseDate: new Date(baseDate.getTime() - 60 * 86400000),
      holdingDays: 60,
      marketValue: 500 * 280,
      costValue: 500 * 220,
      unrealizedGain: 500 * (280 - 220),
      unrealizedGainPct: (280 - 220) / 220,
      currentWeight: 0,
    },
    {
      id: 'hold_007',
      materialId,
      symbol: '300750',
      name: '宁德时代',
      quantity: 400,
      costBasis: 180,
      marketPrice: 195,
      purchaseDate: new Date(baseDate.getTime() - 300 * 86400000),
      holdingDays: 300,
      marketValue: 400 * 195,
      costValue: 400 * 180,
      unrealizedGain: 400 * (195 - 180),
      unrealizedGainPct: (195 - 180) / 180,
      currentWeight: 0,
    },
    {
      id: 'hold_008',
      materialId,
      symbol: '600900',
      name: '长江电力',
      quantity: 10000,
      costBasis: 25,
      marketPrice: 32,
      purchaseDate: new Date(baseDate.getTime() - 700 * 86400000),
      holdingDays: 700,
      marketValue: 10000 * 32,
      costValue: 10000 * 25,
      unrealizedGain: 10000 * (32 - 25),
      unrealizedGainPct: (32 - 25) / 25,
      currentWeight: 0,
    },
  ];

  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  return holdings.map(h => ({
    ...h,
    currentWeight: h.marketValue / totalValue,
  }));
};

export const generateSampleTargetWeights = (materialId: string = 'mat_target_001'): TargetWeight[] => [
  { id: 'tw_001', materialId, symbol: '600519', targetWeight: 0.25 },
  { id: 'tw_002', materialId, symbol: '000858', targetWeight: 0.10 },
  { id: 'tw_003', materialId, symbol: '601318', targetWeight: 0.12 },
  { id: 'tw_004', materialId, symbol: '000333', targetWeight: 0.08 },
  { id: 'tw_005', materialId, symbol: '600036', targetWeight: 0.15 },
  { id: 'tw_006', materialId, symbol: '002594', targetWeight: 0.10 },
  { id: 'tw_007', materialId, symbol: '300750', targetWeight: 0.10 },
  { id: 'tw_008', materialId, symbol: '600900', targetWeight: 0.10 },
];

export const generateSamplePriceQuotes = (materialId: string = 'mat_price_001'): PriceQuote[] => [
  { id: 'pq_001', materialId, symbol: '600519', bidPrice: 1849.50, askPrice: 1850.50, quoteTime: new Date() },
  { id: 'pq_002', materialId, symbol: '000858', bidPrice: 167.80, askPrice: 168.20, quoteTime: new Date() },
  { id: 'pq_003', materialId, symbol: '601318', bidPrice: 44.90, askPrice: 45.10, quoteTime: new Date() },
  { id: 'pq_004', materialId, symbol: '000333', bidPrice: 64.80, askPrice: 65.20, quoteTime: new Date() },
  { id: 'pq_005', materialId, symbol: '600036', bidPrice: 37.90, askPrice: 38.10, quoteTime: new Date() },
  { id: 'pq_006', materialId, symbol: '002594', bidPrice: 279.50, askPrice: 280.50, quoteTime: new Date() },
  { id: 'pq_007', materialId, symbol: '300750', bidPrice: 194.80, askPrice: 195.20, quoteTime: new Date() },
  { id: 'pq_008', materialId, symbol: '600900', bidPrice: 31.90, askPrice: 32.10, quoteTime: new Date() },
];

export const generateSampleMaterials = (batchId: string = 'batch_demo_001'): Material[] => [
  {
    id: 'mat_holding_001',
    batchId,
    type: 'holding',
    source: '交易系统导出',
    fileName: '持仓表_20240530.csv',
    fileHash: 'a1b2c3d4e5f6g7h8i9j0',
    uploadedBy: '投顾张三',
    uploadedAt: new Date(Date.now() - 86400000),
    rawContent: `代码,名称,数量,成本价,市价,买入日期
600519,贵州茅台,300,1650,1850,2023-04-25
000858,五粮液,1000,145,168,2023-11-12
601318,中国平安,5000,52,45,2024-02-19
000333,美的集团,2000,58,65,2024-05-15
600036,招商银行,8000,32,38,2023-01-15
002594,比亚迪,500,220,280,2024-03-31
300750,宁德时代,400,180,195,2023-08-03
600900,长江电力,10000,25,32,2022-06-30`,
    version: 1,
  },
  {
    id: 'mat_target_001',
    batchId,
    type: 'target',
    source: '投研部配置建议',
    fileName: '目标权重_2024Q2.csv',
    fileHash: 'k1l2m3n4o5p6q7r8s9t0',
    uploadedBy: '投研李四',
    uploadedAt: new Date(Date.now() - 43200000),
    rawContent: `代码,目标权重
600519,0.25
000858,0.10
601318,0.12
000333,0.08
600036,0.15
002594,0.10
300750,0.10
600900,0.10`,
    version: 1,
  },
  {
    id: 'mat_price_001',
    batchId,
    type: 'price',
    source: '行情系统',
    fileName: '买卖报价_20240530.csv',
    fileHash: 'u1v2w3x4y5z6a7b8c9d0',
    uploadedBy: '系统自动',
    uploadedAt: new Date(Date.now() - 3600000),
    rawContent: `代码,买入价,卖出价
600519,1849.50,1850.50
000858,167.80,168.20
601318,44.90,45.10
000333,64.80,65.20
600036,37.90,38.10
002594,279.50,280.50
300750,194.80,195.20
600900,31.90,32.10`,
    version: 1,
  },
];

export const generateSampleConfig = (): RebalanceConfig => ({
  ...DEFAULT_CONFIG,
  optimizationTarget: 'minimize_tax',
  lossOffsetRules: {
    ...DEFAULT_CONFIG.lossOffsetRules,
    priorYearLosses: -50000,
  },
});

export const generateSampleCSVContent = (type: 'holding' | 'target' | 'price'): string => {
  const materials = generateSampleMaterials();
  const material = materials.find(m => m.type === type);
  return material?.rawContent || '';
};

export const downloadSampleFile = (type: 'holding' | 'target' | 'price'): void => {
  const content = generateSampleCSVContent(type);
  const fileName = {
    holding: '持仓表_示例.csv',
    target: '目标权重_示例.csv',
    price: '买卖报价_示例.csv',
  }[type];

  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
