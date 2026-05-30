import type { Batch, Material, ParsedTerms, CustomerPosition, UnderlyingPrice, CalculationResult, ValidationIssue, OperationLog, PayoutPlan } from '../types';
import { generateId, calculateDataHash } from '../utils/hash';

export function createDemoBatch(): Batch {
  return {
    id: 'batch_demo_001',
    name: '2024年Q4结构性存款收益复核',
    status: 'ready',
    createdAt: new Date('2024-12-15'),
    updatedAt: new Date('2024-12-20'),
    currentVersion: 2,
    issueCount: 2,
    errorCount: 0,
    warningCount: 2,
  };
}

export function createDemoMaterials(): Material[] {
  const termContent = {
    产品代码: 'SJG20241201',
    产品名称: '沪深300挂钩结构性存款202412期',
    挂钩标的: '沪深300指数',
    标的代码: '000300.SH',
    币种: 'CNY',
    期限: 91,
    观察起始日: '2024-09-15',
    观察结束日: '2024-12-15',
    价格下限: 3500,
    价格上限: 4000,
    下限包含: true,
    上限包含: true,
    收益档位: [
      '[3500, 3700): 2.5%',
      '[3700, 3900): 3.5%',
      '[3900, 4000]: 4.5%',
    ],
    提前终止: '是',
    提前终止观察日: '2024-10-15,2024-11-15',
    触发条件: '收盘价≥3950',
    触发水平: 3950,
    提前终止收益率: '3.2%',
    _location_产品代码: '产品条款.xlsx!A2',
    _location_产品名称: '产品条款.xlsx!B2',
    _location_挂钩标的: '产品条款.xlsx!C2',
    _location_标的代码: '产品条款.xlsx!D2',
    _location_观察起始日: '产品条款.xlsx!E2',
    _location_观察结束日: '产品条款.xlsx!F2',
    _location_价格下限: '产品条款.xlsx!G2',
    _location_价格上限: '产品条款.xlsx!H2',
    _location_收益档位: '产品条款.xlsx!I2',
    _location_提前终止: '产品条款.xlsx!J2',
  };
  
  const posContent = {
    rows: [
      {
        客户编号: 'C001',
        客户名称: '张三',
        产品代码: 'SJG20241201',
        持有金额: 1000000,
        起息日: '2024-09-15',
        到期日: '2024-12-15',
        _rowNumber: 2,
        _location_客户名称: '客户持仓.xlsx!B2',
        _location_持有金额: '客户持仓.xlsx!D2',
      },
      {
        客户编号: 'C002',
        客户名称: '李四',
        产品代码: 'SJG20241201',
        持有金额: 500000,
        起息日: '2024-09-15',
        到期日: '2024-12-15',
        _rowNumber: 3,
        _location_客户名称: '客户持仓.xlsx!B3',
        _location_持有金额: '客户持仓.xlsx!D3',
      },
      {
        客户编号: 'C003',
        客户名称: '王五',
        产品代码: 'SJG20241201',
        持有金额: 2000000,
        起息日: '2024-09-16',
        到期日: '2024-12-16',
        _rowNumber: 4,
        _location_客户名称: '客户持仓.xlsx!B4',
        _location_持有金额: '客户持仓.xlsx!D4',
      },
      {
        客户编号: 'C004',
        客户名称: '赵六',
        产品代码: 'SJG20241201',
        持有金额: 800000,
        起息日: '2024-09-15',
        到期日: '2024-12-15',
        _rowNumber: 5,
        _location_客户名称: '客户持仓.xlsx!B5',
        _location_持有金额: '客户持仓.xlsx!D5',
      },
      {
        客户编号: 'C005',
        客户名称: '钱七',
        产品代码: 'SJG20241201',
        持有金额: 1500000,
        起息日: '2024-09-15',
        到期日: '2024-12-15',
        _rowNumber: 6,
        _location_客户名称: '客户持仓.xlsx!B6',
        _location_持有金额: '客户持仓.xlsx!D6',
      },
    ],
  };
  
  const priceContent = {
    rows: [
      { 日期: '2024-09-15', 收盘价: 3680.52, _rowNumber: 2 },
      { 日期: '2024-10-15', 收盘价: 3850.23, _rowNumber: 3 },
      { 日期: '2024-11-15', 收盘价: 3950.00, _rowNumber: 4 },
      { 日期: '2024-12-15', 收盘价: 3900.00, _rowNumber: 5 },
    ],
  };
  
  const termMaterial: Material = {
    id: 'mat_term_001',
    batchId: 'batch_demo_001',
    type: 'product_terms',
    filename: '产品条款.xlsx',
    content: termContent,
    dataHash: calculateDataHash(termContent),
    importedAt: new Date('2024-12-15T10:00:00'),
    source: '产品部门-李明',
    version: 1,
    status: 'new',
  };
  
  const posMaterial: Material = {
    id: 'mat_pos_001',
    batchId: 'batch_demo_001',
    type: 'customer_position',
    filename: '客户持仓.xlsx',
    content: posContent,
    dataHash: calculateDataHash(posContent),
    importedAt: new Date('2024-12-15T11:30:00'),
    source: '运营部门-王芳',
    version: 1,
    status: 'new',
  };
  
  const priceMaterial: Material = {
    id: 'mat_price_001',
    batchId: 'batch_demo_001',
    type: 'underlying_price',
    filename: '标的价格.xlsx',
    content: priceContent,
    dataHash: calculateDataHash(priceContent),
    importedAt: new Date('2024-12-15T14:00:00'),
    source: '市场数据-张伟',
    version: 1,
    status: 'new',
  };
  
  return [termMaterial, posMaterial, priceMaterial];
}

