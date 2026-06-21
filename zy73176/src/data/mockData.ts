import type { CaliberVersion, ObjectAlias, Material, BoundaryRecord } from '../types';

export const mockCaliberVersions: CaliberVersion[] = [
  {
    id: 'cal-v1',
    version: '1.0',
    name: '初始口径',
    description: '2026年1月发布的第一版计算口径',
    formulas: [
      {
        id: 'f1',
        name: '概率模拟基础公式',
        expression: 'P = (X - μ) / σ',
        variables: ['X', 'μ', 'σ'],
        description: '标准正态分布转换'
      },
      {
        id: 'f2',
        name: '边界置信度计算',
        expression: 'CI = μ ± Z * (σ / √n)',
        variables: ['μ', 'Z', 'σ', 'n'],
        description: '置信区间计算公式'
      }
    ],
    units: [
      { id: 'u1', name: '百分比', symbol: '%', category: 'ratio', conversionFactor: 1 },
      { id: 'u2', name: '次', symbol: '次', category: 'count', conversionFactor: 1 },
      { id: 'u3', name: '万元', symbol: '万元', category: 'currency', conversionFactor: 1 },
      { id: 'u4', name: '天', symbol: '天', category: 'time', conversionFactor: 1 }
    ],
    thresholds: [
      { id: 't1', name: '违约概率阈值', minValue: 0, maxValue: 5, unit: '%', description: '正常范围0-5%' },
      { id: 't2', name: '损失金额阈值', minValue: 0, maxValue: 1000, unit: '万元', description: '单笔损失上限' },
      { id: 't3', name: '逾期天数阈值', minValue: 0, maxValue: 90, unit: '天', description: '正常类贷款上限' }
    ],
    createdAt: '2026-01-15T00:00:00Z',
    createdBy: '建模团队',
    isActive: false,
    changeLog: '初始版本发布'
  },
  {
    id: 'cal-v2',
    version: '2.0',
    name: '修订口径',
    description: '2026年3月修订，调整阈值范围',
    formulas: [
      {
        id: 'f1-v2',
        name: '概率模拟基础公式',
        expression: 'P = Φ((X - μ) / σ)',
        variables: ['X', 'μ', 'σ'],
        description: '标准正态分布累积概率'
      },
      {
        id: 'f2-v2',
        name: '边界置信度计算',
        expression: 'CI = μ ± Z * (σ / √n) * (1 + ρ)',
        variables: ['μ', 'Z', 'σ', 'n', 'ρ'],
        description: '考虑相关性的置信区间'
      }
    ],
    units: [
      { id: 'u1', name: '百分比', symbol: '%', category: 'ratio', conversionFactor: 1 },
      { id: 'u2', name: '次', symbol: '次', category: 'count', conversionFactor: 1 },
      { id: 'u3', name: '万元', symbol: '万元', category: 'currency', conversionFactor: 1 },
      { id: 'u4', name: '天', symbol: '天', category: 'time', conversionFactor: 1 },
      { id: 'u5', name: '亿元', symbol: '亿元', category: 'currency', conversionFactor: 10000 }
    ],
    thresholds: [
      { id: 't1-v2', name: '违约概率阈值', minValue: 0, maxValue: 3, unit: '%', description: '正常范围0-3%，收紧标准' },
      { id: 't2-v2', name: '损失金额阈值', minValue: 0, maxValue: 2000, unit: '万元', description: '单笔损失上限提高' },
      { id: 't3-v2', name: '逾期天数阈值', minValue: 0, maxValue: 60, unit: '天', description: '正常类贷款上限收紧' }
    ],
    createdAt: '2026-03-20T00:00:00Z',
    createdBy: '建模团队',
    isActive: true,
    changeLog: '1. 收紧违约概率阈值从5%到3%\n2. 提高损失金额上限从1000万到2000万\n3. 收紧逾期天数从90天到60天\n4. 增加相关性参数ρ'
  }
];

