import type {
  DesensitizationRule,
  GrayBatch,
  ReviewRecord,
  ChangeHistory,
  JudgmentRecord,
  EvaluationReport,
} from '@/types';

export const mockRules: DesensitizationRule[] = [
  {
    id: 'rule-001',
    ruleHash: 'a1b2c3d4e5f6g7h8i9j0',
    content: '主播台词中涉及真实姓名需要替换为"某先生/女士"',
    remark: '姓名脱敏-初次导入，结论：需要重点关注职场类脚本',
    createdBy: '模型评测同事小孟',
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'rule-002',
    ruleHash: 'b2c3d4e5f6g7h8i9j0k1',
    content: '台词中出现手机号码需要打码中间四位',
    remark: '手机号脱敏-初次导入，结论：电商类脚本出现频率较高',
    createdBy: '模型评测同事小孟',
    createdAt: '2026-06-01T10:05:00Z',
  },
  {
    id: 'rule-003',
    ruleHash: 'c3d4e5f6g7h8i9j0k1l2',
    content: '台词中涉及具体地址信息需模糊化处理',
    remark: '地址脱敏-初次导入，结论：本地生活类脚本需特别注意',
    createdBy: '模型评测同事小孟',
    createdAt: '2026-06-01T10:10:00Z',
  },
];

export const mockBatches: GrayBatch[] = [
  {
    id: 'batch-001',
    batchName: '第一批次-电商脚本',
    batchNo: 'GRAY-2026-0601',
    grayTime: '2026-06-03T14:00:00Z',
    remark: '电商带货类虚拟主播脚本灰度测试',
    createdBy: '模型评测同事小孟',
  },
  {
    id: 'batch-002',
    batchName: '第二批次-知识科普',
    batchNo: 'GRAY-2026-0605',
    grayTime: '2026-06-05T09:30:00Z',
    remark: '知识科普类虚拟主播脚本灰度测试-后来补录',
    createdBy: '模型评测同事小孟',
  },
];

export const mockRecords: ReviewRecord[] = [
  {
    id: 'record-001',
    ruleId: 'rule-001',
    batchId: 'batch-001',
    scriptContent: '大家好，我是李晓明，今天给大家带来一款超棒的产品...',
    autoResult: 'FAIL',
    status: 'PENDING_REVIEW',
    hasManualJudgment: true,
    createdBy: '系统自动',
    createdAt: '2026-06-03T15:00:00Z',
    updatedAt: '2026-06-05T11:00:00Z',
  },
  {
    id: 'record-002',
    ruleId: 'rule-002',
    batchId: 'batch-001',
    scriptContent: '感兴趣的朋友可以拨打 138****1234 咨询详情...',
    autoResult: 'PASS',
    status: 'CONFIRMED',
    hasManualJudgment: false,
    createdBy: '系统自动',
    createdAt: '2026-06-03T15:05:00Z',
    updatedAt: '2026-06-03T16:00:00Z',
  },
  {
    id: 'record-003',
    ruleId: 'rule-003',
    batchId: 'batch-002',
    scriptContent: '我们的门店位于北京市朝阳区建国路88号...',
    autoResult: 'FAIL',
    status: 'REVIEWING',
    hasManualJudgment: false,
    createdBy: '系统自动',
    createdAt: '2026-06-05T10:00:00Z',
    updatedAt: '2026-06-05T10:00:00Z',
  },
];

export const mockChangeHistory: ChangeHistory[] = [
  {
    id: 'change-001',
    recordId: 'record-001',
    fieldName: 'remark',
    oldValue: '姓名脱敏-初次导入，结论：需要重点关注职场类脚本',
    newValue: '姓名脱敏-初次导入，结论：需要重点关注职场类和电商类脚本',
    changedBy: '模型评测同事小孟',
    changeReason: '回看时发现电商类脚本也经常出现真实姓名',
    changedAt: '2026-06-04T16:30:00Z',
  },
];

export const mockJudgments: JudgmentRecord[] = [
  {
    id: 'judgment-001',
    recordId: 'record-001',
    judgmentResult: 'PASS',
    judgmentReason: '经核实，该主播使用的是艺名而非真实姓名，不需要脱敏',
    judgedBy: '安全审核同事',
    judgedAt: '2026-06-04T14:00:00Z',
    reviewStatus: 'PENDING',
  },
];

export const mockReports: EvaluationReport[] = [
  {
    id: 'report-001',
    recordId: 'record-002',
    conclusion: '该条脚本手机号脱敏正确，符合规范要求',
    reason: '脚本中出现的手机号已正确打码中间四位，用户无法识别完整号码',
    missingMaterials: [],
    nextStep: '可正常上线使用',
    assignee: '模型评测同事小孟',
    generatedBy: '系统自动生成',
    createdAt: '2026-06-03T16:30:00Z',
  },
];