export function createDemoParsedTerms(): ParsedTerms {
  return {
    id: 'terms_demo_001',
    batchId: 'batch_demo_001',
    productCode: 'SJG20241201',
    productName: '沪深300挂钩结构性存款202412期',
    underlying: '沪深300指数',
    underlyingCode: '000300.SH',
    currency: 'CNY',
    termDays: 91,
    observationIntervals: [
      {
        id: 'interval_001',
        startDate: '2024-09-15',
        endDate: '2024-12-15',
        lowerBound: 3500,
        upperBound: 4000,
        lowerInclusive: true,
        upperInclusive: true,
      },
    ],
    returnTiers: [
      {
        id: 'tier_001',
        lowerBound: 3500,
        upperBound: 3700,
        lowerInclusive: true,
        upperInclusive: false,
        returnRate: 0.025,
        description: '[3500, 3700): 2.5%',
      },
      {
        id: 'tier_002',
        lowerBound: 3700,
        upperBound: 3900,
        lowerInclusive: true,
        upperInclusive: false,
        returnRate: 0.035,
        description: '[3700, 3900): 3.5%',
      },
      {
        id: 'tier_003',
        lowerBound: 3900,
        upperBound: 4000,
        lowerInclusive: true,
        upperInclusive: true,
        returnRate: 0.045,
        description: '[3900, 4000]: 4.5%',
      },
    ],
    earlyTermination: {
      enabled: true,
      observationDates: ['2024-10-15', '2024-11-15'],
      triggerCondition: '收盘价≥3950',
      triggerLevel: 3950,
      returnRate: 0.032,
    },
    evidenceRef: {
      productCode: {
        materialId: 'mat_term_001',
        filename: '产品条款.xlsx',
        location: '产品条款.xlsx!A2',
        value: 'SJG20241201',
      },
      underlying: {
        materialId: 'mat_term_001',
        filename: '产品条款.xlsx',
        location: '产品条款.xlsx!C2',
        value: '沪深300指数',
      },
      'interval_startDate': {
        materialId: 'mat_term_001',
        filename: '产品条款.xlsx',
        location: '产品条款.xlsx!E2',
        value: '2024-09-15',
      },
      'interval_endDate': {
        materialId: 'mat_term_001',
        filename: '产品条款.xlsx',
        location: '产品条款.xlsx!F2',
        value: '2024-12-15',
      },
      'tier_0': {
        materialId: 'mat_term_001',
        filename: '产品条款.xlsx',
        location: '产品条款.xlsx!I2',
        value: '[3500, 3700): 2.5%',
      },
      'tier_1': {
        materialId: 'mat_term_001',
        filename: '产品条款.xlsx',
        location: '产品条款.xlsx!I2',
        value: '[3700, 3900): 3.5%',
      },
      'tier_2': {
        materialId: 'mat_term_001',
        filename: '产品条款.xlsx',
        location: '产品条款.xlsx!I2',
        value: '[3900, 4000]: 4.5%',
      },
      'earlyTermination': {
        materialId: 'mat_term_001',
        filename: '产品条款.xlsx',
        location: '产品条款.xlsx!J2',
        value: '是',
      },
    },
    parsedAt: new Date('2024-12-15T15:00:00'),
    manuallyModified: false,
  };
}