export const mockObjectAliases: ObjectAlias[] = [
  {
    id: 'alias-1',
    canonicalName: '违约概率',
    aliases: ['PD', 'Probability of Default', '违约率', '不良概率'],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z'
  },
  {
    id: 'alias-2',
    canonicalName: '违约损失率',
    aliases: ['LGD', 'Loss Given Default', '损失率'],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z'
  },
  {
    id: 'alias-3',
    canonicalName: '风险暴露',
    aliases: ['EAD', 'Exposure at Default', '敞口', '风险敞口'],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z'
  },
  {
    id: 'alias-4',
    canonicalName: '预期损失',
    aliases: ['EL', 'Expected Loss', '预计损失'],
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z'
  }
];

export const mockMaterials: Material[] = [
  {
    id: 'mat-001',
    title: '2026年5月对公客户评级材料',
    materials: [
      {
        type: 'file',
        name: '客户A评级报告.pdf',
        content: '客户A，对公企业，评级AA，PD=2.5%，LGD=45%，EAD=500万元',
        uploadTime: '2026-05-10T09:30:00Z',
        caliberVersionId: 'cal-v2'
      },
      {
        type: 'remark',
        name: '评分备注',
        content: '客户A PD数据来自2026Q1内部模型，样本量n=120，置信度95%\n备注：边界样本较少，需关注尾部风险',
        uploadTime: '2026-05-10T10:15:00Z',
        caliberVersionId: 'cal-v2'
      }
    ],
    items: [
      { id: 'item-1', objectName: 'PD', value: 2.5, unit: '%', sourceIndex: 0, confidence: 0.85 },
      { id: 'item-2', objectName: 'LGD', value: 45, unit: '%', sourceIndex: 0, confidence: 0.9 },
      { id: 'item-3', objectName: 'EAD', value: 500, unit: '万元', sourceIndex: 0, confidence: 0.95 }
    ],
    scoreRemark: '整体评级合理，但PD接近阈值，建议复核',
    oralNote: '小岑口头说明：该客户属于传统制造业，近期行业风险上升，建议从严把握',
    caliberVersionId: 'cal-v2',
    createdAt: '2026-05-10T09:30:00Z',
    updatedAt: '2026-05-10T14:20:00Z',
    status: 'warning'
  },
  {
    id: 'mat-002',
    title: '2026年5月零售资产池数据',
    materials: [
      {
        type: 'file',
        name: '零售资产池明细.xlsx',
        content: '资产池：信用卡资产池\n总笔数：50000笔\n平均违约率：1.8%\n平均损失率：60%\n总敞口：15亿元',
        uploadTime: '2026-05-12T11:00:00Z',
        caliberVersionId: 'cal-v2'
      },
      {
        type: 'remark',
        name: '评分备注',
        content: '注意：标题写"信用卡资产池"，但明细中包含部分消费贷数据\n样本量充足，n=50000',
        uploadTime: '2026-05-12T11:30:00Z',
        caliberVersionId: 'cal-v2'
      }
    ],
    items: [
      { id: 'item-4', objectName: '违约概率', value: 1.8, unit: '%', sourceIndex: 0, confidence: 0.92 },
      { id: 'item-5', objectName: '违约损失率', value: 60, unit: '%', sourceIndex: 0, confidence: 0.88 },
      { id: 'item-6', objectName: '风险暴露', value: 15, unit: '亿元', sourceIndex: 0, confidence: 0.95 }
    ],
    scoreRemark: '标题与明细存在不一致，已按明细数据处理',
    oralNote: '',
    caliberVersionId: 'cal-v2',
    createdAt: '2026-05-12T11:00:00Z',
    updatedAt: '2026-05-12T16:45:00Z',
    status: 'completed'
  },
  {
    id: 'mat-003',
    title: '小微企业专项评分',
    materials: [
      {
        type: 'file',
        name: '小微企业客户B数据.csv',
        content: '客户B，小微企业，成立3年\n不良概率：4.2%\n损失率：55%\n敞口：80万元\n备注：该客户逾期65天',
        uploadTime: '2026-05-15T14:00:00Z',
        caliberVersionId: 'cal-v1'
      },
      {
        type: 'oral',
        name: '口头说明',
        content: '小岑：客户B的数据是用旧口径（v1）计算的，需要注意阈值变化\n另外逾期天数65天，按新口径已超过60天阈值',
        uploadTime: '2026-05-15T15:30:00Z',
        caliberVersionId: 'cal-v2'
      }
    ],
    items: [
      { id: 'item-7', objectName: '不良概率', value: 4.2, unit: '%', sourceIndex: 0, confidence: 0.75 },
      { id: 'item-8', objectName: '损失率', value: 55, unit: '%', sourceIndex: 0, confidence: 0.8 },
      { id: 'item-9', objectName: '敞口', value: 80, unit: '万元', sourceIndex: 0, confidence: 0.9 },
      { id: 'item-10', objectName: '逾期天数', value: 65, unit: '天', sourceIndex: 0, confidence: 1.0 }
    ],
    scoreRemark: '数据使用旧口径，逾期天数超标，需重点关注',
    oralNote: '小岑提醒：该客户是边界样本，需要人工确认是否归入关注类',
    caliberVersionId: 'cal-v1',
    createdAt: '2026-05-15T14:00:00Z',
    updatedAt: '2026-05-16T09:15:00Z',
    status: 'error'
  },
  {
    id: 'mat-004',
    title: '低违约组合（LDP）测算',
    materials: [
      {
        type: 'file',
        name: '主权及金融机构数据.xlsx',
        content: '主权评级AAA客户10户，平均PD=0.1%\n金融机构评级AA+客户25户，平均PD=0.3%\n样本量较少，合计35户\n使用外推法估算尾部风险',
        uploadTime: '2026-05-18T10:00:00Z',
        caliberVersionId: 'cal-v2'
      },
      {
        type: 'remark',
        name: '评分备注',
        content: '低违约组合样本量不足，使用极端值理论（EVT）外推\n外推方向：向上\n原始数据范围：0.05% - 0.5%\n外推至：1.2%',
        uploadTime: '2026-05-18T11:20:00Z',
        caliberVersionId: 'cal-v2'
      }
    ],
    items: [
      { id: 'item-11', objectName: 'PD（主权）', value: 0.1, unit: '%', sourceIndex: 0, confidence: 0.6 },
      { id: 'item-12', objectName: 'PD（金融机构）', value: 0.3, unit: '%', sourceIndex: 0, confidence: 0.65 },
      { id: 'item-13', objectName: '外推PD上限', value: 1.2, unit: '%', sourceIndex: 1, confidence: 0.4 }
    ],
    scoreRemark: '样本量极少，外推结果不确定性高，需审慎使用',
    oralNote: '小岑：低违约组合的外推结果直接影响资本充足率计算，建议设置审慎调整因子',
    caliberVersionId: 'cal-v2',
    createdAt: '2026-05-18T10:00:00Z',
    updatedAt: '2026-05-19T08:30:00Z',
    status: 'warning'
  },
  {
    id: 'mat-005',
    title: '房地产业专项压力测试',
    materials: [
      {
        type: 'file',
        name: '房地产压力测试结果.pdf',
        content: '轻度压力：房价下跌10%，PD上升至3.5%\n中度压力：房价下跌20%，PD上升至5.8%\n重度压力：房价下跌30%，PD上升至9.2%\n样本量：n=2000',
        uploadTime: '2026-05-20T09:00:00Z',
        caliberVersionId: 'cal-v2'
      }
    ],
    items: [
      { id: 'item-14', objectName: 'PD（轻度压力）', value: 3.5, unit: '%', sourceIndex: 0, confidence: 0.8 },
      { id: 'item-15', objectName: 'PD（中度压力）', value: 5.8, unit: '%', sourceIndex: 0, confidence: 0.75 },
      { id: 'item-16', objectName: 'PD（重度压力）', value: 9.2, unit: '%', sourceIndex: 0, confidence: 0.7 }
    ],
    scoreRemark: '压力测试结果显示中度及重度压力下PD显著超标',
    oralNote: '',
    caliberVersionId: 'cal-v2',
    createdAt: '2026-05-20T09:00:00Z',
    updatedAt: '2026-05-20T15:00:00Z',
    status: 'error'
  }
];

export const mockBoundaryRecords: BoundaryRecord[] = [];

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
