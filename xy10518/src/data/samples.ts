import { Defect } from '../types';

export interface SampleScenario {
  name: string;
  description: string;
  batchNumber: string;
  productCode: string;
  productName: string;
  quantity: number;
  productionDate: string;
  productionLine: string;
  initialInspection: {
    sheetNumber: string;
    sampleCount: number;
    defects: Defect[];
    inspector: string;
    notes: string;
  };
  reinspection?: {
    sheetNumber: string;
    sampleCount: number;
    defects: Defect[];
    inspector: string;
    notes: string;
  };
  concession?: {
    reason: string;
    justification: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    requestedBy: string;
    approvedBy: string;
    approvalNotes: string;
  };
  rework?: {
    approvedBy: string;
    reason: string;
  };
  closedBy: string;
  expectedFinalStatus: string;
}

export const SCENARIO_PASS_ON_FIRST: SampleScenario = {
  name: '一次通过',
  description: '初检无缺陷，直接通过并关闭批次',
  batchNumber: 'B202605120001',
  productCode: 'PCB-001',
  productName: '主板A型号',
  quantity: 1000,
  productionDate: '2026-05-10',
  productionLine: 'A线-3号',
  initialInspection: {
    sheetNumber: 'B202605120001-S001',
    sampleCount: 50,
    defects: [
      { level: 'NONE', count: 0 }
    ],
    inspector: '张质检',
    notes: '外观检查和功能测试全部通过'
  },
  closedBy: '李主管',
  expectedFinalStatus: 'CLOSED'
};

export const SCENARIO_REINSPECTION_PASS: SampleScenario = {
  name: '复检通过',
  description: '初检有轻微缺陷，复检后通过',
  batchNumber: 'B202605120002',
  productCode: 'PCB-002',
  productName: '主板B型号',
  quantity: 500,
  productionDate: '2026-05-11',
  productionLine: 'A线-2号',
  initialInspection: {
    sheetNumber: 'B202605120002-S001',
    sampleCount: 30,
    defects: [
      { level: 'MINOR', count: 2, description: '轻微划痕' }
    ],
    inspector: '张质检',
    notes: '发现2处轻微划痕，建议复检'
  },
  reinspection: {
    sheetNumber: 'B202605120002-S002',
    sampleCount: 60,
    defects: [
      { level: 'NONE', count: 0 }
    ],
    inspector: '王质检',
    notes: '加倍抽样复检，全部合格'
  },
  closedBy: '李主管',
  expectedFinalStatus: 'CLOSED'
};

export const SCENARIO_CONCESSION: SampleScenario = {
  name: '让步放行',
  description: '发现严重缺陷，申请让步放行并获批',
  batchNumber: 'B202605120003',
  productCode: 'MOD-001',
  productName: '电源模块',
  quantity: 200,
  productionDate: '2026-05-10',
  productionLine: 'B线-1号',
  initialInspection: {
    sheetNumber: 'B202605120003-S001',
    sampleCount: 20,
    defects: [
      { level: 'CRITICAL', count: 1, description: '焊点虚焊' },
      { level: 'MINOR', count: 2, description: '丝印偏移' }
    ],
    inspector: '张质检',
    notes: '发现严重缺陷，需质量经理审批'
  },
  concession: {
    reason: '客户紧急订单',
    justification: '该批次为ABC公司紧急订单，经技术评估，虚焊位置不影响核心功能，可后续批次整改',
    riskLevel: 'MEDIUM',
    requestedBy: '李主管',
    approvedBy: '赵质量经理',
    approvalNotes: '同意放行，但需追踪客户反馈，后续批次必须整改'
  },
  closedBy: '赵质量经理',
  expectedFinalStatus: 'CLOSED'
};

export const SCENARIO_REWORK: SampleScenario = {
  name: '整批返工',
  description: '初检和复检均不合格，批准整批返工',
  batchNumber: 'B202605120004',
  productCode: 'CASE-001',
  productName: '塑料外壳',
  quantity: 3000,
  productionDate: '2026-05-09',
  productionLine: 'C线-1号',
  initialInspection: {
    sheetNumber: 'B202605120004-S001',
    sampleCount: 100,
    defects: [
      { level: 'MAJOR', count: 5, description: '尺寸超差' }
    ],
    inspector: '王质检',
    notes: '5件产品尺寸超出公差范围'
  },
  reinspection: {
    sheetNumber: 'B202605120004-S002',
    sampleCount: 200,
    defects: [
      { level: 'MAJOR', count: 8, description: '尺寸超差' },
      { level: 'MINOR', count: 3, description: '表面毛刺' }
    ],
    inspector: '张质检',
    notes: '复检仍发现批量性尺寸问题，建议返工'
  },
  rework: {
    approvedBy: '赵质量经理',
    reason: '批量性尺寸超差，需返工调整模具参数后重新生产'
  },
  closedBy: '赵质量经理',
  expectedFinalStatus: 'CLOSED'
};

export const ALL_SCENARIOS: SampleScenario[] = [
  SCENARIO_PASS_ON_FIRST,
  SCENARIO_REINSPECTION_PASS,
  SCENARIO_CONCESSION,
  SCENARIO_REWORK
];