export function createDemoPositions(): CustomerPosition[] {
  return [
    {
      id: 'pos_001',
      batchId: 'batch_demo_001',
      customerId: 'C001',
      customerName: '张三',
      productCode: 'SJG20241201',
      principal: 1000000,
      startDate: '2024-09-15',
      endDate: '2024-12-15',
      evidenceRef: {
        materialId: 'mat_pos_001',
        filename: '客户持仓.xlsx',
        location: '客户持仓.xlsx!B2',
        value: '张三',
      },
    },
    {
      id: 'pos_002',
      batchId: 'batch_demo_001',
      customerId: 'C002',
      customerName: '李四',
      productCode: 'SJG20241201',
      principal: 500000,
      startDate: '2024-09-15',
      endDate: '2024-12-15',
      evidenceRef: {
        materialId: 'mat_pos_001',
        filename: '客户持仓.xlsx',
        location: '客户持仓.xlsx!B3',
        value: '李四',
      },
    },
    {
      id: 'pos_003',
      batchId: 'batch_demo_001',
      customerId: 'C003',
      customerName: '王五',
      productCode: 'SJG20241201',
      principal: 2000000,
      startDate: '2024-09-16',
      endDate: '2024-12-16',
      evidenceRef: {
        materialId: 'mat_pos_001',
        filename: '客户持仓.xlsx',
        location: '客户持仓.xlsx!B4',
        value: '王五',
      },
    },
    {
      id: 'pos_004',
      batchId: 'batch_demo_001',
      customerId: 'C004',
      customerName: '赵六',
      productCode: 'SJG20241201',
      principal: 800000,
      startDate: '2024-09-15',
      endDate: '2024-12-15',
      evidenceRef: {
        materialId: 'mat_pos_001',
        filename: '客户持仓.xlsx',
        location: '客户持仓.xlsx!B5',
        value: '赵六',
      },
    },
    {
      id: 'pos_005',
      batchId: 'batch_demo_001',
      customerId: 'C005',
      customerName: '钱七',
      productCode: 'SJG20241201',
      principal: 1500000,
      startDate: '2024-09-15',
      endDate: '2024-12-15',
      evidenceRef: {
        materialId: 'mat_pos_001',
        filename: '客户持仓.xlsx',
        location: '客户持仓.xlsx!B6',
        value: '钱七',
      },
    },
  ];
}

export function createDemoPrices(batchId: string): UnderlyingPrice[] {
  return [
    { id: 'price_001', batchId, date: '2024-09-15', price: 3680.52, source: 'Wind' },
    { id: 'price_002', batchId, date: '2024-10-15', price: 3850.23, source: 'Wind' },
    { id: 'price_003', batchId, date: '2024-11-15', price: 3950.00, source: 'Wind' },
    { id: 'price_004', batchId, date: '2024-12-15', price: 3900.00, source: 'Wind' },
  ];
}

export function createDemoCalculations(): CalculationResult[] {
  return [
    {
      id: 'calc_001',
      batchId: 'batch_demo_001',
      positionId: 'pos_001',
      customerName: '张三',
      principal: 1000000,
      matchedTierId: 'tier_002',
      matchedTierDescription: '[3700, 3900): 3.5%',
      observationPrice: 3850.23,
      observationDate: '2024-11-15',
      returnRate: 0.032,
      calculatedReturn: 32000,
      payoutAmount: 1032000,
      calculationSteps: [
        { step: '1', description: '本金确认', value: '1,000,000.00' },
        { step: '2', description: '标的观察价格确认', value: '2024-11-15: 3850.2300' },
        { step: '3', description: '提前终止检查', value: '触发提前终止 (2024-11-15: 3950.0000)' },
        { step: '4', description: '提前终止收益率', value: '3.20%' },
        { step: '5', description: '提前终止收益计算', value: '32,000.00' },
      ],
      earlyTerminated: true,
      terminationDate: '2024-11-15',
      calculatedAt: new Date('2024-12-15T16:00:00'),
    },
    {
      id: 'calc_002',
      batchId: 'batch_demo_001',
      positionId: 'pos_002',
      customerName: '李四',
      principal: 500000,
      matchedTierId: 'tier_002',
      matchedTierDescription: '[3700, 3900): 3.5%',
      observationPrice: 3850.23,
      observationDate: '2024-11-15',
      returnRate: 0.032,
      calculatedReturn: 16000,
      payoutAmount: 516000,
      calculationSteps: [
        { step: '1', description: '本金确认', value: '500,000.00' },
        { step: '2', description: '标的观察价格确认', value: '2024-11-15: 3850.2300' },
        { step: '3', description: '提前终止检查', value: '触发提前终止 (2024-11-15: 3950.0000)' },
        { step: '4', description: '提前终止收益率', value: '3.20%' },
        { step: '5', description: '提前终止收益计算', value: '16,000.00' },
      ],
      earlyTerminated: true,
      terminationDate: '2024-11-15',
      calculatedAt: new Date('2024-12-15T16:00:00'),
    },
    {
      id: 'calc_003',
      batchId: 'batch_demo_001',
      positionId: 'pos_003',
      customerName: '王五',
      principal: 2000000,
      matchedTierId: 'tier_003',
      matchedTierDescription: '[3900, 4000]: 4.5%',
      observationPrice: 3900.00,
      observationDate: '2024-12-16',
      returnRate: 0.045,
      calculatedReturn: 90000,
      payoutAmount: 2090000,
      calculationSteps: [
        { step: '1', description: '本金确认', value: '2,000,000.00' },
        { step: '2', description: '标的观察价格确认', value: '2024-12-16: 3900.0000' },
        { step: '2.1', description: '⚠️ 价格触达区间边界，需特别注意边界处理', value: '3900.0000' },
        { step: '3', description: '提前终止检查', value: '未触发' },
        { step: '4', description: '档位匹配', value: '[3900, 4000]: 4.5%' },
        { step: '5', description: '匹配档位收益率', value: '4.50%' },
        { step: '6', description: '收益计算 (本金 × 收益率)', value: '90,000.00' },
      ],
      earlyTerminated: false,
      calculatedAt: new Date('2024-12-15T16:00:00'),
    },
    {
      id: 'calc_004',
      batchId: 'batch_demo_001',
      positionId: 'pos_004',
      customerName: '赵六',
      principal: 800000,
      matchedTierId: 'tier_003',
      matchedTierDescription: '[3900, 4000]: 4.5%',
      observationPrice: 3900.00,
      observationDate: '2024-12-15',
      returnRate: 0.045,
      calculatedReturn: 36000,
      payoutAmount: 836000,
      calculationSteps: [
        { step: '1', description: '本金确认', value: '800,000.00' },
        { step: '2', description: '标的观察价格确认', value: '2024-12-15: 3900.0000' },
        { step: '2.1', description: '⚠️ 价格触达区间边界，需特别注意边界处理', value: '3900.0000' },
        { step: '3', description: '提前终止检查', value: '未触发' },
        { step: '4', description: '档位匹配', value: '[3900, 4000]: 4.5%' },
        { step: '5', description: '匹配档位收益率', value: '4.50%' },
        { step: '6', description: '收益计算 (本金 × 收益率)', value: '36,000.00' },
      ],
      earlyTerminated: false,
      calculatedAt: new Date('2024-12-15T16:00:00'),
    },
    {
      id: 'calc_005',
      batchId: 'batch_demo_001',
      positionId: 'pos_005',
      customerName: '钱七',
      principal: 1500000,
      matchedTierId: 'tier_002',
      matchedTierDescription: '[3700, 3900): 3.5%',
      observationPrice: 3850.23,
      observationDate: '2024-11-15',
      returnRate: 0.032,
      calculatedReturn: 48000,
      payoutAmount: 1548000,
      calculationSteps: [
        { step: '1', description: '本金确认', value: '1,500,000.00' },
        { step: '2', description: '标的观察价格确认', value: '2024-11-15: 3850.2300' },
        { step: '3', description: '提前终止检查', value: '触发提前终止 (2024-11-15: 3950.0000)' },
        { step: '4', description: '提前终止收益率', value: '3.20%' },
        { step: '5', description: '提前终止收益计算', value: '48,000.00' },
      ],
      earlyTerminated: true,
      terminationDate: '2024-11-15',
      calculatedAt: new Date('2024-12-15T16:00:00'),
    },
  ];
}

export function createDemoIssues(): ValidationIssue[] {
  return [
    {
      id: 'issue_001',
      batchId: 'batch_demo_001',
      severity: 'warning',
      type: 'boundary_error',
      description: '价格触及档位分界点 3900.0000，同时属于两个档位（都包含边界），可能导致匹配歧义',
      triggeredBy: '价格 2024-12-15: 3900.00',
      blockedAt: '档位校验阶段',
      suggestion: '请调整边界设置，确保分界点只属于一个档位。建议设置为档位2包含上限、档位3不包含下限，或反之',
      evidence: [
        {
          materialId: 'mat_price_001',
          filename: '标的价格.xlsx',
          location: '第5行',
          value: '2024-12-15: 3900',
        },
        {
          materialId: 'mat_term_001',
          filename: '产品条款.xlsx',
          location: '产品条款.xlsx!I2',
          value: '[3700, 3900): 3.5%',
        },
        {
          materialId: 'mat_term_001',
          filename: '产品条款.xlsx',
          location: '产品条款.xlsx!I2',
          value: '[3900, 4000]: 4.5%',
        },
      ],
      resolved: false,
    },
    {
      id: 'issue_002',
      batchId: 'batch_demo_001',
      severity: 'warning',
      type: 'logic_conflict',
      description: '客户 王五 的到期日 2024-12-16 晚于观察期结束日 2024-12-15',
      triggeredBy: '客户: 王五',
      blockedAt: '数据一致性检查',
      suggestion: '请确认持仓到期日和观察期设置是否正确，该持仓观察日使用最新价格2024-12-16',
      evidence: [
        {
          materialId: 'mat_pos_001',
          filename: '客户持仓.xlsx',
          location: '客户持仓.xlsx!B4',
          value: '王五',
        },
      ],
      resolved: false,
    },
    {
      id: 'issue_003',
      batchId: 'batch_demo_001',
      severity: 'info',
      type: 'early_termination_missing',
      description: '检测到 3 位客户触发提前终止',
      triggeredBy: '提前终止触发: 张三, 李四, 钱七',
      blockedAt: '提前终止检查阶段',
      suggestion: '请确认提前终止收益率 3.20% 是否正确应用于这些客户',
      evidence: [
        {
          materialId: 'mat_term_001',
          filename: '产品条款.xlsx',
          location: '产品条款.xlsx!J2',
          value: '是',
        },
      ],
      resolved: false,
    },
  ];
}

export function createDemoPayoutPlans(): PayoutPlan[] {
  return [
    {
      id: 'plan_001',
      batchId: 'batch_demo_001',
      name: '方案一：按观察日收盘价计算',
      description: '使用观察区间内最后一个交易日的收盘价作为观察价格，匹配对应收益档位',
      totalPrincipal: 5800000,
      totalPayout: 6022000,
      totalReturn: 222000,
      averageReturnRate: 0.038275,
      details: createDemoCalculations(),
      isSelected: true,
      createdAt: new Date('2024-12-15T17:00:00'),
    },
    {
      id: 'plan_002',
      batchId: 'batch_demo_001',
      name: '方案二：保守方案（最低档收益率）',
      description: '假设所有客户均适用最低档收益率，用于风险准备金计提或最坏情况测算',
      totalPrincipal: 5800000,
      totalPayout: 5945000,
      totalReturn: 145000,
      averageReturnRate: 0.025,
      details: [],
      isSelected: false,
      createdAt: new Date('2024-12-15T17:00:00'),
    },
    {
      id: 'plan_003',
      batchId: 'batch_demo_001',
      name: '方案三：假设全部提前终止',
      description: '假设所有客户均在第一个提前终止观察日触发提前终止，用于压力测试',
      totalPrincipal: 5800000,
      totalPayout: 5985600,
      totalReturn: 185600,
      averageReturnRate: 0.032,
      details: [],
      isSelected: false,
      createdAt: new Date('2024-12-15T17:00:00'),
    },
  ];
}

export function createDemoOperationLogs(): OperationLog[] {
  return [
    {
      id: 'log_001',
      batchId: 'batch_demo_001',
      action: '导入材料: 产品条款.xlsx',
      operator: '当前用户',
      afterValue: { id: 'mat_term_001' },
      timestamp: new Date('2024-12-15T10:00:00'),
    },
    {
      id: 'log_002',
      batchId: 'batch_demo_001',
      action: '导入材料: 客户持仓.xlsx',
      operator: '当前用户',
      afterValue: { id: 'mat_pos_001' },
      timestamp: new Date('2024-12-15T11:30:00'),
    },
    {
      id: 'log_003',
      batchId: 'batch_demo_001',
      action: '导入材料: 标的价格.xlsx',
      operator: '当前用户',
      afterValue: { id: 'mat_price_001' },
      timestamp: new Date('2024-12-15T14:00:00'),
    },
    {
      id: 'log_004',
      batchId: 'batch_demo_001',
      action: '条款解析完成',
      operator: '系统',
      afterValue: { parsedTerms: '完成', positions: 5, prices: 4 },
      timestamp: new Date('2024-12-15T15:00:00'),
    },
    {
      id: 'log_005',
      batchId: 'batch_demo_001',
      action: '档位试算完成',
      operator: '系统',
      afterValue: { count: 5, totalPayout: 6022000 },
      timestamp: new Date('2024-12-15T16:00:00'),
    },
    {
      id: 'log_006',
      batchId: 'batch_demo_001',
      action: '复核校验完成',
      operator: '系统',
      afterValue: { errorCount: 0, warningCount: 2, totalIssues: 3 },
      timestamp: new Date('2024-12-15T16:30:00'),
    },
    {
      id: 'log_007',
      batchId: 'batch_demo_001',
      action: '兑付方案生成完成',
      operator: '系统',
      afterValue: { planCount: 3 },
      timestamp: new Date('2024-12-15T17:00:00'),
    },
  ];
}

import { useBatchStore } from '../store/batchStore';

export function loadDemoData() {
  const batch = createDemoBatch();
  const materials = createDemoMaterials();
  const terms = createDemoParsedTerms();
  const positions = createDemoPositions();
  const prices = createDemoPrices(batch.id);
  const calculations = createDemoCalculations();
  const issues = createDemoIssues();
  const plans = createDemoPayoutPlans();
  const logs = createDemoOperationLogs();
  
  useBatchStore.setState({
    batches: [batch],
    currentBatch: batch,
    materials,
    parsedTerms: terms,
    positions,
    prices,
    calculations,
    validationIssues: issues,
    payoutPlans: plans,
    operationLogs: logs,
  });
}
